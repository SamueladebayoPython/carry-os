import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  DEFAULT_WALLET_CHALLENGE_TTL_MS,
  MAX_WALLET_CHALLENGE_TTL_MS,
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "../dist/wallet-verification/wallet-verification.constants.js";
import {
  WalletVerificationAdapterRegistry,
} from "../dist/wallet-verification/adapters/wallet-verification-adapter.registry.js";
import { buildWalletChallengeMessage } from "../dist/wallet-verification/challenge.message.js";
import { WalletChallengeService } from "../dist/wallet-verification/challenge.service.js";
import { InMemoryWalletChallengeStore } from "../dist/wallet-verification/in-memory-challenge.store.js";
import {
  createWalletVerificationConfig,
} from "../dist/wallet-verification/wallet-verification.config.js";
import { WalletVerificationModule } from "../dist/wallet-verification/wallet-verification.module.js";
import { WalletVerificationService } from "../dist/wallet-verification/wallet-verification.service.js";
import { FakeWalletVerificationAdapter } from "./support/fake-wallet-verification.adapter.mjs";

const INITIAL_TIME = new Date("2026-01-01T00:00:00.000Z");
const TRUSTED_DOMAIN = "https://app.carry-os.test";
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function createClock(initial = INITIAL_TIME) {
  let current = new Date(initial.getTime());

  return {
    now() {
      return new Date(current.getTime());
    },
    advance(milliseconds) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

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

function createHarness({
  ttlMs,
  trustedDomain = TRUSTED_DOMAIN,
  verifyPredicate = () => true,
  clock = createClock(),
  store = new InMemoryWalletChallengeStore(),
  adapters,
} = {}) {
  const fake = new FakeWalletVerificationAdapter({ verifyPredicate });
  const config = createWalletVerificationConfig({
    trustedDomain,
    challengeTtlMs: ttlMs,
  });
  const challengeService = new WalletChallengeService(clock, store, config);
  const registry = new WalletVerificationAdapterRegistry(
    adapters ?? [fake],
  );
  const service = new WalletVerificationService(
    challengeService,
    registry,
    clock,
  );

  return {
    service,
    challengeService,
    registry,
    store,
    clock,
    fake,
    config,
  };
}

test("issues a challenge with the required fields and normalized address", async () => {
  const { service } = createHarness();

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "  FAKE_ALICE  ",
  });

  assert.equal(challenge.network, "ethereum");
  assert.equal(challenge.address, "fake_alice");
  assert.equal(
    challenge.purpose,
    WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
  );
  assert.equal(
    challenge.messageVersion,
    WALLET_CHALLENGE_MESSAGE_VERSION,
  );
  assert.equal(challenge.consumedAt, null);
  assert.equal(challenge.issuedAt.toISOString(), INITIAL_TIME.toISOString());
  assert.equal(
    challenge.expiresAt.getTime() - challenge.issuedAt.getTime(),
    DEFAULT_WALLET_CHALLENGE_TTL_MS,
  );
  assert.equal(typeof challenge.id, "string");
  assert.equal(typeof challenge.nonce, "string");
  assert.equal(typeof challenge.message, "string");
});

test("generates opaque UUID challenge IDs and 256-bit nonces", async () => {
  const { service } = createHarness();

  const first = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });
  const second = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  assert.match(first.id, UUID_V4_PATTERN);
  assert.match(second.id, UUID_V4_PATTERN);
  assert.match(first.nonce, NONCE_PATTERN);
  assert.match(second.nonce, NONCE_PATTERN);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.nonce, second.nonce);
});

test("binds the message to purpose, trusted domain, network, address, nonce and expiry", async () => {
  const { service } = createHarness();

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    domain: "https://attacker.test",
  });
  const payload = JSON.parse(challenge.message);

  assert.deepEqual(payload, {
    version: WALLET_CHALLENGE_MESSAGE_VERSION,
    purpose: WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
    domain: TRUSTED_DOMAIN,
    network: "ethereum",
    address: "fake_alice",
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt.toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
  });
  assert.notEqual(payload.domain, "https://attacker.test");
});

