import { DEFAULT_API_PORT } from "../app.constants.js";
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

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly isProduction: boolean;
  readonly port: number;
  readonly webOrigins: readonly string[];
}

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return (nodeEnvironments as readonly string[]).includes(value);
}

function parsePort(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(port) || port < 1 || port > MAX_PORT) {
    return undefined;
  }

  return port;
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

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
    isProduction: nodeEnv === "production",
    port,
    webOrigins,
  };
}
