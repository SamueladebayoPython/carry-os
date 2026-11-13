import assert from "node:assert/strict";
import test from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { createApp } from "../dist/bootstrap.js";
import { AllExceptionsFilter } from "../dist/common/errors/all-exceptions.filter.js";
import { validationError } from "../dist/common/errors/app-error.js";
import { REQUEST_ID_HEADER } from "../dist/common/request-context/request-id.js";
import { RequestContextService } from "../dist/common/request-context/request-context.service.js";

const VALID_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECRET_VALUE = "super-secret-password";
const SECRET_DATABASE_URL = `postgres://admin:${SECRET_VALUE}@db.internal:5432/carry`;

const DEVELOPMENT_CONFIG = {
  isDevelopment: true,
  isProduction: false,
  isTest: false,
};
const PRODUCTION_CONFIG = {
  isDevelopment: false,
  isProduction: true,
  isTest: false,
};

function createMockResponse() {
  const state = {
    statusCode: undefined,
    body: undefined,
    headers: {},
  };

  const response = {
    headersSent: false,
    setHeader(name, value) {
      state.headers[name] = value;
    },
    status(statusCode) {
      state.statusCode = statusCode;
      return response;
    },
    json(body) {
      state.body = body;
    },
  };

  return { response, state };
}

function runFilter({
  exception,
  requestId,
  config = DEVELOPMENT_CONFIG,
  logger,
}) {
  const requestContext = new RequestContextService();
  const filter = new AllExceptionsFilter(requestContext, config);

  if (logger !== undefined) {
    filter.logger = logger;
  }

  const request = {
    method: "POST",
    originalUrl: "/api/items?token=query-secret",
    headers: {
      authorization: `Bearer ${SECRET_VALUE}`,
      cookie: `session=${SECRET_VALUE}`,
    },
  };
  const { response, state } = createMockResponse();

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };

  const invoke = () => filter.catch(exception, host);

  if (requestId === undefined) {
    invoke();
  } else {
    requestContext.run({ requestId }, invoke);
  }

  return { state, request, filter };
}

test("normalizes validation errors into a safe response with a request ID", () => {
  const exception = new BadRequestException({
    message: [
      "email must be an email",
      `password=${SECRET_VALUE} must be stronger`,
    ],
    error: "Bad Request",
    statusCode: 400,
  });

  const { state } = runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
  });

  assert.equal(state.statusCode, 400);
  assert.equal(state.body.statusCode, 400);
  assert.equal(state.body.code, "VALIDATION_ERROR");
  assert.equal(state.body.message, "Request validation failed.");
  assert.equal(state.body.requestId, VALID_REQUEST_ID);
  assert.equal(state.body.path, "/api/items");
  assert.equal(typeof state.body.timestamp, "string");
  assert.equal(
    Number.isNaN(Date.parse(state.body.timestamp)),
    false,
  );
  assert.equal(state.headers[REQUEST_ID_HEADER], VALID_REQUEST_ID);
  assert.deepEqual(state.body.details, [
    { message: "email must be an email" },
    { message: "password=[redacted] must be stronger" },
  ]);

  const serialized = JSON.stringify(state.body);
  assert.equal(serialized.includes(SECRET_VALUE), false);
  assert.equal(serialized.includes("query-secret"), false);
  assert.equal(serialized.includes("stack"), false);
});

test("maps unauthorized, forbidden and not-found exceptions to distinct codes", () => {
  const cases = [
    {
      exception: new UnauthorizedException("raw auth detail"),
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
    },
    {
      exception: new ForbiddenException("raw permission detail"),
      statusCode: 403,
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    },
    {
      exception: new NotFoundException("raw resource detail"),
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Resource not found.",
    },
  ];

  for (const expected of cases) {
    const { state } = runFilter({
      exception: expected.exception,
      requestId: VALID_REQUEST_ID,
    });

    assert.equal(state.statusCode, expected.statusCode);
    assert.equal(state.body.code, expected.code);
    assert.equal(state.body.message, expected.message);
    assert.equal(state.body.requestId, VALID_REQUEST_ID);
    assert.equal(JSON.stringify(state.body).includes("raw "), false);
  }
});

test("preserves intentional AppError messages and details", () => {
  const exception = validationError("Wallet address is invalid.", [
    { field: "address", message: "must be a valid address" },
  ]);

  const { state } = runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
  });

  assert.equal(state.statusCode, 400);
  assert.equal(state.body.code, "VALIDATION_ERROR");
  assert.equal(state.body.message, "Wallet address is invalid.");
  assert.deepEqual(state.body.details, [
    { field: "address", message: "must be a valid address" },
  ]);
});

