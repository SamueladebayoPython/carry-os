import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { Reflector } from "@nestjs/core";
import { z } from "zod";

import { AllExceptionsFilter } from "../dist/common/errors/all-exceptions.filter.js";
import { REQUEST_ID_HEADER } from "../dist/common/request-context/request-id.js";
import { RequestContextService } from "../dist/common/request-context/request-context.service.js";
import { ValidateRequest } from "../dist/common/validation/request-validation.decorator.js";
import { ZodValidationInterceptor } from "../dist/common/validation/zod-validation.interceptor.js";
import { parseWithZod } from "../dist/common/validation/zod-validation.js";

const VALID_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createRequest(overrides = {}) {
  return {
    method: "POST",
    originalUrl: "/api/items?token=query-secret",
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
}

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

function createContext(handler, request) {
  return {
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

function decorate(schemas) {
  const handler = () => {};
  ValidateRequest(schemas)(handler);
  return handler;
}

function runValidation(schemas, request) {
  const handler = decorate(schemas);
  const interceptor = new ZodValidationInterceptor(new Reflector());
  let nextCalled = false;
  const next = {
    handle: () => {
      nextCalled = true;
      return "handled";
    },
  };
  const result = interceptor.intercept(createContext(handler, request), next);

  return { result, nextCalled, request };
}

function captureValidationError(schemas, request) {
  let nextCalled = false;
  let error;

  try {
    const handler = decorate(schemas);
    const interceptor = new ZodValidationInterceptor(new Reflector());
    interceptor.intercept(createContext(handler, request), {
      handle: () => {
        nextCalled = true;
        return "handled";
      },
    });
  } catch (caught) {
    error = caught;
  }

  return { error, nextCalled };
}

test("accepts and normalizes valid request bodies before the controller", () => {
  const request = createRequest({
    body: {
      name: "  Widget  ",
      quantity: "2",
      ignored: "drop",
    },
  });

  const { result, nextCalled } = runValidation(
    {
      body: z.object({
        name: z.string().trim().min(1),
        quantity: z.coerce.number().int().positive(),
      }),
    },
    request,
  );

  assert.equal(result, "handled");
  assert.equal(nextCalled, true);
  assert.deepEqual(request.body, { name: "Widget", quantity: 2 });
  assert.equal("ignored" in request.body, false);
  assert.deepEqual(request.validated, {
    body: { name: "Widget", quantity: 2 },
  });
});

test("rejects invalid input before the controller with safe details", () => {
  const submittedPassword = "submitted-secret-value";
  const request = createRequest({
    body: {
      email: "not-an-email",
      password: submittedPassword,
    },
  });

  const { error, nextCalled } = captureValidationError(
    {
      body: z.object({
        email: z.email(),
        password: z.string().min(32),
      }),
    },
    request,
  );

  assert.equal(nextCalled, false);
  assert.ok(error);
  assert.equal(error.name, "AppError");
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.getStatus(), 400);
  assert.deepEqual(error.details, [
    {
      field: "email",
      code: "invalid_format",
      message: "Must be a valid email address.",
    },
    {
      field: "password",
      code: "too_small",
      message: "Must be at least 32 characters.",
    },
  ]);

  const serialized = JSON.stringify(error.details);
  assert.equal(serialized.includes(submittedPassword), false);
  assert.equal(serialized.includes("not-an-email"), false);
});

test("rejects missing required fields with structured details", () => {
  const request = createRequest({ body: {} });

  const { error, nextCalled } = captureValidationError(
    {
      body: z.object({
        name: z.string(),
        email: z.email(),
      }),
    },
    request,
  );

  assert.equal(nextCalled, false);
  assert.deepEqual(error.details, [
    {
      field: "name",
      code: "invalid_type",
      message: "This field is required.",
    },
    {
      field: "email",
      code: "invalid_type",
      message: "This field is required.",
    },
  ]);
});

test("validates and replaces query strings and route parameters", () => {
  const request = createRequest({
    query: { page: "2", extra: "drop" },
    params: { id: VALID_REQUEST_ID },
  });

  const { nextCalled } = runValidation(
    {
      query: z.object({
        page: z.coerce.number().int().min(1),
      }),
      params: z.object({
        id: z.uuid(),
      }),
    },
    request,
  );

  assert.equal(nextCalled, true);
  assert.deepEqual(request.query, { page: 2 });
  assert.deepEqual(request.params, { id: VALID_REQUEST_ID });
  assert.deepEqual(request.validated, {
    query: { page: 2 },
    params: { id: VALID_REQUEST_ID },
  });
});

test("returns validation failures through the error envelope with the request ID", () => {
  const submittedToken = "submitted-secret-token";
  const request = createRequest({
    body: { token: submittedToken },
  });
  const { error } = captureValidationError(
    {
      body: z.object({ token: z.uuid() }),
    },
    request,
  );

  assert.ok(error);

  const requestContext = new RequestContextService();
  const filter = new AllExceptionsFilter(requestContext, {
    isDevelopment: false,
    isProduction: true,
    isTest: false,
  });
  const { response, state } = createMockResponse();
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };

  requestContext.run({ requestId: VALID_REQUEST_ID }, () => {
    filter.catch(error, host);
  });

  assert.equal(state.statusCode, 400);
  assert.equal(state.body.statusCode, 400);
  assert.equal(state.body.code, "VALIDATION_ERROR");
  assert.equal(state.body.message, "Request validation failed.");
  assert.equal(state.body.requestId, VALID_REQUEST_ID);
  assert.equal(state.body.path, "/api/items");
  assert.deepEqual(state.body.details, [
    {
      field: "token",
      code: "invalid_format",
      message: "Must be a valid UUID.",
    },
  ]);
  assert.equal(state.headers[REQUEST_ID_HEADER], VALID_REQUEST_ID);

  const serialized = JSON.stringify(state.body);
  assert.equal(serialized.includes(submittedToken), false);
  assert.equal(serialized.includes("query-secret"), false);
  assert.equal(serialized.includes("stack"), false);
});

test("never forwards Zod refinement messages that contain submitted values", () => {
  const submittedToken = "sensitive-submitted-token";
  const schema = z.object({
    token: z.string().superRefine((value, context) => {
      context.addIssue({
        code: "custom",
        message: `Rejected value ${value}`,
      });
    }),
  });

  let error;

  try {
    parseWithZod(schema, { token: submittedToken });
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.deepEqual(error.details, [
    {
      field: "token",
      code: "custom",
      message: "Invalid value.",
    },
  ]);
  assert.equal(
    JSON.stringify(error.details).includes(submittedToken),
    false,
  );
});

test("does not echo unsafe field names from record-like schemas", () => {
  const submittedKey = "secret=submitted-value";
  let error;

  try {
    parseWithZod(z.record(z.string(), z.number()), {
      [submittedKey]: "not-a-number",
    });
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.equal(error.details[0].field, "[field]");
  assert.equal(
    JSON.stringify(error.details).includes(submittedKey),
    false,
  );
});

test("parseWithZod returns parsed data for reusable service validation", () => {
  const parsed = parseWithZod(
    z.object({ count: z.coerce.number().int() }),
    { count: "3" },
  );

  assert.deepEqual(parsed, { count: 3 });
});

test("routes without validation metadata pass through unchanged", () => {
  const handler = () => {};
  const request = createRequest({ body: { anything: true } });
  const interceptor = new ZodValidationInterceptor(new Reflector());
  let nextCalled = false;

  const result = interceptor.intercept(createContext(handler, request), {
    handle: () => {
      nextCalled = true;
      return "handled";
    },
  });

  assert.equal(result, "handled");
  assert.equal(nextCalled, true);
  assert.deepEqual(request.body, { anything: true });
  assert.equal(request.validated, undefined);
});
