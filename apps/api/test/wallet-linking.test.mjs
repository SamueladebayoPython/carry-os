import assert from "node:assert/strict";
import test from "node:test";

import { WalletChallengeService } from "../dist/wallet-verification/challenge.service.js";
import { createWalletVerificationConfig } from "../dist/wallet-verification/wallet-verification.config.js";
import { InMemoryWalletChallengeStore } from "../dist/wallet-verification/in-memory-challenge.store.js";
import { WalletVerificationAdapterRegistry } from "../dist/wallet-verification/adapters/wallet-verification-adapter.registry.js";
import { WalletVerificationService } from "../dist/wallet-verification/wallet-verification.service.js";
import { InMemoryWalletLinkStore } from "../dist/wallet-linking/in-memory-wallet-link.store.js";
import { WalletLinkingService } from "../dist/wallet-linking/wallet-linking.service.js";
import { FakeWalletVerificationAdapter } from "./support/fake-wallet-verification.adapter.mjs";

const TRUSTED_DOMAIN = "https://app.carry-os.test";
const INITIAL_TIME = new Date("2026-01-01T00:00:00.000Z");
const TTL_MS = 5 * 60 * 1000;
const USER_A = "carry-user-a";
const USER_B = "carry-user-b";

function createClock(initial = INITIAL_TIME) {
  let current = new Date(initial.getTime());

  return {
    now: () => new Date(current.getTime()),
    advance(milliseconds) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function createHarness({ verifyPredicate = () => true } = {}) {
  const clock = createClock();
  const challengeStore = new InMemoryWalletChallengeStore();
  const config = createWalletVerificationConfig({
    trustedDomain: TRUSTED_DOMAIN,
  });
  const challenges = new WalletChallengeService(clock, challengeStore, config);
  const registry = new WalletVerificationAdapterRegistry([
    new FakeWalletVerificationAdapter({ verifyPredicate }),
  ]);
  const verification = new WalletVerificationService(
    challenges,
    registry,
    clock,
  );
  const linkStore = new InMemoryWalletLinkStore();
  const linking = new WalletLinkingService(verification, linkStore, clock);

  return {
    verification,
    linking,
    challengeStore,
    linkStore,
    clock,
  };
}

function issue(verification, address, subject) {
  return verification.issueChallenge({
    network: "ethereum",
    address,
    subject,
  });
}

function assertAppError(code, status) {
  return (error) => {
    assert.equal(error.name, "AppError");
    assert.equal(error.code, code);
    assert.equal(error.getStatus(), status);
    return true;
  };
}

test("links a wallet after a verified signature bound to the account", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);

  const wallet = await linking.linkWallet({
    authenticatedUserId: USER_A,
    challengeId: challenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  assert.equal(wallet.userId, USER_A);
  assert.equal(wallet.chain, "ethereum");
  assert.equal(wallet.network, "ethereum");
  assert.equal(wallet.address, "fake_alice");
  assert.equal(wallet.normalizedAddress, "fake_alice");
  assert.equal(wallet.verifiedAt.toISOString(), INITIAL_TIME.toISOString());
});

test("is idempotent for the same account and wallet", async () => {
  const { verification, linking } = createHarness();
  const firstChallenge = await issue(verification, "fake_alice", USER_A);
  const first = await linking.linkWallet({
    authenticatedUserId: USER_A,
    challengeId: firstChallenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  const secondChallenge = await issue(verification, "fake_alice", USER_A);
  const second = await linking.linkWallet({
    authenticatedUserId: USER_A,
    challengeId: secondChallenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  assert.equal(second.id, first.id);
  assert.equal(second.userId, USER_A);
});

test("refuses to redeem another account's challenge", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);

  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_B,
        challengeId: challenge.id,
        signature: "valid-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("FORBIDDEN", 403),
  );

  // The challenge was consumed before the ownership check, so it cannot be
  // retried by the rightful account either.
  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_A,
        challengeId: challenge.id,
        signature: "valid-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("UNAUTHORIZED", 401),
  );
});

test("fails closed for an unbound challenge", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", undefined);

  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_A,
        challengeId: challenge.id,
        signature: "valid-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("FORBIDDEN", 403),
  );
});

