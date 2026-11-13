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
import { WalletLinkingController } from "./wallet-linking.controller.js";
import { PrismaModule } from "../database/prisma.module.js";
import { PrismaService } from "../database/prisma.service.js";
import { PrismaWalletLinkStore } from "./prisma-wallet-link.store.js";
import { AuthModule } from "../auth/auth.module.js";

export interface WalletLinkingModuleOptions {
  /** Verification options, including the trusted domain and adapters. */
  readonly verification: WalletVerificationModuleOptions;
  /**
   * Durable wallet link store. Production rejects the in-memory store because
   * ownership must be protected by a real unique constraint.
   */
  readonly walletLinkStore?: WalletLinkStore;
  readonly usePrismaWalletLinkStore?: boolean;
  readonly clock?: Clock;
}

/**
 * Exposes only session-protected NEAR challenge and wallet-link endpoints.
 */
@Module({})
export class WalletLinkingModule {
  static forRoot(options: WalletLinkingModuleOptions): DynamicModule {
    const nodeEnv = options.verification.nodeEnv;
    const usesPrismaStore =
      options.usePrismaWalletLinkStore === true &&
      options.walletLinkStore === undefined;

    if (
      nodeEnv === "production" &&
      !usesPrismaStore &&
      options.walletLinkStore?.durable !== true
    ) {
      throw new Error(
        "Wallet linking requires a durable wallet link store in production.",
      );
    }

    return {
      module: WalletLinkingModule,
      imports: [
        AuthModule,
        WalletVerificationModule.forRoot(options.verification),
        ...(options.usePrismaWalletLinkStore ? [PrismaModule] : []),
      ],
      controllers: [WalletLinkingController],
      providers: [
        {
          provide: CLOCK,
          useValue:
            options.clock ??
            options.verification.clock ??
            new SystemClock(),
        },
        options.walletLinkStore !== undefined
          ? { provide: WALLET_LINK_STORE, useValue: options.walletLinkStore }
          : options.usePrismaWalletLinkStore === true
            ? {
                provide: WALLET_LINK_STORE,
                inject: [PrismaService],
                useFactory: (prisma: PrismaService | null) =>
                  new PrismaWalletLinkStore(prisma),
              }
            : {
                provide: WALLET_LINK_STORE,
                useValue: new InMemoryWalletLinkStore(),
              },
        WalletLinkingService,
      ],
      exports: [WalletLinkingService],
    };
  }
}
