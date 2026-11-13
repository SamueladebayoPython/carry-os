import { Module, type DynamicModule, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { JsonRpcProvider } from "near-api-js";

import { ChainRegistryModule } from "./chain-registry/chain-registry.module.js";
import { ErrorHandlingModule } from "./common/errors/error-handling.module.js";
import { RequestContextModule } from "./common/request-context/request-context.module.js";
import { ValidationModule } from "./common/validation/validation.module.js";
import type { AppConfig } from "./config/app-config.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { HealthModule } from "./health/health.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { NearChainModule } from "./near-chain/near-chain.module.js";
import { WalletLinkingModule } from "./wallet-linking/wallet-linking.module.js";

function globalRateLimitKey(_context: ExecutionContext, tracker: string, throttlerName: string): string {
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
        NearChainModule,
        ...(config.authEnabled
          ? [
              WalletLinkingModule.forRoot({
                verification: {
                  trustedDomain: config.walletVerificationDomain,
                  nodeEnv: config.nodeEnv,
                  allowLocalHttp: !config.isProduction,
                  usePrismaChallengeStore: true,
                  near: {
                    provider: new JsonRpcProvider({
                      url: config.nearTestnetRpcUrl,
                    }),
                  },
                },
                usePrismaWalletLinkStore: true,
              }),
            ]
          : []),
        ThrottlerModule.forRoot({
          throttlers: [{ limit: config.rateLimit.limit, ttl: config.rateLimit.ttlMs }],
          generateKey: globalRateLimitKey,
        }),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
