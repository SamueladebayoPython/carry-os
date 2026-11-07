import "reflect-metadata";

import { createApp } from "./bootstrap.js";
import { DEFAULT_API_PORT } from "./app.constants.js";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number.parseInt(
    process.env.PORT ?? String(DEFAULT_API_PORT),
    10,
  );

  await app.listen(port);

  console.log(`carry os API listening on http://localhost:${port}`);
  console.log(`OpenAPI documentation at http://localhost:${port}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error("carry os API failed to start.", error);
  process.exitCode = 1;
});
