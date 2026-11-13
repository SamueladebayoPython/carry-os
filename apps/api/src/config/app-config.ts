import {
  DEFAULT_API_PORT,
  DEFAULT_RATE_LIMIT_LIMIT,
  DEFAULT_RATE_LIMIT_TTL_SECONDS,
} from "../app.constants.js";
import {
  ConfigValidationError,
  type ConfigIssue,
} from "./config-validation.error.js";
import { envSchema } from "./env.schema.js";

export const nodeEnvironments = [
  "development",
  "test",
  "production",
] as const;

export type NodeEnvironment = (typeof nodeEnvironments)[number];

export const DEFAULT_WEB_ORIGIN = "http://localhost:3000";

const MAX_PORT = 65535;
export const MAX_RATE_LIMIT_LIMIT = 100_000;
export const MAX_RATE_LIMIT_TTL_SECONDS = 86_400;

export interface RateLimitConfig {
  readonly limit: number;
  readonly ttlMs: number;
}

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly isProduction: boolean;
  readonly port: number;
  readonly databaseUrl?: string;
  readonly webOrigins: readonly string[];
  readonly authEnabled: boolean;
  readonly authSessionStore: "database";
  readonly authCsrfSecret?: string;
  readonly nearAuthIssuer?: string;
  readonly nearAuthAudience?: string;
  readonly nearAuthJwksUri?: string;
  readonly rateLimit: RateLimitConfig;
}

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return (nodeEnvironments as readonly string[]).includes(value);
}

function parseBoundedInteger(
  value: string,
  min: number,
  max: number,
): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

function parsePort(value: string): number | undefined {
  return parseBoundedInteger(value, 1, MAX_PORT);
}

function parseWebOrigins(value: string): {
  origins: string[];
  message?: string;
} {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return { origins: [], message: "must contain at least one origin." };
  }

  const origins: string[] = [];

  for (const entry of entries) {
    let url: URL;

    try {
      url = new URL(entry);
    } catch {
      return {
        origins: [],
        message: "must be a comma-separated list of valid HTTP(S) origins.",
      };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        origins: [],
        message: "must only contain HTTP(S) origins.",
      };
    }

    if (url.username.length > 0 || url.password.length > 0) {
      return { origins: [], message: "must not include credentials." };
    }

    if (url.pathname !== "/" || url.search.length > 0 || url.hash.length > 0) {
      return {
        origins: [],
        message: "must not include paths, queries, or fragments.",
      };
    }

    origins.push(url.origin);
  }

  return { origins: [...new Set(origins)] };
}

/**
 * Load and validate configuration from the supplied environment. The function
 * is pure with respect to process.env, which keeps startup behavior testable.
 */
