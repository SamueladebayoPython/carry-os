import { Module, type DynamicModule } from "@nestjs/common";

import { CLOCK, SystemClock, type Clock } from "../wallet-verification/clock.js";
import {
  WalletVerificationModule,
  type WalletVerificationModuleOptions,
} from "../wallet-verification/wallet-verification.module.js";
import { InMemoryWalletLinkStore } from "./in-memory-wallet-link.store.js";
import {
  WALLET_LINK_STORE,
  type WalletLinkStore,
} from "./wallet-link.store.js";
import { WalletLinkingService } from "./wallet-linking.service.js";

export interface WalletLinkingModuleOptions {
  /** Verification options, including the trusted domain and adapters. */
  readonly verification: WalletVerificationModuleOptions;
  /**
   * Durable wallet link store. Production rejects the in-memory store because
   * ownership must be protected by a real unique constraint.
   */
  readonly walletLinkStore?: WalletLinkStore;
  readonly clock?: Clock;
}

/**
 * Links wallets to Carry accounts after ownership verification.
 *
 * This module intentionally has no controller. There is no approved public
 * wallet-linking API contract yet, and exposing one before the surrounding
 * account flows are reviewed would be premature.
 */
@Module({})
export class WalletLinkingModule {
  static forRoot(options: WalletLinkingModuleOptions): DynamicModule {
    const nodeEnv = options.verification.nodeEnv;

    if (
      nodeEnv === "production" &&
      (options.walletLinkStore === undefined ||
        options.walletLinkStore instanceof InMemoryWalletLinkStore)
    ) {
      throw new Error(
        "Wallet linking requires a durable wallet link store in production. The in-memory store is development/test only.",
      );
    }

    return {
      module: WalletLinkingModule,
      imports: [WalletVerificationModule.forRoot(options.verification)],
      providers: [
        {
          provide: CLOCK,
          useValue:
            options.clock ??
            options.verification.clock ??
            new SystemClock(),
        },
        {
          provide: WALLET_LINK_STORE,
          useValue:
            options.walletLinkStore ?? new InMemoryWalletLinkStore(),
        },
        WalletLinkingService,
      ],
      exports: [WalletLinkingService],
    };
  }
}
