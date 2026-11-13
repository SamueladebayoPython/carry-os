import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { InMemoryWalletLinkStore } from "../dist/wallet-linking/in-memory-wallet-link.store.js";
import { PrismaWalletLinkStore } from "../dist/wallet-linking/prisma-wallet-link.store.js";
import { WalletLinkingModule } from "../dist/wallet-linking/wallet-linking.module.js";
import { WalletLinkingService } from "../dist/wallet-linking/wallet-linking.service.js";
import { InMemoryWalletChallengeStore } from "../dist/wallet-verification/in-memory-challenge.store.js";

const TRUSTED_DOMAIN = "https://app.carry-os.test";

function createSharedChallengeStore() {
  const challenges = new Map();

  return {
    durable: true,
    async create(challenge) {
      challenges.set(challenge.id, challenge);
    },
    async consume(challengeId) {
      return challenges.has(challengeId)
        ? { status: "already_consumed" }
        : { status: "not_found" };
    },
    async deleteExpired() {
      return 0;
    },
  };
}

function createDurableLinkStore() {
  const wallets = new Map();

  return {
    durable: true,
    async findByAddress(key) {
      return wallets.get(JSON.stringify(key)) ?? null;
    },
    async create(input) {
      const key = JSON.stringify({
        chain: input.chain,
        network: input.network,
        normalizedAddress: input.normalizedAddress,
      });
      const existing = wallets.get(key);

      if (existing !== undefined) {
        return { status: "conflict", wallet: existing };
      }

      const wallet = {
        id: `wallet-${wallets.size + 1}`,
        ...input,
      };
      wallets.set(key, wallet);

      return { status: "created", wallet };
    },
  };
}

test("rejects in-memory wallet link storage in production", () => {
  assert.throws(
    () =>
      WalletLinkingModule.forRoot({
        verification: {
          trustedDomain: TRUSTED_DOMAIN,
          nodeEnv: "production",
          challengeStore: createSharedChallengeStore(),
        },
      }),
    /durable wallet link store in production/,
  );

  assert.throws(
    () =>
      WalletLinkingModule.forRoot({
        verification: {
          trustedDomain: TRUSTED_DOMAIN,
          nodeEnv: "production",
          challengeStore: createSharedChallengeStore(),
        },
        walletLinkStore: new InMemoryWalletLinkStore(),
      }),
    /durable wallet link store in production/,
  );
});

test("accepts a durable wallet link store in production", () => {
  assert.doesNotThrow(() =>
    WalletLinkingModule.forRoot({
      verification: {
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "production",
        challengeStore: createSharedChallengeStore(),
      },
      walletLinkStore: createDurableLinkStore(),
    }),
  );
});

test("production selects Prisma stores and cannot override either with memory", () => {
  assert.doesNotThrow(() =>
    WalletLinkingModule.forRoot({
      verification: {
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "production",
        usePrismaChallengeStore: true,
      },
      usePrismaWalletLinkStore: true,
    }),
  );

  assert.throws(
    () =>
      WalletLinkingModule.forRoot({
        verification: {
          trustedDomain: TRUSTED_DOMAIN,
          nodeEnv: "production",
          usePrismaChallengeStore: true,
          challengeStore: new InMemoryWalletChallengeStore(),
        },
        usePrismaWalletLinkStore: true,
      }),
    /durable challenge store in production/,
  );

  assert.throws(
    () =>
      WalletLinkingModule.forRoot({
        verification: {
          trustedDomain: TRUSTED_DOMAIN,
          nodeEnv: "production",
          usePrismaChallengeStore: true,
        },
        usePrismaWalletLinkStore: true,
        walletLinkStore: new InMemoryWalletLinkStore(),
      }),
    /durable wallet link store in production/,
  );
});