test("supports a configurable challenge lifetime", async () => {
  const { service } = createHarness({ ttlMs: 30_000 });

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  assert.equal(
    challenge.expiresAt.getTime() - challenge.issuedAt.getTime(),
    30_000,
  );
});

test("normalizes addresses through the adapter and rejects invalid addresses", async () => {
  const { service } = createHarness();

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: " FAKE_Bob ",
  });

  assert.equal(challenge.address, "fake_bob");

  await assert.rejects(
    () =>
      service.issueChallenge({
        network: "ethereum",
        address: "not a wallet address",
      }),
    (error) => {
      assert.equal(error.name, "AppError");
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.getStatus(), 400);
      return true;
    },
  );
});

test("verifies a valid signature with the fake adapter", async () => {
  const { service, fake } = createHarness({
    verifyPredicate: ({ signature }) => signature === "valid-signature",
  });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const result = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(result.status, "verified");
  assert.equal(result.challengeId, challenge.id);
  assert.equal(result.network, "ethereum");
  assert.equal(result.address, "fake_alice");
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].address, "fake_alice");
  assert.equal(fake.calls[0].message, challenge.message);
  assert.equal(fake.calls[0].signature, "valid-signature");
});

test("returns invalid_signature and burns the challenge on failed verification", async () => {
  const { service, fake } = createHarness({
    verifyPredicate: ({ signature }) => signature === "valid-signature",
  });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const failed = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "invalid-signature",
  });
  const retry = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(failed.status, "invalid_signature");
  assert.equal(retry.status, "already_consumed");
  assert.equal(fake.calls.length, 1);
});

test("distinguishes an unknown challenge ID", async () => {
  const { service, fake } = createHarness();
  const challengeId = randomUUID();

  const result = await service.verifyChallenge({
    challengeId,
    signature: "any-signature",
  });

  assert.deepEqual(result, { status: "not_found", challengeId });
  assert.equal(fake.calls.length, 0);
});

test("distinguishes an expired challenge without consuming it", async () => {
  const { service, clock, fake } = createHarness();
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  clock.advance(DEFAULT_WALLET_CHALLENGE_TTL_MS + 1);

  const first = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });
  const second = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(first.status, "expired");
  assert.equal(second.status, "expired");
  assert.equal(fake.calls.length, 0);
});

test("rejects a replayed challenge after successful verification", async () => {
  const { service, fake } = createHarness();
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const first = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });
  const replay = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(first.status, "verified");
  assert.equal(replay.status, "already_consumed");
  assert.equal(fake.calls.length, 1);
});

test("allows only one of several concurrent attempts to consume a challenge", async () => {
  const { service, fake } = createHarness();
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      service.verifyChallenge({
        challengeId: challenge.id,
        signature: "valid-signature",
      }),
    ),
  );
  const statuses = results.map((result) => result.status);

  assert.equal(
    statuses.filter((status) => status === "verified").length,
    1,
  );
  assert.equal(
    statuses.filter((status) => status === "already_consumed").length,
    4,
  );
  assert.equal(fake.calls.length, 1);
});

test("fails closed for unsupported and unknown networks", async () => {
  const { service, fake } = createHarness();

  for (const network of ["solana", "not-a-network"]) {
    await assert.rejects(
      () =>
        service.issueChallenge({
          network,
          address: "fake_alice",
        }),
      (error) => {
        assert.equal(error.name, "AppError");
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  }

  assert.equal(fake.calls.length, 0);
});

test("ignores client-supplied network and address during verification", async () => {
  const { service, fake } = createHarness({
    verifyPredicate: ({ address, message, signature }) => {
      const payload = JSON.parse(message);

      return (
        signature === "valid-signature" &&
        address === "fake_alice" &&
        payload.network === "ethereum" &&
        payload.address === "fake_alice"
      );
    },
  });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const result = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
    network: "solana",
    address: "fake_mallory",
  });

  assert.equal(result.status, "verified");
  assert.equal(result.network, "ethereum");
  assert.equal(result.address, "fake_alice");
  assert.equal(fake.calls[0].address, "fake_alice");
  assert.equal(
    JSON.parse(fake.calls[0].message).network,
    "ethereum",
  );
});

