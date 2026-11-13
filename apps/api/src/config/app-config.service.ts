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

  get databaseUrl(): string | undefined {
    return this.config.databaseUrl;
  }

  get webOrigins(): readonly string[] {
    return this.config.webOrigins;
  }

  get authEnabled(): boolean { return this.config.authEnabled; }
  get authSessionStore(): "database" { return this.config.authSessionStore; }
  get authCsrfSecret(): string | undefined { return this.config.authCsrfSecret; }
  get nearAuthIssuer(): string | undefined { return this.config.nearAuthIssuer; }
  get nearAuthAudience(): string | undefined { return this.config.nearAuthAudience; }
  get nearAuthJwksUri(): string | undefined { return this.config.nearAuthJwksUri; }
  get nearTestnetRpcUrl(): string { return this.config.nearTestnetRpcUrl; }
  get nearVaultAccountId(): string | undefined { return this.config.nearVaultAccountId; }
  get nearDemoNftAccountId(): string | undefined { return this.config.nearDemoNftAccountId; }
  get rateLimit() { return this.config.rateLimit; }
}
