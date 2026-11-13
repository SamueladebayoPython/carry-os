import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@carry-os/shared";

import { SERVICE_NAME, SERVICE_VERSION } from "../app.constants.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: "Liveness check for the carry os API" })
  @ApiOkResponse({
    description: "The API process is running.",
    schema: {
      type: "object",
      required: ["status", "service", "version", "timestamp"],
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: SERVICE_NAME },
        version: { type: "string", example: SERVICE_VERSION },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({
      status: "ok",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    });
  }
}
