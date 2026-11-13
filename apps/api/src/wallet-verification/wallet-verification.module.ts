import { Module, type DynamicModule } from "@nestjs/common";

import {
  WALLET_VERIFICATION_ADAPTERS,
  WalletVerificationAdapterRegistry,
} from "./adapters/wallet-verification-adapter.registry.js";
import {
  NearWalletVerificationAdapter,
  type NearWalletVerificationAdapterOptions,
} from "./adapters/near-wallet-verification.adapter.js";
import type { WalletVerificationAdapter } from "./adapters/wallet-verification-adapter.js";
import { WalletChallengeService } from "./challenge.service.js";
import {
  WALLET_CHALLENGE_STORE,
  type WalletChallengeStore,
} from "./challenge.store.js";
import type { NodeEnvironment } from "../config/app-config.js";
import { CLOCK, SystemClock, type Clock } from "./clock.js";
import { InMemoryWalletChallengeStore } from "./in-memory-challenge.store.js";
import {
  WALLET_VERIFICATION_CONFIG,
  createWalletVerificationConfig,
} from "./wallet-verification.config.js";
import { WalletVerificationService } from "./wallet-verification.service.js";

export interface WalletVerificationModuleOptions {
  /** Trusted server-side application domain. Required; never client-supplied. */
  readonly trustedDomain: string;
  readonly challengeTtlMs?: number;
  readonly allowLocalHttp?: boolean;
  readonly nodeEnv: NodeEnvironment;
  readonly clock?: Clock;
  /**
   * Shared challenge store. Production rejects `InMemoryWalletChallengeStore`;
   * a separately implemented shared store is required there.
   */
  readonly challengeStore?: WalletChallengeStore;
  readonly adapters?: readonly WalletVerificationAdapter[];
  /**
   * Registers the real NEAR NEP-413 adapter. The provider is server
   * configuration; the recipient defaults to the module trusted domain.
   */
  readonly near?: {
    readonly provider: NearWalletVerificationAdapterOptions["provider"];
    readonly trustedDomain?: string;
  };
}

/**
 * Internal module only. It has no controller and must not be registered in
 * AppModule until public API contracts are approved.
 */
@Module({})
export class WalletVerificationModule {
  static forRoot(
    options: WalletVerificationModuleOptions,
  ): DynamicModule {
    const nodeEnv = requireNodeEnvironment(options.nodeEnv);

    if (
      nodeEnv === "production" &&
      (options.challengeStore === undefined ||
        options.challengeStore instanceof InMemoryWalletChallengeStore)
    ) {
      throw new Error(
        "Wallet verification requires a shared challenge store in production. The in-memory store is development/test only.",
      );
    }

    const allowLocalHttp =
      nodeEnv !== "production" &&
      options.allowLocalHttp === true;
    const walletConfig = createWalletVerificationConfig({
      trustedDomain: options.trustedDomain,
      challengeTtlMs: options.challengeTtlMs,
      allowLocalHttp,
    });
    const adapters = [...(options.adapters ?? [])];

    if (options.near !== undefined) {
      adapters.push(
        new NearWalletVerificationAdapter({
          provider: options.near.provider,
          trustedDomain: resolveNearTrustedDomain(
            options.near.trustedDomain,
            walletConfig.trustedDomain,
            allowLocalHttp,
          ),
        }),
      );
    }

    return {
      module: WalletVerificationModule,
      providers: [
        {
          provide: WALLET_VERIFICATION_CONFIG,
          useValue: walletConfig,
        },
        {
          provide: CLOCK,
          useValue: options.clock ?? new SystemClock(),
        },
        {
          provide: WALLET_CHALLENGE_STORE,
          useValue:
            options.challengeStore ?? new InMemoryWalletChallengeStore(),
        },
        {
          provide: WALLET_VERIFICATION_ADAPTERS,
          useValue: adapters,
        },
        WalletChallengeService,
        WalletVerificationAdapterRegistry,
        WalletVerificationService,
      ],
      exports: [WalletVerificationService],
    };
  }
}

/**
 * The NEP-413 recipient must use exactly the same trusted-domain rules as the
 * main configuration. An optional override is normalized and must still match
 * the configured trusted domain.
 */
function resolveNearTrustedDomain(
  value: string | undefined,
  trustedDomain: string,
  allowLocalHttp: boolean,
): string {
  if (value === undefined) {
    return trustedDomain;
  }

  const nearTrustedDomain = createWalletVerificationConfig({
    trustedDomain: value,
    allowLocalHttp,
  }).trustedDomain;

  if (nearTrustedDomain !== trustedDomain) {
    throw new Error(
      "NEAR NEP-413 recipient must match the wallet verification trusted domain.",
    );
  }

  return nearTrustedDomain;
}

function requireNodeEnvironment(
  explicit: NodeEnvironment | undefined,
): NodeEnvironment {
  if (explicit === undefined) {
    throw new Error(
      "Wallet verification requires an explicit nodeEnv.",
    );
  }

  return explicit;
}