test("application mounts wallet-linking routes only when database-backed auth is enabled", async () => {
  const { AppModule } = await import("../dist/app.module.js");
  const { loadAppConfig } = await import("../dist/config/app-config.js");
  const { AuthModule } = await import("../dist/auth/auth.module.js");
  const { WalletLinkingController } = await import("../dist/wallet-linking/wallet-linking.controller.js");

  const disabled = AppModule.forRoot(loadAppConfig({ AUTH_ENABLED: "false" }));
  assert.equal(
    disabled.imports.some((item) => item?.module === WalletLinkingModule),
    false,
  );

  const enabled = AppModule.forRoot(loadAppConfig({
    NODE_ENV: "production",
    WEB_ORIGIN: "https://app.example",
    AUTH_ENABLED: "true",
    DATABASE_URL: "postgresql://carry:secret@127.0.0.1:5432/carry_os",
    AUTH_CSRF_SECRET: "c".repeat(32),
    NEAR_AUTH_ISSUER: "https://issuer.example",
    NEAR_AUTH_AUDIENCE: "carry-api",
    NEAR_AUTH_JWKS_URI: "https://issuer.example/.well-known/jwks.json",
  }));
  const walletModule = enabled.imports.find(
    (item) => item?.module === WalletLinkingModule,
  );

  assert.ok(walletModule);
  assert.ok(walletModule.controllers.includes(WalletLinkingController));
  assert.equal(walletModule.imports.includes(AuthModule), true);
});

test("registers the wallet linking service and guarded controller", async () => {
  const { AppConfigModule } = await import("../dist/config/app-config.module.js");
  const { loadAppConfig } = await import("../dist/config/app-config.js");
  const { WalletLinkingController } = await import("../dist/wallet-linking/wallet-linking.controller.js");
  const { GUARDS_METADATA } = await import("@nestjs/common/constants");
  const { AuthSessionGuard } = await import("../dist/auth/auth-session.guard.js");
  const { Module } = await import("@nestjs/common");

  class WalletLinkingTestModule {}
  Module({
    imports: [
      AppConfigModule.forRoot(loadAppConfig({ NODE_ENV: "test" })),
      WalletLinkingModule.forRoot({
        verification: {
          trustedDomain: TRUSTED_DOMAIN,
          nodeEnv: "test",
          challengeStore: new InMemoryWalletChallengeStore(),
        },
      }),
    ],
  })(WalletLinkingTestModule);

  const application = await NestFactory.createApplicationContext(
    WalletLinkingTestModule,
    { logger: false },
  );

  try {
    const service = application.get(WalletLinkingService);

    assert.equal(typeof service.linkWallet, "function");
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, WalletLinkingController).includes(AuthSessionGuard));
  } finally {
    await application.close();
  }
});

test("database-backed store fails closed without a configured database", async () => {
  const store = new PrismaWalletLinkStore(null);

  await assert.rejects(
    () =>
      store.findByAddress({
        chain: "near",
        network: "near",
        normalizedAddress: "alice.near",
      }),
    (error) => {
      assert.equal(error.getStatus(), 503);
      return true;
    },
  );

  await assert.rejects(
    () =>
      store.create({
        userId: "carry-user-a",
        chain: "near",
        network: "near",
        address: "alice.near",
        normalizedAddress: "alice.near",
        verifiedAt: new Date(),
      }),
    (error) => {
      assert.equal(error.getStatus(), 503);
      return true;
    },
  );
});

test("database-backed store maps a unique violation to a conflict", async () => {
  const existing = {
    id: "wallet-1",
    userId: "carry-user-a",
    chain: "near",
    network: "near",
    address: "alice.near",
    normalizedAddress: "alice.near",
    verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const prisma = {
    linkedWallet: {
      async create() {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      },
      async findUnique() {
        return existing;
      },
    },
  };
  const store = new PrismaWalletLinkStore(prisma);

  const result = await store.create({
    userId: "carry-user-b",
    chain: "near",
    network: "near",
    address: "alice.near",
    normalizedAddress: "alice.near",
    verifiedAt: new Date(),
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.wallet.userId, "carry-user-a");
});

test("database-backed store propagates non-unique database errors", async () => {
  const failure = new Error("database unavailable");
  const prisma = {
    linkedWallet: {
      async create() {
        throw failure;
      },
      async findUnique() {
        return null;
      },
    },
  };
  const store = new PrismaWalletLinkStore(prisma);

  await assert.rejects(
    () =>
      store.create({
        userId: "carry-user-a",
        chain: "near",
        network: "near",
        address: "alice.near",
        normalizedAddress: "alice.near",
        verifiedAt: new Date(),
      }),
    (error) => error === failure,
  );
});