test("handles unmatched routes consistently with a retained request ID", async (t) => {
  const app = await createApp({ logger: false, env: {} });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/does-not-exist?token=query-secret`,
    {
      headers: {
        [REQUEST_ID_HEADER]: VALID_REQUEST_ID,
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), VALID_REQUEST_ID);

  const body = await response.json();

  assert.equal(body.statusCode, 404);
  assert.equal(body.code, "NOT_FOUND");
  assert.equal(body.message, "Resource not found.");
  assert.equal(body.requestId, VALID_REQUEST_ID);
  assert.equal(body.path, "/api/does-not-exist");
  assert.equal(body.debug, undefined);

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("query-secret"), false);
  assert.equal(serialized.includes("stack"), false);
});

test("returns a generic 500 without stack traces or secrets in production", () => {
  const exception = new Error(
    `connect ECONNREFUSED ${SECRET_DATABASE_URL} password=${SECRET_VALUE}`,
  );

  const { state } = runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
    config: PRODUCTION_CONFIG,
  });

  assert.equal(state.statusCode, 500);
  assert.equal(state.body.statusCode, 500);
  assert.equal(state.body.code, "INTERNAL_SERVER_ERROR");
  assert.equal(state.body.message, "Internal server error.");
  assert.equal(state.body.requestId, VALID_REQUEST_ID);
  assert.equal(state.body.debug, undefined);

  const serialized = JSON.stringify(state.body);

  assert.equal(serialized.includes(SECRET_VALUE), false);
  assert.equal(serialized.includes("db.internal"), false);
  assert.equal(serialized.includes("ECONNREFUSED"), false);
  assert.equal(serialized.includes("stack"), false);
});

test("returns a safe 500 for server-side HttpExceptions in production", () => {
  const exception = new InternalServerErrorException(
    `database failed: ${SECRET_DATABASE_URL}`,
  );

  const { state } = runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
    config: PRODUCTION_CONFIG,
  });

  assert.equal(state.statusCode, 500);
  assert.equal(state.body.code, "INTERNAL_SERVER_ERROR");
  assert.equal(state.body.message, "Internal server error.");
  assert.equal(state.body.debug, undefined);

  const serialized = JSON.stringify(state.body);

  assert.equal(serialized.includes(SECRET_VALUE), false);
  assert.equal(serialized.includes("db.internal"), false);
});

test("includes redacted debugging details for unexpected errors in development", () => {
  const exception = new Error(
    `connect ECONNREFUSED ${SECRET_DATABASE_URL} password=${SECRET_VALUE}`,
  );

  const { state } = runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
    config: DEVELOPMENT_CONFIG,
  });

  assert.equal(state.statusCode, 500);
  assert.equal(state.body.message, "Internal server error.");
  assert.equal(state.body.debug.name, "Error");
  assert.equal(typeof state.body.debug.stack, "string");

  const serialized = JSON.stringify(state.body);

  assert.equal(serialized.includes(SECRET_VALUE), false);
  assert.equal(serialized.includes("password=[redacted]"), true);
  assert.equal(serialized.includes("[redacted]@db.internal"), true);
});

test("logs unexpected errors with the request ID without secrets", () => {
  const messages = [];
  const exception = new Error(
    `connect ECONNREFUSED ${SECRET_DATABASE_URL} password=${SECRET_VALUE}`,
  );

  runFilter({
    exception,
    requestId: VALID_REQUEST_ID,
    config: PRODUCTION_CONFIG,
    logger: {
      error: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      log: (message) => messages.push(message),
    },
  });

  assert.equal(messages.length, 1);
  assert.match(messages[0], /Unexpected error/);
  assert.match(messages[0], new RegExp(`requestId=${VALID_REQUEST_ID}`));
  assert.match(messages[0], /POST \/api\/items/);
  assert.doesNotMatch(messages[0], new RegExp(SECRET_VALUE));
  assert.doesNotMatch(
    messages[0],
    /Bearer super-secret-password|session=super-secret-password/,
  );
});

test("omits the request ID when no request context is available", () => {
  const { state } = runFilter({
    exception: new NotFoundException(),
    requestId: undefined,
  });

  assert.equal(state.statusCode, 404);
  assert.equal(state.body.code, "NOT_FOUND");
  assert.equal(
    Object.prototype.hasOwnProperty.call(state.body, "requestId"),
    false,
  );
  assert.equal(state.headers[REQUEST_ID_HEADER], undefined);
});
