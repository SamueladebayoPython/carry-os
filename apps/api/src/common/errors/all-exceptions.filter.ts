import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service.js";
import { REQUEST_ID_HEADER } from "../request-context/request-id.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type { RequestWithRequestId } from "../request-context/request-context.types.js";
import {
  AppError,
  type AppErrorCode,
  type AppErrorDetail,
} from "./app-error.js";
import {
  toErrorResponseDetails,
  type ErrorResponseBody,
  type ErrorResponseDebug,
} from "./error-response.types.js";
import { redactSensitiveText } from "./redact-sensitive-text.js";

const MAX_VALIDATION_DETAILS = 20;
const MAX_VALIDATION_DETAIL_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 500;

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "Request validation failed.",
  [HttpStatus.UNAUTHORIZED]: "Authentication is required.",
  [HttpStatus.FORBIDDEN]:
    "You do not have permission to perform this action.",
  [HttpStatus.NOT_FOUND]: "Resource not found.",
  [HttpStatus.METHOD_NOT_ALLOWED]: "Method not allowed.",
  [HttpStatus.CONFLICT]:
    "Request conflicts with the current state of the resource.",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "Request validation failed.",
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: "Unsupported media type.",
  [HttpStatus.TOO_MANY_REQUESTS]: "Too many requests.",
};

const INTERNAL_ERROR_MESSAGE = "Internal server error.";
const GENERIC_HTTP_ERROR_MESSAGE = "Request could not be processed.";

interface NormalizedException {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details?: readonly AppErrorDetail[];
}

interface ErrorResponse {
  readonly headersSent?: boolean;
  setHeader(name: string, value: string): void;
  status(statusCode: number): ErrorResponse;
  json(body: unknown): void;
}

/**
 * Converts any thrown value into a safe, consistent error shape. Unknown
 * values and unexpected exceptions always collapse to a generic 500.
 */
function normalizeException(exception: unknown): NormalizedException {
  if (exception instanceof AppError) {
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const code = codeForStatus(statusCode);

    return {
      statusCode,
      code,
      message: messageForStatus(statusCode, code),
      details:
        code === "VALIDATION_ERROR"
          ? extractValidationDetails(exception.getResponse())
          : undefined,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_SERVER_ERROR",
    message: INTERNAL_ERROR_MESSAGE,
  };
}

function codeForStatus(statusCode: number): AppErrorCode {
  if (
    statusCode === HttpStatus.BAD_REQUEST ||
    statusCode === HttpStatus.UNPROCESSABLE_ENTITY
  ) {
    return "VALIDATION_ERROR";
  }

  switch (statusCode) {
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    default:
      return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? "INTERNAL_SERVER_ERROR"
        : "HTTP_ERROR";
  }
}

function messageForStatus(
  statusCode: number,
  code: AppErrorCode,
): string {
  const knownMessage = STATUS_MESSAGES[statusCode];

  if (knownMessage !== undefined) {
    return knownMessage;
  }

  return code === "INTERNAL_SERVER_ERROR"
    ? INTERNAL_ERROR_MESSAGE
    : GENERIC_HTTP_ERROR_MESSAGE;
}

function extractValidationDetails(
  response: string | object,
): readonly AppErrorDetail[] | undefined {
  if (typeof response !== "object" || response === null) {
    return undefined;
  }

  const message = (response as { message?: unknown }).message;
  const messages = Array.isArray(message)
    ? message.filter((entry): entry is string => typeof entry === "string")
    : typeof message === "string"
      ? [message]
      : [];

  if (messages.length === 0) {
    return undefined;
  }

  return messages
    .slice(0, MAX_VALIDATION_DETAILS)
    .map((entry) => ({
      message: truncate(redactSensitiveText(entry), MAX_VALIDATION_DETAIL_LENGTH),
    }));
}

function isUnexpectedException(exception: unknown): boolean {
  return !(exception instanceof AppError) && !(exception instanceof HttpException);
}

function buildDebug(
  exception: unknown,
  isDevelopment: boolean,
): ErrorResponseDebug | undefined {
  if (
    !isDevelopment ||
    !isUnexpectedException(exception) ||
    !(exception instanceof Error)
  ) {
    return undefined;
  }

  return {
    name: exception.name,
    message: truncate(
      redactSensitiveText(exception.message),
      MAX_MESSAGE_LENGTH,
    ),
    stack:
      exception.stack === undefined
        ? undefined
        : redactSensitiveText(exception.stack),
  };
}

function buildResponseBody(
  normalized: NormalizedException,
  requestId: string | undefined,
  path: string,
  isProduction: boolean,
  debug: ErrorResponseDebug | undefined,
): ErrorResponseBody {
  const isServerError =
    normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
  const message = truncate(
    redactSensitiveText(
      isProduction && isServerError
        ? INTERNAL_ERROR_MESSAGE
        : normalized.message,
    ),
    MAX_MESSAGE_LENGTH,
  );
  const details = isServerError
    ? undefined
    : toErrorResponseDetails(normalized.details);

  return {
    statusCode: normalized.statusCode,
    code: normalized.code,
    message,
    timestamp: new Date().toISOString(),
    path,
    ...(requestId === undefined ? {} : { requestId }),
    ...(details === undefined ? {} : { details }),
    ...(debug === undefined ? {} : { debug }),
  };
}

function getRequestPath(request: RequestWithRequestId): string {
  const path =
    request.originalUrl ?? request.url ?? request.path ?? "/";

  return path.split("?")[0] ?? "/";
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}…`;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithRequestId>();
    const response = context.getResponse<ErrorResponse>();

    const normalized = normalizeException(exception);
    const requestId =
      this.requestContext.getRequestId() ?? request.requestId;
    const path = getRequestPath(request);
    const debug = buildDebug(exception, this.config.isDevelopment);
    const body = buildResponseBody(
      normalized,
      requestId,
      path,
      this.config.isProduction,
      debug,
    );

    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logUnexpected(exception, normalized, request, path, requestId);
    }

    if (response.headersSent === true) {
      return;
    }

    if (requestId !== undefined) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
    }

    response.status(normalized.statusCode).json(body);
  }

  private logUnexpected(
    exception: unknown,
    normalized: NormalizedException,
    request: RequestWithRequestId,
    path: string,
    requestId: string | undefined,
  ): void {
    const exceptionName =
      exception instanceof Error ? exception.name : "UnknownError";
    const exceptionMessage =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    const summary = [
      "Unexpected error",
      `requestId=${requestId ?? "unavailable"}`,
      `${request.method ?? "UNKNOWN"} ${path}`,
      `status=${normalized.statusCode}`,
      `name=${exceptionName}`,
      `message=${truncate(
        redactSensitiveText(exceptionMessage),
        MAX_MESSAGE_LENGTH,
      )}`,
    ].join(" ");

    this.logger.error(
      stack === undefined
        ? summary
        : `${summary}\n${redactSensitiveText(stack)}`,
    );
  }
}
