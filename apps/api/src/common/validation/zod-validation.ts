import type { ZodIssue, ZodType } from "zod";

import {
  validationError,
  type AppErrorDetail,
} from "../errors/app-error.js";

const MAX_VALIDATION_DETAILS = 20;
const MAX_FIELD_PATH_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 300;
const SAFE_FIELD_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * Structural view of a Zod issue. Only schema-defined, non-submitted fields
 * are read from it; `input` is used solely to distinguish a missing value
 * from a wrong-typed value and is never serialized.
 */
interface IssueLike {
  readonly code?: string;
  readonly path?: readonly PropertyKey[];
  readonly input?: unknown;
  readonly origin?: string;
  readonly minimum?: number | bigint;
  readonly maximum?: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly format?: string;
}

/**
 * Converts Zod issues into safe, structured details. Raw Zod messages are
 * deliberately ignored because refinements can interpolate submitted values.
 */
export function toSafeValidationDetails(
  issues: readonly ZodIssue[],
): readonly AppErrorDetail[] {
  return issues.slice(0, MAX_VALIDATION_DETAILS).map((rawIssue) => {
    const issue = rawIssue as IssueLike;
    const field = formatFieldPath(issue.path ?? []);
    const code =
      typeof issue.code === "string" && issue.code.length > 0
        ? issue.code
        : "invalid_value";

    return {
      ...(field === undefined ? {} : { field }),
      code,
      message: describeIssue(issue),
    };
  });
}

/**
 * Reusable Zod parser for controllers and services. Invalid input becomes an
 * AppError, so all callers share the same centralized error envelope.
 */
export function parseWithZod<T>(
  schema: ZodType<T>,
  value: unknown,
  message = "Request validation failed.",
): T {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw validationError(message, toSafeValidationDetails(result.error.issues));
}

function formatFieldPath(
  path: readonly PropertyKey[],
): string | undefined {
  if (path.length === 0) {
    return undefined;
  }

  return path
    .map(formatFieldSegment)
    .join(".")
    .slice(0, MAX_FIELD_PATH_LENGTH);
}

function formatFieldSegment(segment: PropertyKey): string {
  if (
    typeof segment === "number" &&
    Number.isSafeInteger(segment) &&
    segment >= 0
  ) {
    return String(segment);
  }

  if (typeof segment === "string" && SAFE_FIELD_SEGMENT.test(segment)) {
    return segment;
  }

  return "[field]";
}

function describeIssue(issue: IssueLike): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined
        ? "This field is required."
        : "Invalid type.";
    case "too_small":
      return describeLowerBound(issue);
    case "too_big":
      return describeUpperBound(issue);
    case "invalid_format":
      return describeFormat(issue.format);
    case "invalid_value":
      return "Invalid option.";
    case "unrecognized_keys":
      return "Unrecognized field.";
    default:
      return "Invalid value.";
  }
}

function describeLowerBound(issue: IssueLike): string {
  const bound = formatBound(issue.minimum);

  if (bound === undefined) {
    return "Value is too small.";
  }

  switch (issue.origin) {
    case "string":
      return issue.exact === true
        ? `Must be exactly ${bound} characters.`
        : `Must be at least ${bound} characters.`;
    case "array":
    case "set":
      return `Must contain at least ${bound} items.`;
    case "number":
    case "int":
    case "bigint":
      return issue.inclusive === false
        ? `Must be greater than ${bound}.`
        : `Must be at least ${bound}.`;
    default:
      return "Value is too small.";
  }
}

function describeUpperBound(issue: IssueLike): string {
  const bound = formatBound(issue.maximum);

  if (bound === undefined) {
    return "Value is too large.";
  }

  switch (issue.origin) {
    case "string":
      return issue.exact === true
        ? `Must be exactly ${bound} characters.`
        : `Must be at most ${bound} characters.`;
    case "array":
    case "set":
      return `Must contain at most ${bound} items.`;
    case "number":
    case "int":
    case "bigint":
      return issue.inclusive === false
        ? `Must be less than ${bound}.`
        : `Must be at most ${bound}.`;
    default:
      return "Value is too large.";
  }
}

function describeFormat(format: string | undefined): string {
  switch (format) {
    case "email":
      return "Must be a valid email address.";
    case "uuid":
      return "Must be a valid UUID.";
    case "url":
      return "Must be a valid URL.";
    case "date":
      return "Must be a valid date.";
    case "datetime":
      return "Must be a valid datetime.";
    default:
      return "Invalid format.";
  }
}

function formatBound(
  value: number | bigint | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return String(value).slice(0, MAX_DESCRIPTION_LENGTH);
}