test("cleans up expired challenges and leaves active challenges usable", async () => {
  const { service, clock } = createHarness();
  const expired = await service.issueChallenge({
    network: "ethereum",
    address: "fake_expired",
  });

  clock.advance(DEFAULT_WALLET_CHALLENGE_TTL_MS + 1);

  const active = await service.issueChallenge({
    network: "ethereum",
    address: "fake_active",
  });
  const deleted = await service.cleanupExpiredChallenges();

  assert.equal(deleted, 1);

  const expiredResult = await service.verifyChallenge({
    challengeId: expired.id,
    signature: "valid-signature",
  });
  const activeResult = await service.verifyChallenge({
    challengeId: active.id,
    signature: "valid-signature",
  });

  assert.equal(expiredResult.status, "not_found");
  assert.equal(activeResult.status, "verified");
});

test("adapter failures fail closed after the challenge is consumed", async () => {
  const { service } = createHarness({
    verifyPredicate: () => {
      throw new Error("adapter failure");
    },
  });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  await assert.rejects(
    () =>
      service.verifyChallenge({
        challengeId: challenge.id,
        signature: "any-signature",
      }),
    (error) => {
      assert.equal(error.name, "AppError");
      assert.equal(error.code, "INTERNAL_SERVER_ERROR");
      assert.equal(error.getStatus(), 500);
      return true;
    },
  );

  const retry = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "any-signature",
  });

  assert.equal(retry.status, "already_consumed");
});

test("rejects truthy non-boolean and undefined adapter results as contract violations", async () => {
  for (const adapterResult of [
    "true",
    "not-a-boolean",
    {},
    1,
    undefined,
  ]) {
    const { service } = createHarness({
      verifyPredicate: () => adapterResult,
    });
    const challenge = await service.issueChallenge({
      network: "ethereum",
      address: "fake_alice",
    });

    await assert.rejects(
      () =>
        service.verifyChallenge({
          challengeId: challenge.id,
          signature: "any-signature",
        }),
      (error) => {
        assert.equal(error.name, "AppError");
        assert.equal(error.code, "INTERNAL_SERVER_ERROR");
        assert.equal(error.getStatus(), 500);
        return true;
      },
      `adapter result ${JSON.stringify(adapterResult)} must fail closed`,
    );

    const retry = await service.verifyChallenge({
      challengeId: challenge.id,
      signature: "any-signature",
    });

    assert.equal(retry.status, "already_consumed");
  }
});

test("preserves invalid_signature for a literal false adapter result", async () => {
  const { service } = createHarness({
    verifyPredicate: () => false,
  });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  const result = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "any-signature",
  });

  assert.equal(result.status, "invalid_signature");
});

test("rejects a challenge with an unexpected purpose and consumes it", async () => {
  const { service, challengeService, store, fake } = createHarness();
  const issued = await challengeService.issue(fake, "fake_alice");
  const tampered = {
    ...issued,
    id: randomUUID(),
    purpose: "some-other-purpose",
  };

  await store.create(tampered);

  const result = await service.verifyChallenge({
    challengeId: tampered.id,
    signature: "valid-signature",
  });
  const retry = await service.verifyChallenge({
    challengeId: tampered.id,
    signature: "valid-signature",
  });

  assert.equal(result.status, "invalid_signature");
  assert.equal(retry.status, "already_consumed");
  assert.equal(fake.calls.length, 0);
});

test("rejects a challenge with an unsupported message version and consumes it", async () => {
  const { service, challengeService, store, fake } = createHarness();
  const issued = await challengeService.issue(fake, "fake_alice");
  const tampered = {
    ...issued,
    id: randomUUID(),
    messageVersion: "999",
  };

  await store.create(tampered);

  const result = await service.verifyChallenge({
    challengeId: tampered.id,
    signature: "valid-signature",
  });
  const retry = await service.verifyChallenge({
    challengeId: tampered.id,
    signature: "valid-signature",
  });

  assert.equal(result.status, "invalid_signature");
  assert.equal(retry.status, "already_consumed");
  assert.equal(fake.calls.length, 0);
});

