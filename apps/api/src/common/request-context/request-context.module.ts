import { Global, Module } from "@nestjs/common";

import { RequestTrackingMiddleware } from "../middleware/request-tracking.middleware.js";
import { RequestContextService } from "./request-context.service.js";

@Global()
@Module({
  providers: [RequestContextService, RequestTrackingMiddleware],
  exports: [RequestContextService, RequestTrackingMiddleware],
})
export class RequestContextModule {}
