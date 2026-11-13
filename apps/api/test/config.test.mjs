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
  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.authEnabled, false);
  assert.equal(config.authSessionStore, "database");
  assert.equal(config.authCsrfSecret, undefined);
  assert.equal(config.nearAuthIssuer, undefined);
  assert.equal(config.nearAuthAudience, undefined);
  assert.equal(config.nearAuthJwksUri, undefined);
  assert.deepEqual(config.rateLimit, { limit: 100, ttlMs: 60_000 });
});

test("parses explicit test configuration and comma-separated origins", () => {
  const config = loadAppConfig({
    NODE_ENV: "test",
    PORT: "4100",
    WEB_ORIGIN:
      " https://app.example, https://admin.example/ ",
    RATE_LIMIT_LIMIT: "250",
    RATE_LIMIT_TTL_SECONDS: "30",
  });

  assert.equal(config.nodeEnv, "test");
  assert.equal(config.isTest, true);
  assert.equal(config.port, 4100);
  assert.deepEqual(config.webOrigins, [
    "https://app.example",
    "https://admin.example",
  ]);
  assert.deepEqual(config.rateLimit, { limit: 250, ttlMs: 30_000 });
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

test("requires PostgreSQL before authentication can be enabled", () => {
  assertConfigError(
    () => loadAppConfig({ AUTH_ENABLED: "true" }),
    "DATABASE_URL",
  );
});

test("rejects non-database session storage", () => {
  assertConfigError(
    () => loadAppConfig({ AUTH_SESSION_STORE: "memory" }),
    "AUTH_SESSION_STORE",
  );
});

test("parses enabled authentication and database configuration", () => {
  const config = loadAppConfig({
    AUTH_ENABLED: "true",
    AUTH_SESSION_STORE: "database",
    DATABASE_URL: "postgresql://user:secret@db.example:5432/carry",
    AUTH_CSRF_SECRET: "a".repeat(32),
    NEAR_AUTH_ISSUER: "https://auth.example",
    NEAR_AUTH_AUDIENCE: "carry-os",
    NEAR_AUTH_JWKS_URI: "https://auth.example/.well-known/jwks.json",
  });

  assert.equal(config.authEnabled, true);
  assert.equal(config.authSessionStore, "database");
  assert.equal(
    config.databaseUrl,
    "postgresql://user:secret@db.example:5432/carry",
  );
  assert.equal(config.authCsrfSecret, "a".repeat(32));
  assert.equal(config.nearAuthIssuer, "https://auth.example");
  assert.equal(config.nearAuthAudience, "carry-os");
  assert.equal(
    config.nearAuthJwksUri,
    "https://auth.example/.well-known/jwks.json",
  );
});

test("treats blank authentication and database values as unset", () => {
  const config = loadAppConfig({
    DATABASE_URL: "   ",
    AUTH_ENABLED: "",
    AUTH_SESSION_STORE: "",
    AUTH_CSRF_SECRET: "   ",
    NEAR_AUTH_ISSUER: "",
    NEAR_AUTH_AUDIENCE: "   ",
    NEAR_AUTH_JWKS_URI: "",
  });

  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.authEnabled, false);
  assert.equal(config.authSessionStore, "database");
  assert.equal(config.authCsrfSecret, undefined);
  assert.equal(config.nearAuthIssuer, undefined);
  assert.equal(config.nearAuthAudience, undefined);
  assert.equal(config.nearAuthJwksUri, undefined);
});

test("rejects invalid authentication configuration", () => {
  const validAuthentication = {
    AUTH_ENABLED: "true",
    DATABASE_URL: "postgresql://user:secret@db.example:5432/carry",
    AUTH_CSRF_SECRET: "a".repeat(32),
    NEAR_AUTH_ISSUER: "https://auth.example",
    NEAR_AUTH_AUDIENCE: "carry-os",
    NEAR_AUTH_JWKS_URI: "https://auth.example/.well-known/jwks.json",
  };

  assertConfigError(
    () => loadAppConfig({ ...validAuthentication, AUTH_ENABLED: "yes" }),
    "AUTH_ENABLED",
    "yes",
  );
  assertConfigError(
    () =>
      loadAppConfig({
        ...validAuthentication,
        DATABASE_URL: "mysql://db.example/carry",
      }),
    "DATABASE_URL",
    "mysql://",
  );
  assertConfigError(
    () =>
      loadAppConfig({
        ...validAuthentication,
        AUTH_CSRF_SECRET: "too-short",
      }),
    "AUTH_CSRF_SECRET",
    "too-short",
  );
  assertConfigError(
    () => loadAppConfig({ ...validAuthentication, NEAR_AUTH_ISSUER: "" }),
    "NEAR_AUTH_ISSUER",
  );
  assertConfigError(
    () =>
      loadAppConfig({
        ...validAuthentication,
        NEAR_AUTH_JWKS_URI: "not-a-url",
      }),
    "NEAR_AUTH_JWKS_URI",
    "not-a-url",
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

test("uses rate-limit defaults when the variables are blank", () => {
  const config = loadAppConfig({
    RATE_LIMIT_LIMIT: "",
    RATE_LIMIT_TTL_SECONDS: "   ",
  });

  assert.deepEqual(config.rateLimit, { limit: 100, ttlMs: 60_000 });
});

test("converts the rate-limit window from seconds to milliseconds", () => {
  const config = loadAppConfig({ RATE_LIMIT_TTL_SECONDS: "90" });

  assert.equal(config.rateLimit.ttlMs, 90_000);
});

test("accepts the documented maximum rate-limit values", () => {
  const config = loadAppConfig({
    RATE_LIMIT_LIMIT: "100000",
    RATE_LIMIT_TTL_SECONDS: "86400",
  });

  assert.deepEqual(config.rateLimit, {
    limit: 100_000,
    ttlMs: 86_400_000,
  });
});

test("accepts the documented minimum rate-limit values", () => {
  const config = loadAppConfig({
    RATE_LIMIT_LIMIT: "1",
    RATE_LIMIT_TTL_SECONDS: "1",
  });

  assert.deepEqual(config.rateLimit, {
    limit: 1,
    ttlMs: 1_000,
  });
});

test("rejects a non-integer RATE_LIMIT_LIMIT without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_LIMIT: "not-a-limit" }),
    "RATE_LIMIT_LIMIT",
    "not-a-limit",
  );
});

test("rejects a fractional RATE_LIMIT_LIMIT without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_LIMIT: "1.5" }),
    "RATE_LIMIT_LIMIT",
    "1.5",
  );
});

