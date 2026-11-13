import { SetMetadata, type CustomDecorator } from "@nestjs/common";

import type { RequestValidationSchemas } from "./request-validation.types.js";

export const REQUEST_VALIDATION_METADATA = "carry-os:request-validation";

/**
 * Attaches Zod schemas to a controller or route handler. The global
 * validation interceptor reads this metadata and validates the selected
 * request parts before the handler runs.
 */
export function ValidateRequest(
  schemas: RequestValidationSchemas,
): CustomDecorator {
  return SetMetadata(REQUEST_VALIDATION_METADATA, schemas);
}
