import { Inject, Injectable } from "@nestjs/common";

import type { AppConfig, NodeEnvironment } from "./app-config.js";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Injectable()
export class AppConfigService {
  constructor(
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
  ) {}

  get nodeEnv(): NodeEnvironment {
    return this.config.nodeEnv;
  }

  get isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  get isTest(): boolean {
    return this.config.isTest;
  }

  get isProduction(): boolean {
    return this.config.isProduction;
  }

  get port(): number {
    return this.config.port;
  }

  get webOrigins(): readonly string[] {
    return this.config.webOrigins;
  }
}
