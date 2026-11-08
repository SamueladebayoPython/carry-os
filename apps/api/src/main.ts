import "reflect-metadata";

import { createApp } from "./bootstrap.js";
import { AppConfigService } from "./config/app-config.service.js";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(AppConfigService);

  await app.listen(config.port);

  console.log(`carry os API listening on http://localhost:${config.port}`);
  console.log(
    `OpenAPI documentation at http://localhost:${config.port}/api/docs`,
  );
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown startup error.";

  console.error(`carry os API failed to start: ${message}`);
  process.exitCode = 1;
});