test("rejects a replayed challenge after a successful link", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);
  const input = {
    authenticatedUserId: USER_A,
    challengeId: challenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  };

  await linking.linkWallet(input);

  await assert.rejects(
    () => linking.linkWallet(input),
    assertAppError("UNAUTHORIZED", 401),
  );
});

test("rejects an expired challenge", async () => {
  const { verification, linking, clock } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);

  clock.advance(TTL_MS + 1);

  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_A,
        challengeId: challenge.id,
        signature: "valid-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("UNAUTHORIZED", 401),
  );
});

test("rejects an invalid wallet signature", async () => {
  const { verification, linking } = createHarness({
    verifyPredicate: ({ signature }) => signature === "valid-signature",
  });
  const challenge = await issue(verification, "fake_alice", USER_A);

  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_A,
        challengeId: challenge.id,
        signature: "forged-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("UNAUTHORIZED", 401),
  );
});

test("a Carry session without wallet proof cannot link a wallet", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);

  for (const proof of [
    { signature: "", publicKey: "fake-public-key" },
    { signature: "   ", publicKey: "fake-public-key" },
    { signature: "valid-signature", publicKey: "" },
    { signature: "valid-signature" },
  ]) {
    await assert.rejects(
      () =>
        linking.linkWallet({
          authenticatedUserId: USER_A,
          challengeId: challenge.id,
          ...proof,
        }),
      assertAppError("VALIDATION_ERROR", 400),
    );
  }

  // Validation happens before verification, so the challenge is still usable
  // once a real signature is supplied.
  const wallet = await linking.linkWallet({
    authenticatedUserId: USER_A,
    challengeId: challenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });
  assert.equal(wallet.userId, USER_A);
});

test("rejects a missing or malformed authenticated account", async () => {
  const { verification, linking } = createHarness();
  const challenge = await issue(verification, "fake_alice", USER_A);

  for (const authenticatedUserId of ["", "   ", undefined, 42]) {
    await assert.rejects(
      () =>
        linking.linkWallet({
          authenticatedUserId,
          challengeId: challenge.id,
          signature: "valid-signature",
          publicKey: "fake-public-key",
        }),
      assertAppError("UNAUTHORIZED", 401),
    );
  }
});

test("never reassigns a wallet already linked to another account", async () => {
  const { verification, linking, linkStore } = createHarness();
  const firstChallenge = await issue(verification, "fake_alice", USER_A);
  const first = await linking.linkWallet({
    authenticatedUserId: USER_A,
    challengeId: firstChallenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  const secondChallenge = await issue(verification, "fake_alice", USER_B);

  await assert.rejects(
    () =>
      linking.linkWallet({
        authenticatedUserId: USER_B,
        challengeId: secondChallenge.id,
        signature: "valid-signature",
        publicKey: "fake-public-key",
      }),
    assertAppError("FORBIDDEN", 403),
  );

  const stored = await linkStore.findByAddress({
    chain: "ethereum",
    network: "ethereum",
    normalizedAddress: "fake_alice",
  });
  assert.equal(stored.id, first.id);
  assert.equal(stored.userId, USER_A);
});

test("allows only one account to win a concurrent link race", async () => {
  const { verification, linking, linkStore } = createHarness();
  const challengeA = await issue(verification, "fake_alice", USER_A);
  const challengeB = await issue(verification, "fake_alice", USER_B);

  const results = await Promise.allSettled([
    linking.linkWallet({
      authenticatedUserId: USER_A,
      challengeId: challengeA.id,
      signature: "valid-signature",
      publicKey: "fake-public-key",
    }),
    linking.linkWallet({
      authenticatedUserId: USER_B,
      challengeId: challengeB.id,
      signature: "valid-signature",
      publicKey: "fake-public-key",
    }),
  ]);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "FORBIDDEN");

  const owner = fulfilled[0].value.userId;
  const stored = await linkStore.findByAddress({
    chain: "ethereum",
    network: "ethereum",
    normalizedAddress: "fake_alice",
  });

  assert.equal(stored.userId, owner);
});
