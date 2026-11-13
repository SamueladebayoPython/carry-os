export interface ConfigIssue {
  readonly variable: string;
  readonly message: string;
}

/**
 * Safe configuration error. It lists variable names and validation rules but
 * never includes the rejected values, so secrets cannot leak through startup
 * logs or API error responses.
 */
export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    const details = issues
      .map((issue) => `- ${issue.variable}: ${issue.message}`)
      .join("\n");

    super(`Invalid environment configuration.\n${details}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}
