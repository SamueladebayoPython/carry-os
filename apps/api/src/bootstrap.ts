import { type INestApplication, type LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { SERVICE_VERSION } from "./app.constants.js";
import { RequestTrackingMiddleware } from "./common/middleware/request-tracking.middleware.js";
import { REQUEST_ID_HEADER } from "./common/request-context/request-id.js";
import type {
  RequestWithRequestId,
  ResponseWithRequestId,
} from "./common/request-context/request-context.types.js";
import {
  loadAppConfig,
  type AppConfig,
} from "./config/app-config.js";

export interface CreateAppOptions {
  logger?: LogLevel[] | false;
  config?: AppConfig;
  env?: NodeJS.ProcessEnv;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const config = options.config ?? loadAppConfig(options.env ?? process.env);

  const app = await NestFactory.create(AppModule.forRoot(config), {
    logger: options.logger ?? ["error", "warn", "log"],
  });

  const requestTracking = app.get(RequestTrackingMiddleware);

  app.use(
    (
      request: RequestWithRequestId,
      response: ResponseWithRequestId,
      next: (error?: unknown) => void,
    ) => requestTracking.use(request, response, next),
  );

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: [...config.webOrigins],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-CSRF-Token", REQUEST_ID_HEADER],
    methods: ["GET", "POST", "OPTIONS"],
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("carry os API")
    .setDescription(
      "REST API for carry os, including test-only NEAR Auth session endpoints when enabled.",
    )
    .setVersion(SERVICE_VERSION)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  return app;
}