test("accepts and normalizes a valid HTTPS trusted domain", () => {
  const config = createWalletVerificationConfig({
    trustedDomain: "https://app.carry-os.test/",
  });

  assert.equal(config.trustedDomain, "https://app.carry-os.test");
});

test("allows HTTP only for explicitly recognized localhost origins", () => {
  for (const trustedDomain of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ]) {
    const config = createWalletVerificationConfig({
      trustedDomain,
      allowLocalHttp: true,
    });

    assert.equal(config.trustedDomain, new URL(trustedDomain).origin);
  }

  assert.throws(
    () =>
      createWalletVerificationConfig({
        trustedDomain: "http://localhost:3000",
      }),
    /must use HTTPS/,
  );
  assert.throws(
    () =>
      createWalletVerificationConfig({
        trustedDomain: "http://app.example",
        allowLocalHttp: true,
      }),
    /localhost/,
  );
});

test("rejects malformed trusted domains", () => {
  const invalidDomains = [
    "",
    "   ",
    "not a url",
    "https://app.example\n",
    "https://app.example ",
    "ftp://app.example",
    "javascript:alert(1)",
    "https://user:pass@app.example",
    "https://app.example/path",
    "https://app.example/?query=1",
    "https://app.example/#fragment",
    `https://${"a".repeat(2048)}.example`,
  ];

  for (const trustedDomain of invalidDomains) {
    assert.throws(
      () => createWalletVerificationConfig({ trustedDomain }),
      Error,
      `expected trusted domain to be rejected: ${JSON.stringify(trustedDomain)}`,
    );
  }
});

test("rejects invalid and excessive challenge TTL values", () => {
  for (const challengeTtlMs of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
    MAX_WALLET_CHALLENGE_TTL_MS + 1,
    "60000",
  ]) {
    assert.throws(
      () =>
        createWalletVerificationConfig({
          trustedDomain: TRUSTED_DOMAIN,
          challengeTtlMs,
        }),
      Error,
      `expected TTL to be rejected: ${String(challengeTtlMs)}`,
    );
  }
});

test("accepts positive challenge TTL values within the maximum", () => {
  for (const challengeTtlMs of [
    1,
    DEFAULT_WALLET_CHALLENGE_TTL_MS,
    MAX_WALLET_CHALLENGE_TTL_MS,
  ]) {
    const config = createWalletVerificationConfig({
      trustedDomain: TRUSTED_DOMAIN,
      challengeTtlMs,
    });

    assert.equal(config.challengeTtlMs, challengeTtlMs);
  }
});

test("fails before storing a challenge when the clock returns an invalid date", async () => {
  for (const clock of [
    { now: () => new Date(Number.NaN) },
    { now: () => "not-a-date" },
  ]) {
    const store = new InMemoryWalletChallengeStore();
    const { challengeService } = createHarness({ clock, store });

    await assert.rejects(
      () => challengeService.issue(new FakeWalletVerificationAdapter(), "fake_alice"),
      (error) => {
        assert.equal(error.code, "INTERNAL_SERVER_ERROR");
        return true;
      },
    );

    assert.equal(await store.deleteExpired(new Date()), 0);
  }
});

test("fails before storing a challenge when the calculated expiry is invalid", async () => {
  const store = new InMemoryWalletChallengeStore();
  const clock = {
    now: () => new Date(8_640_000_000_000_000 - 1_000),
  };
  const { challengeService } = createHarness({ clock, store });

  await assert.rejects(
    () => challengeService.issue(new FakeWalletVerificationAdapter(), "fake_alice"),
    (error) => {
      assert.equal(error.code, "INTERNAL_SERVER_ERROR");
      return true;
    },
  );

  assert.equal(await store.deleteExpired(new Date()), 0);
});

