import { HttpException, HttpStatus } from "@nestjs/common";

export const appErrorCodes = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "HTTP_ERROR",
  "INTERNAL_SERVER_ERROR",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export interface AppErrorDetail {
  readonly field?: string;
  readonly code?: string;
  readonly message: string;
}

export interface AppErrorOptions {
  readonly details?: readonly AppErrorDetail[];
  readonly cause?: unknown;
}

/**
 * Internal application error with a stable code, an HTTP status, and a
 * consumer-safe message. Messages supplied here are treated as intentional
 * API text, not as raw exception output.
 */
export class AppError extends HttpException {
  readonly code: AppErrorCode;
  readonly details?: readonly AppErrorDetail[];

  constructor(
    code: AppErrorCode,
    statusCode: number,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(
      { code, message, details: options.details },
      statusCode,
      options.cause === undefined ? undefined : { cause: options.cause },
    );

    this.name = "AppError";
    this.code = code;
    this.details = options.details;
  }
}

export function validationError(
  message = "Request validation failed.",
  details?: readonly AppErrorDetail[],
): AppError {
  return new AppError("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, message, {
    details,
  });
}

export function notFoundError(message = "Resource not found."): AppError {
  return new AppError("NOT_FOUND", HttpStatus.NOT_FOUND, message);
}

export function unauthorizedError(
  message = "Authentication is required.",
): AppError {
  return new AppError("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, message);
}

export function forbiddenError(
  message = "You do not have permission to perform this action.",
): AppError {
  return new AppError("FORBIDDEN", HttpStatus.FORBIDDEN, message);
}

export function internalServerError(cause?: unknown): AppError {
  return new AppError(
    "INTERNAL_SERVER_ERROR",
    HttpStatus.INTERNAL_SERVER_ERROR,
    "Internal server error.",
    { cause },
  );
}
