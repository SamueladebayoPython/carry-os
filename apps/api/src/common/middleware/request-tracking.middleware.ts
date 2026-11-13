import {
  Inject,
  Injectable,
  Logger,
  type NestMiddleware,
} from "@nestjs/common";

import { RequestContextService } from "../request-context/request-context.service.js";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "../request-context/request-id.js";
import type {
  RequestWithRequestId,
  ResponseWithRequestId,
} from "../request-context/request-context.types.js";

type NextFunction = (error?: unknown) => void;

@Injectable()
export class RequestTrackingMiddleware
  implements NestMiddleware<RequestWithRequestId, ResponseWithRequestId>
{
  private readonly logger = new Logger("HTTP");

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  use(
    request: RequestWithRequestId,
    response: ResponseWithRequestId,
    next: NextFunction,
  ): void {
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = process.hrtime.bigint();

    response.once("finish", () => {
      this.logCompletion(request, response, requestId, startedAt);
    });

    this.requestContext.run({ requestId }, () => next());
  }

  private logCompletion(
    request: RequestWithRequestId,
    response: ResponseWithRequestId,
    requestId: string,
    startedAt: bigint,
  ): void {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const message = [
      request.method ?? "UNKNOWN",
      getRequestPath(request),
      response.statusCode,
      `${durationMs.toFixed(1)}ms`,
      `requestId=${requestId}`,
    ].join(" ");

    if (response.statusCode >= 500) {
      this.logger.error(message);
    } else if (response.statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}

function getRequestPath(request: RequestWithRequestId): string {
  const path = request.path ?? request.originalUrl ?? request.url ?? "/";

  return path.split("?")[0] ?? "/";
}
