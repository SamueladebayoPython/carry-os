import assert from "node:assert/strict";
import test from "node:test";

import { healthResponseSchema } from "@carry-os/shared";

import { createApp } from "../dist/bootstrap.js";

test("GET /api/health returns the shared health contract", async (t) => {
  const app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/health`,
  );
  assert.equal(response.status, 200);

  const body = await response.json();
  const parsed = healthResponseSchema.safeParse(body);

  assert.equal(parsed.success, true);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "carry-os-api");
});

test("GET /api/docs serves the generated OpenAPI UI", async (t) => {
  const app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/docs`,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
});