test("rejects a zero RATE_LIMIT_LIMIT", () => {
  assert.throws(
    () => loadAppConfig({ RATE_LIMIT_LIMIT: "0" }),
    (error) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.match(
        error.message,
        /RATE_LIMIT_LIMIT: must be an integer between 1 and 100000\./,
      );
      return true;
    },
  );
});

test("rejects a negative RATE_LIMIT_LIMIT without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_LIMIT: "-5" }),
    "RATE_LIMIT_LIMIT",
    "-5",
  );
});

test("rejects a RATE_LIMIT_LIMIT above the documented bound", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_LIMIT: "100001" }),
    "RATE_LIMIT_LIMIT",
    "100001",
  );
});

test("rejects a non-integer RATE_LIMIT_TTL_SECONDS without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_TTL_SECONDS: "15s" }),
    "RATE_LIMIT_TTL_SECONDS",
    "15s",
  );
});

test("rejects a zero RATE_LIMIT_TTL_SECONDS", () => {
  assert.throws(
    () => loadAppConfig({ RATE_LIMIT_TTL_SECONDS: "0" }),
    (error) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.match(
        error.message,
        /RATE_LIMIT_TTL_SECONDS: must be an integer between 1 and 86400\./,
      );
      return true;
    },
  );
});

test("rejects a negative RATE_LIMIT_TTL_SECONDS without echoing the value", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_TTL_SECONDS: "-1" }),
    "RATE_LIMIT_TTL_SECONDS",
    "-1",
  );
});

test("rejects a RATE_LIMIT_TTL_SECONDS above the documented bound", () => {
  assertConfigError(
    () => loadAppConfig({ RATE_LIMIT_TTL_SECONDS: "86401" }),
    "RATE_LIMIT_TTL_SECONDS",
    "86401",
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