export function loadAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    throw new ConfigValidationError(
      parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? "environment"),
        message: "must be a string.",
      })),
    );
  }

  const issues: ConfigIssue[] = [];
  const rawNodeEnv = parsed.data.NODE_ENV;
  let nodeEnv: NodeEnvironment = "development";

  if (isNodeEnvironment(rawNodeEnv)) {
    nodeEnv = rawNodeEnv;
  } else {
    issues.push({
      variable: "NODE_ENV",
      message: "must be one of: development, test, production.",
    });
  }

  const parsedPort = parsePort(parsed.data.PORT);
  let port = DEFAULT_API_PORT;

  if (parsedPort === undefined) {
    issues.push({
      variable: "PORT",
      message: `must be an integer between 1 and ${MAX_PORT}.`,
    });
  } else {
    port = parsedPort;
  }

  let webOrigins: string[] = [];

  if (parsed.data.WEB_ORIGIN === undefined) {
    if (rawNodeEnv === "production") {
      issues.push({
        variable: "WEB_ORIGIN",
        message: "is required when NODE_ENV=production.",
      });
    } else {
      webOrigins = [DEFAULT_WEB_ORIGIN];
    }
  } else {
    const parsedOrigins = parseWebOrigins(parsed.data.WEB_ORIGIN);

    if (parsedOrigins.message !== undefined) {
      issues.push({
        variable: "WEB_ORIGIN",
        message: parsedOrigins.message,
      });
    } else {
      webOrigins = parsedOrigins.origins;
    }
  }

  const authEnabled = parsed.data.AUTH_ENABLED === "true";

  if (
    parsed.data.AUTH_ENABLED !== "true" &&
    parsed.data.AUTH_ENABLED !== "false"
  ) {
    issues.push({
      variable: "AUTH_ENABLED",
      message: "must be true or false.",
    });
  }

  if (parsed.data.AUTH_SESSION_STORE !== "database") {
    issues.push({
      variable: "AUTH_SESSION_STORE",
      message: "must be database.",
    });
  }

  if (authEnabled) {
    if (!parsed.data.DATABASE_URL) {
      issues.push({
        variable: "DATABASE_URL",
        message: "is required when AUTH_ENABLED=true.",
      });
    } else {
      try {
        const databaseUrl = new URL(parsed.data.DATABASE_URL);
        if (
          databaseUrl.protocol !== "postgresql:" &&
          databaseUrl.protocol !== "postgres:"
        ) {
          issues.push({
            variable: "DATABASE_URL",
            message: "must be a PostgreSQL connection URL.",
          });
        }
      } catch {
        issues.push({
          variable: "DATABASE_URL",
          message: "must be a valid PostgreSQL connection URL.",
        });
      }
    }

    if (
      !parsed.data.AUTH_CSRF_SECRET ||
      Buffer.byteLength(parsed.data.AUTH_CSRF_SECRET, "utf8") < 32
    ) {
      issues.push({
        variable: "AUTH_CSRF_SECRET",
        message: "must be at least 32 bytes when AUTH_ENABLED=true.",
      });
    }

    for (const variable of [
      "NEAR_AUTH_ISSUER",
      "NEAR_AUTH_AUDIENCE",
      "NEAR_AUTH_JWKS_URI",
    ] as const) {
      if (!parsed.data[variable]) {
        issues.push({
          variable,
          message: "is required when AUTH_ENABLED=true.",
        });
      }
    }

    if (parsed.data.NEAR_AUTH_JWKS_URI) {
      try {
        const jwksUrl = new URL(parsed.data.NEAR_AUTH_JWKS_URI);
        if (
          jwksUrl.protocol !== "https:" &&
          !(nodeEnv !== "production" && jwksUrl.protocol === "http:")
        ) {
          issues.push({
            variable: "NEAR_AUTH_JWKS_URI",
            message:
              "must use HTTPS (HTTP is allowed only outside production).",
          });
        }
      } catch {
        issues.push({
          variable: "NEAR_AUTH_JWKS_URI",
          message: "must be a valid URL.",
        });
      }
    }
  }

  const parsedRateLimitLimit = parseBoundedInteger(
    parsed.data.RATE_LIMIT_LIMIT,
    1,
    MAX_RATE_LIMIT_LIMIT,
  );
  let rateLimitLimit = DEFAULT_RATE_LIMIT_LIMIT;

  if (parsedRateLimitLimit === undefined) {
    issues.push({
      variable: "RATE_LIMIT_LIMIT",
      message: `must be an integer between 1 and ${MAX_RATE_LIMIT_LIMIT}.`,
    });
  } else {
    rateLimitLimit = parsedRateLimitLimit;
  }

  const parsedRateLimitTtlSeconds = parseBoundedInteger(
    parsed.data.RATE_LIMIT_TTL_SECONDS,
    1,
    MAX_RATE_LIMIT_TTL_SECONDS,
  );
  let rateLimitTtlSeconds = DEFAULT_RATE_LIMIT_TTL_SECONDS;

  if (parsedRateLimitTtlSeconds === undefined) {
    issues.push({
      variable: "RATE_LIMIT_TTL_SECONDS",
      message: `must be an integer between 1 and ${MAX_RATE_LIMIT_TTL_SECONDS}.`,
    });
  } else {
    rateLimitTtlSeconds = parsedRateLimitTtlSeconds;
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
    isProduction: nodeEnv === "production",
    port,
    databaseUrl: parsed.data.DATABASE_URL,
    webOrigins,
    authEnabled,
    authSessionStore: "database",
    authCsrfSecret: parsed.data.AUTH_CSRF_SECRET,
    nearAuthIssuer: parsed.data.NEAR_AUTH_ISSUER,
    nearAuthAudience: parsed.data.NEAR_AUTH_AUDIENCE,
    nearAuthJwksUri: parsed.data.NEAR_AUTH_JWKS_URI,
    rateLimit: {
      limit: rateLimitLimit,
      ttlMs: rateLimitTtlSeconds * 1000,
    },
  };
}
