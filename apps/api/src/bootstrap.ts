import { type INestApplication, type LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { SERVICE_VERSION } from "./app.constants.js";

export interface CreateAppOptions {
  logger?: LogLevel[] | false;
}

function resolveAllowedOrigins(): string[] {
  const configuredOrigins = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: options.logger ?? ["error", "warn", "log"],
  });

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: resolveAllowedOrigins(),
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("carry os API")
    .setDescription(
      "REST API for carry os. Only the health endpoint is currently implemented; product endpoints are not yet defined.",
    )
    .setVersion(SERVICE_VERSION)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  return app;
}
