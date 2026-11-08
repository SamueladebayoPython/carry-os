import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../dist/bootstrap.js";
import { RequestTrackingMiddleware } from "../dist/common/middleware/request-tracking.middleware.js";
import {
  REQUEST_ID_HEADER,
  isValidRequestId,
} from "../dist/common/request-context/request-id.js";
import { RequestContextService } from "../dist/common/request-context/request-context.service.js";

const VALID_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const INVALID_REQUEST_IDS = [
  "not-a-request-id",
  "123e4567-e89b-42d3-a456-42661417400",
  "a".repeat(200),
];

async function startApp(t) {
  const app = await createApp({ logger: false, env: {} });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  return `http://127.0.0.1:${address.port}`;
}

test("generates a request ID when no incoming ID is supplied", async (t) => {
  const baseUrl = await startApp(t);
  const response = await fetch(`${baseUrl}/api/health`);

  const requestId = response.headers.get(REQUEST_ID_HEADER);

  assert.equal(response.status, 200);
  assert.equal(typeof requestId, "string");
  assert.equal(isValidRequestId(requestId), true);
});

test("accepts and normalizes a valid incoming request ID", async (t) => {
  const baseUrl = await startApp(t);
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {
      [REQUEST_ID_HEADER]: VALID_REQUEST_ID.toUpperCase(),
    },
  });

  assert.equal(
    response.headers.get(REQUEST_ID_HEADER),
    VALID_REQUEST_ID,
  );
});

test("replaces malformed or oversized incoming request IDs", async (t) => {
  const baseUrl = await startApp(t);

  for (const invalidRequestId of INVALID_REQUEST_IDS) {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        [REQUEST_ID_HEADER]: invalidRequestId,
      },
    });

    const requestId = response.headers.get(REQUEST_ID_HEADER);

    assert.equal(typeof requestId, "string");
    assert.equal(isValidRequestId(requestId), true);
    assert.notEqual(requestId, invalidRequestId);
  }
});

test("makes the request ID available throughout the request lifecycle", () => {
  const requestContext = new RequestContextService();
  const middleware = new RequestTrackingMiddleware(requestContext);
  const responseHeaders = {};
  let observedRequestId;

  const request = {
    method: "GET",
    path: "/api/test",
    headers: {
      [REQUEST_ID_HEADER]: VALID_REQUEST_ID,
    },
  };
  const response = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders[name] = value;
    },
    once() {},
  };

  middleware.use(request, response, () => {
    observedRequestId = requestContext.getRequestId();
  });

  assert.equal(observedRequestId, VALID_REQUEST_ID);
  assert.equal(request.requestId, VALID_REQUEST_ID);
  assert.equal(responseHeaders[REQUEST_ID_HEADER], VALID_REQUEST_ID);
});

test("retains the request ID on error responses", async (t) => {
  const baseUrl = await startApp(t);
  const response = await fetch(`${baseUrl}/api/does-not-exist`, {
    headers: {
      [REQUEST_ID_HEADER]: VALID_REQUEST_ID,
    },
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), VALID_REQUEST_ID);
});

test("exposes the request ID header through CORS", async (t) => {
  const baseUrl = await startApp(t);
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: "http://localhost:3000",
    },
  });

  assert.match(
    response.headers.get("access-control-expose-headers") ?? "",
    /x-request-id/i,
  );
});

test("logs completion with the request ID without sensitive headers", () => {
  const requestContext = new RequestContextService();
  const middleware = new RequestTrackingMiddleware(requestContext);
  const messages = [];
  let finishListener;

  middleware.logger = {
    log: (message) => messages.push(message),
    warn: (message) => messages.push(message),
    error: (message) => messages.push(message),
  };

  const request = {
    method: "GET",
    path: "/api/resource",
    headers: {
      [REQUEST_ID_HEADER]: VALID_REQUEST_ID,
      authorization: "Bearer super-secret-token",
      cookie: "session=secret-cookie",
      "x-wallet-signature": "secret-signature",
    },
  };
  const response = {
    statusCode: 200,
    setHeader() {},
    once(event, listener) {
      if (event === "finish") {
        finishListener = listener;
      }
    },
  };

  middleware.use(request, response, () => {});
  finishListener();

  assert.equal(messages.length, 1);
  assert.match(messages[0], new RegExp(`requestId=${VALID_REQUEST_ID}`));
  assert.doesNotMatch(
    messages[0],
    /super-secret-token|secret-cookie|secret-signature/i,
  );
  assert.doesNotMatch(messages[0], /authorization|cookie/i);
});
