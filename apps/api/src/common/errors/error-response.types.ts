import type { AppErrorCode, AppErrorDetail } from "./app-error.js";

export interface ErrorResponseDetail {
  readonly field?: string;
  readonly code?: string;
  readonly message: string;
}

export interface ErrorResponseDebug {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

/**
 * Stable error envelope returned to API consumers. Optional fields are omitted
 * rather than serialized as null/undefined.
 */
export interface ErrorResponseBody {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly message: string;
  readonly timestamp: string;
  readonly path: string;
  readonly requestId?: string;
  readonly details?: readonly ErrorResponseDetail[];
  readonly debug?: ErrorResponseDebug;
}

export function toErrorResponseDetails(
  details: readonly AppErrorDetail[] | undefined,
): readonly ErrorResponseDetail[] | undefined {
  if (details === undefined || details.length === 0) {
    return undefined;
  }

  return details.map((detail) => ({ ...detail }));
}
