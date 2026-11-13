import "reflect-metadata";

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../dist/app.module.js";
import { RequestTrackingMiddleware } from "../dist/common/middleware/request-tracking.middleware.js";
import { REQUEST_ID_HEADER } from "../dist/common/request-context/request-id.js";
import { loadAppConfig } from "../dist/config/app-config.js";
import { createApp } from "../dist/bootstrap.js";

const RATE_LIMIT_LIMIT = 2;
const RATE_LIMIT_TTL_SECONDS = 60;

/**
 * The production app only exposes `/api/health`, which is exempt from rate
 * limiting. This probe controller is added to a test-only module so the global
 * throttler can be exercised through two distinct API routes.
 */
class ProbeController {
  first() {
    return { route: "first" };
  }

  second() {
    return { route: "second" };
  }
}

Get("first")(
  ProbeController.prototype,
  "first",
  Object.getOwnPropertyDescriptor(ProbeController.prototype, "first"),
);
Get("second")(
  ProbeController.prototype,
  "second",
  Object.getOwnPropertyDescriptor(ProbeController.prototype, "second"),
);
Controller("probe")(ProbeController);

function createProbeModule(env = {}) {
  const config = loadAppConfig({
    NODE_ENV: "test",
    RATE_LIMIT_LIMIT: String(RATE_LIMIT_LIMIT),
    RATE_LIMIT_TTL_SECONDS: String(RATE_LIMIT_TTL_SECONDS),
    ...env,
  });

  class RateLimitProbeModule {}

  Module({
    imports: [AppModule.forRoot(config)],
    controllers: [ProbeController],
  })(RateLimitProbeModule);

  return RateLimitProbeModule;
}

async function startProbeApp(t, env = {}) {
  const module = createProbeModule(env);
  const app = await NestFactory.create(module, { logger: false });

  const requestTracking = app.get(RequestTrackingMiddleware);

  app.use((request, response, next) =>
    requestTracking.use(request, response, next),
  );
  app.setGlobalPrefix("api");

  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    port: address.port,
  };
}

/**
 * Sends a request from a loopback source address so the server observes a
 * distinct socket IP. This does not enable `trust proxy` and does not read
 * forwarded headers, so the production IP-tracking configuration is untouched.
 */
function requestFrom(localAddress, port, path) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        localAddress,
        agent: false,
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function startProductionApp(t, env) {
  const app = await createApp({
    env: { NODE_ENV: "test", ...env },
    logger: false,
  });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

test("allows the limit and rejects the next request with the existing envelope", async (t) => {
  const { baseUrl } = await startProbeApp(t);

  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);

  const blocked = await fetch(`${baseUrl}/api/probe/first`);
  assert.equal(blocked.status, 429);

  const body = await blocked.json();

  assert.equal(body.statusCode, 429);
  assert.equal(body.code, "HTTP_ERROR");
  assert.equal(body.message, "Too many requests.");
  assert.equal(body.path, "/api/probe/first");
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(body.requestId, blocked.headers.get(REQUEST_ID_HEADER));
  assert.equal("details" in body, false);
  assert.equal("debug" in body, false);
});

test("returns the default rate-limit response headers", async (t) => {
  const { baseUrl } = await startProbeApp(t);

  const first = await fetch(`${baseUrl}/api/probe/first`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-ratelimit-limit"), "2");
  assert.equal(first.headers.get("x-ratelimit-remaining"), "1");
  assert.ok(
    Number(first.headers.get("x-ratelimit-reset")) > 0,
    "reset header must be a positive number of seconds",
  );

  const second = await fetch(`${baseUrl}/api/probe/first`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-ratelimit-remaining"), "0");

  const blocked = await fetch(`${baseUrl}/api/probe/first`);
  assert.equal(blocked.status, 429);
  assert.ok(
    Number(blocked.headers.get("retry-after")) > 0,
    "blocked responses must include a positive Retry-After header",
  );
});

test("shares one bucket per client IP across different API routes", async (t) => {
  const { baseUrl } = await startProbeApp(t);

  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/second`)).status, 200);

  const blocked = await fetch(`${baseUrl}/api/probe/second`);
  assert.equal(blocked.status, 429);

  const body = await blocked.json();
  assert.equal(body.path, "/api/probe/second");
  assert.equal(body.code, "HTTP_ERROR");
});

test("keeps independent buckets for separate client IPs", async (t) => {
  const { port } = await startProbeApp(t);

  const first = await requestFrom("127.0.0.2", port, "/api/probe/first");
  const second = await requestFrom("127.0.0.2", port, "/api/probe/first");
  const blocked = await requestFrom("127.0.0.2", port, "/api/probe/first");

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(blocked.status, 429);

  const otherClient = await requestFrom(
    "127.0.0.3",
    port,
    "/api/probe/first",
  );

  assert.equal(otherClient.status, 200);
  assert.equal(otherClient.headers["x-ratelimit-limit"], "2");
  assert.equal(otherClient.headers["x-ratelimit-remaining"], "1");
});

test("keeps the health endpoint accessible after the limit is exhausted", async (t) => {
  const { baseUrl } = await startProbeApp(t);

  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 429);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const body = await health.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "carry-os-api");
  }

  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 429);
});

test("does not rate-limit unmatched routes", async (t) => {
  const { baseUrl } = await startProbeApp(t);

  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/probe/first`)).status, 429);

  const missing = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(missing.status, 404);
});

test("does not rate-limit the Swagger docs route", async (t) => {
  const { baseUrl } = await startProductionApp(t, {
    RATE_LIMIT_LIMIT: "1",
    RATE_LIMIT_TTL_SECONDS: "60",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const docs = await fetch(`${baseUrl}/api/docs`);
    assert.equal(docs.status, 200);
    assert.match(docs.headers.get("content-type") ?? "", /text\/html/);
  }
});
