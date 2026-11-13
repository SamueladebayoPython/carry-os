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

test("registers the wallet linking service without exposing a controller", async () => {
  const application = await NestFactory.createApplicationContext(
    WalletLinkingModule.forRoot({
      verification: {
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "test",
        challengeStore: new InMemoryWalletChallengeStore(),
      },
    }),
    { logger: false },
  );

  try {
    const service = application.get(WalletLinkingService);

    assert.equal(typeof service.linkWallet, "function");
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
