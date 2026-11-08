import type { ZodType } from "zod";

export const requestValidationTargets = [
  "body",
  "query",
  "params",
] as const;

export type RequestValidationTarget =
  (typeof requestValidationTargets)[number];

export interface RequestValidationSchemas {
  readonly body?: ZodType;
  readonly query?: ZodType;
  readonly params?: ZodType;
}

export interface ValidatableRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  validated?: Partial<Record<RequestValidationTarget, unknown>>;
}
