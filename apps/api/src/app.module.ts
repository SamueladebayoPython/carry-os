import {
  Module,
  type DynamicModule,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { ChainRegistryModule } from "./chain-registry/chain-registry.module.js";
import { ErrorHandlingModule } from "./common/errors/error-handling.module.js";
import { RequestContextModule } from "./common/request-context/request-context.module.js";
import { ValidationModule } from "./common/validation/validation.module.js";
import type { AppConfig } from "./config/app-config.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { HealthModule } from "./health/health.module.js";
import { AuthModule } from "./auth/auth.module.js";

/**
 * Keeps one throttler bucket per client IP across every matched API route. The
 * package default includes the controller and handler names, which would give
 * each route its own independent limit.
 */
function globalRateLimitKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return `${throttlerName}:${tracker}`;
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(config),
        RequestContextModule,
        ErrorHandlingModule,
        ValidationModule,
        ChainRegistryModule,
        HealthModule,
        AuthModule,
        ThrottlerModule.forRoot({
          throttlers: [
            {
              limit: config.rateLimit.limit,
              ttl: config.rateLimit.ttlMs,
            },
          ],
          generateKey: globalRateLimitKey,
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    };
  }
}
