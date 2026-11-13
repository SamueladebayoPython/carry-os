import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_LENGTH = 36;

/**
 * Canonical UUID format: 36 characters, versions 1-8, RFC 4122 variant.
 * Request IDs are correlation identifiers, not authorization tokens.
 */
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: string): boolean {
  return value.length === REQUEST_ID_LENGTH && REQUEST_ID_PATTERN.test(value);
}

export function normalizeRequestId(value: string): string {
  return value.toLowerCase();
}

/**
 * Accept only a single canonical UUID header value. Anything missing,
 * duplicated, oversized, or malformed is replaced with a generated UUID.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
): string {
  if (typeof incoming !== "string") {
    return randomUUID();
  }

  const candidate = incoming.trim();

  return isValidRequestId(candidate)
    ? normalizeRequestId(candidate)
    : randomUUID();
}
