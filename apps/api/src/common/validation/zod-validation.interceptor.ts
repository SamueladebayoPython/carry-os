import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";

import { REQUEST_VALIDATION_METADATA } from "./request-validation.decorator.js";
import type {
  RequestValidationSchemas,
  RequestValidationTarget,
  ValidatableRequest,
} from "./request-validation.types.js";
import { parseWithZod } from "./zod-validation.js";

@Injectable()
export class ZodValidationInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const schemas = this.reflector.getAllAndOverride<
      RequestValidationSchemas | undefined
    >(REQUEST_VALIDATION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (schemas === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ValidatableRequest>();

    this.validatePart(request, "body", schemas.body);
    this.validatePart(request, "query", schemas.query);
    this.validatePart(request, "params", schemas.params);

    return next.handle();
  }

  private validatePart(
    request: ValidatableRequest,
    target: RequestValidationTarget,
    schema: RequestValidationSchemas[RequestValidationTarget],
  ): void {
    if (schema === undefined) {
      return;
    }

    const validated = parseWithZod(schema, request[target]);

    request.validated = {
      ...request.validated,
      [target]: validated,
    };
    setRequestPart(request, target, validated);
  }
}

/**
 * Replaces the request part with parsed data so controllers receive coerced,
 * stripped, and defaulted values. Express exposes `query` through a getter in
 * some versions, so fall back to defining an own property.
 */
function setRequestPart(
  request: ValidatableRequest,
  target: RequestValidationTarget,
  value: unknown,
): void {
  try {
    request[target] = value;
  } catch {
    Object.defineProperty(request, target, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
}
