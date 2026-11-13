const REDACTED = "[redacted]";

const REDACTION_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly replacement: string;
}> = [
  // Credentials embedded in URLs, e.g. postgres://user:secret@host/db.
  {
    pattern: /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi,
    replacement: `$1${REDACTED}@`,
  },
  // PEM-encoded private keys.
  {
    pattern:
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
    replacement: REDACTED,
  },
  // Bearer tokens.
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: `Bearer ${REDACTED}`,
  },
  // Common secret-bearing key/value pairs, including JSON-style keys.
  {
    pattern:
      /\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|authorization|cookie)\b["']?\s*[:=]\s*["']?[^"',}\s]+/gi,
    replacement: `$1=${REDACTED}`,
  },
];

/**
 * Removes common credential and token shapes from free-form debug text.
 * This is a defence-in-depth measure; callers must still avoid passing
 * sensitive values into errors in the first place.
 */
export function redactSensitiveText(value: string): string {
  return REDACTION_PATTERNS.reduce(
    (current, { pattern, replacement }) =>
      current.replace(pattern, replacement),
    value,
  );
}
