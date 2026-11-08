import { z } from "zod";

import { DEFAULT_API_PORT } from "../app.constants.js";

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
  WEB_ORIGIN: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
});

export type RawEnvironment = z.infer<typeof envSchema>;
