import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../dist/bootstrap.js";
import { loadAppConfig } from "../dist/config/app-config.js";
import { ConfigValidationError } from "../dist/config/config-validation.error.js";

function assertConfigError(operation, variable, forbiddenText) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof ConfigValidationError);
    assert.match(error.message, new RegExp(variable));

    if (forbiddenText !== undefined) {
      assert.equal(error.message.includes(forbiddenText), false);
    }

    return true;
  });
}

test("uses development defaults when optional variables are absent", () => {
  const config = loadAppConfig({});

  assert.equal(config.nodeEnv, "development");
  assert.equal(config.isDevelopment, true);
  assert.equal(config.isTest, false);
  assert.equal(config.isProduction, false);
  assert.equal(config.port, 3001);
  assert.deepEqual(config.webOrigins, ["http://localhost:3000"]);
});

test("parses explicit test configuration and comma-separated origins", () => {
  const config = loadAppConfig({
    NODE_ENV: "test",
    PORT: "4100",
    WEB_ORIGIN:
      " https://app.example, https://admin.example/ ",
  });

  assert.equal(config.nodeEnv, "test");
  assert.equal(config.isTest, true);
  assert.equal(config.port, 4100);
  assert.deepEqual(config.webOrigins, [
    "https://app.example",
    "https://admin.example",
  ]);
});

test("parses valid production configuration", () => {
  const config = loadAppConfig({
    NODE_ENV: "production",
    PORT: "8080",
    WEB_ORIGIN: "https://carry.example",
  });

  assert.equal(config.nodeEnv, "production");
  assert.equal(config.isProduction, true);
  assert.equal(config.port, 8080);
  assert.deepEqual(config.webOrigins, ["https://carry.example"]);
});

test("requires WEB_ORIGIN in production", () => {
  assertConfigError(
    () => loadAppConfig({ NODE_ENV: "production" }),
    "WEB_ORIGIN",
  );
});

test("rejects an unsupported NODE_ENV without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ NODE_ENV: "staging" }),
    "NODE_ENV",
    "staging",
  );
});

test("rejects a non-numeric PORT without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ PORT: "not-a-port" }),
    "PORT",
    "not-a-port",
  );
});

test("rejects an out-of-range PORT", () => {
  assertConfigError(() => loadAppConfig({ PORT: "70000" }), "PORT", "70000");
});

test("rejects an invalid WEB_ORIGIN with a path", () => {
  assertConfigError(
    () => loadAppConfig({ WEB_ORIGIN: "https://app.example/callback" }),
    "WEB_ORIGIN",
    "app.example",
  );
});

test("rejects non-HTTP WEB_ORIGIN protocols", () => {
  assertConfigError(
    () => loadAppConfig({ WEB_ORIGIN: "ftp://app.example" }),
    "WEB_ORIGIN",
    "ftp://",
  );
});

test("does not echo WEB_ORIGIN credentials in configuration errors", () => {
  assertConfigError(
    () =>
      loadAppConfig({
        WEB_ORIGIN: "https://user:super-secret@example.com",
      }),
    "WEB_ORIGIN",
    "super-secret",
  );
});

test("rejects invalid configuration before Nest starts", async () => {
  await assert.rejects(
    () =>
      createApp({
        env: { NODE_ENV: "production" },
        logger: false,
      }),
    (error) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.match(error.message, /WEB_ORIGIN/);
      return true;
    },
  );
});
