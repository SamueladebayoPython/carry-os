import { Global, Module, type DynamicModule } from "@nestjs/common";

import type { AppConfig } from "./app-config.js";
import { APP_CONFIG, AppConfigService } from "./app-config.service.js";

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppConfigModule,
      global: true,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        AppConfigService,
      ],
      exports: [APP_CONFIG, AppConfigService],
    };
  }
}
