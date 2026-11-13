import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { ZodValidationInterceptor } from "./zod-validation.interceptor.js";

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodValidationInterceptor,
    },
  ],
})
export class ValidationModule {}
