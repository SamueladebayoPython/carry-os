import { z } from "zod";

import {
  DEFAULT_API_PORT,
  DEFAULT_RATE_LIMIT_LIMIT,
  DEFAULT_RATE_LIMIT_TTL_SECONDS,
} from "../app.constants.js";

const emptyStringToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * Shape-only validation for environment variables. Defaults are applied here;
 * semantic validation and safe error messages live in app-config.ts.
 */
export const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default("development"),
  ),
  PORT: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default(String(DEFAULT_API_PORT)),
  ),
  DATABASE_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  WEB_ORIGIN: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  AUTH_ENABLED: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default("false"),
  ),
  AUTH_SESSION_STORE: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default("database"),
  ),
  AUTH_CSRF_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),
  NEAR_AUTH_ISSUER: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  NEAR_AUTH_AUDIENCE: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  NEAR_AUTH_JWKS_URI: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  RATE_LIMIT_LIMIT: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default(String(DEFAULT_RATE_LIMIT_LIMIT)),
  ),
  RATE_LIMIT_TTL_SECONDS: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .default(String(DEFAULT_RATE_LIMIT_TTL_SECONDS)),
  ),
});

export type RawEnvironment = z.infer<typeof envSchema>;