test("rejects invalid normalized addresses before storing a challenge", async () => {
  for (const normalizeAddress of [
    () => undefined,
    () => "",
    () => "   ",
    () => 42,
  ]) {
    const store = new InMemoryWalletChallengeStore();
    const adapter = new FakeWalletVerificationAdapter({ normalizeAddress });
    const { service } = createHarness({ store, adapters: [adapter] });

    await assert.rejects(
      () =>
        service.issueChallenge({
          network: "ethereum",
          address: "fake_alice",
        }),
      (error) => {
        assert.equal(error.code, "INTERNAL_SERVER_ERROR");
        return true;
      },
    );

    assert.equal(await store.deleteExpired(new Date()), 0);
  }
});

test("builds deterministic messages from identical inputs", () => {
  const input = {
    trustedDomain: TRUSTED_DOMAIN,
    network: "ethereum",
    address: "fake_alice",
    nonce: "fixed-nonce",
    issuedAt: INITIAL_TIME,
    expiresAt: new Date(
      INITIAL_TIME.getTime() + DEFAULT_WALLET_CHALLENGE_TTL_MS,
    ),
  };

  assert.equal(
    buildWalletChallengeMessage(input),
    buildWalletChallengeMessage({ ...input }),
  );
});

test("rejects duplicate adapter registrations", () => {
  assert.throws(
    () =>
      new WalletVerificationAdapterRegistry([
        new FakeWalletVerificationAdapter(),
        new FakeWalletVerificationAdapter(),
      ]),
    /Duplicate wallet verification adapter/,
  );
});

test("rejects duplicate challenge creation", async () => {
  const { challengeService, store } = createHarness();
  const challenge = await challengeService.issue(
    new FakeWalletVerificationAdapter(),
    "fake_alice",
  );

  await assert.rejects(
    () => store.create(challenge),
    /Duplicate wallet challenge ID/,
  );
});

test("fails closed when the adapter is missing during verification", async () => {
  const { service, challengeService, clock, fake } = createHarness();
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });
  const serviceWithoutAdapter = new WalletVerificationService(
    challengeService,
    new WalletVerificationAdapterRegistry([]),
    clock,
  );

  await assert.rejects(
    () =>
      serviceWithoutAdapter.verifyChallenge({
        challengeId: challenge.id,
        signature: "valid-signature",
      }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.getStatus(), 400);
      return true;
    },
  );

  const retry = await serviceWithoutAdapter.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(retry.status, "already_consumed");
  assert.equal(fake.calls.length, 0);
});

test("treats the exact expiry instant as expired", async () => {
  const ttlMs = 60_000;
  const { service, clock, fake } = createHarness({ ttlMs });
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  clock.advance(ttlMs);

  const result = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
  });

  assert.equal(result.status, "expired");
  assert.equal(fake.calls.length, 0);
});

test("rejects the in-memory store in production whether default or explicit", () => {
  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "production",
      }),
    /shared challenge store in production/,
  );

  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "production",
        challengeStore: new InMemoryWalletChallengeStore(),
      }),
    /shared challenge store in production/,
  );

  assert.doesNotThrow(() =>
    WalletVerificationModule.forRoot({
      trustedDomain: TRUSTED_DOMAIN,
      nodeEnv: "test",
    }),
  );

  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: "http://localhost:3000",
        nodeEnv: "production",
        allowLocalHttp: true,
        challengeStore: createSharedChallengeStore(),
      }),
    /must use HTTPS/,
  );
});

test("requires an explicit nodeEnv", () => {
  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
      }),
    /explicit nodeEnv/,
  );
});

test("accepts a separately implemented shared challenge store in production", () => {
  const challengeStore = createSharedChallengeStore();

  assert.equal(
    challengeStore instanceof InMemoryWalletChallengeStore,
    false,
  );
  assert.doesNotThrow(() =>
    WalletVerificationModule.forRoot({
      trustedDomain: TRUSTED_DOMAIN,
      nodeEnv: "production",
      challengeStore,
    }),
  );
});
