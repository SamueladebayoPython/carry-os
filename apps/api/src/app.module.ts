import { Module, type DynamicModule } from "@nestjs/common";

import { ChainRegistryModule } from "./chain-registry/chain-registry.module.js";
import { ErrorHandlingModule } from "./common/errors/error-handling.module.js";
import { RequestContextModule } from "./common/request-context/request-context.module.js";
import { ValidationModule } from "./common/validation/validation.module.js";
import type { AppConfig } from "./config/app-config.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { HealthModule } from "./health/health.module.js";

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
      ],
    };
  }
}
