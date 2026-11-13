import assert from "node:assert/strict";
import test from "node:test";

import { WalletChallengeService } from "../dist/wallet-verification/challenge.service.js";
import { createWalletVerificationConfig } from "../dist/wallet-verification/wallet-verification.config.js";
import { InMemoryWalletChallengeStore } from "../dist/wallet-verification/in-memory-challenge.store.js";
import { WalletVerificationAdapterRegistry } from "../dist/wallet-verification/adapters/wallet-verification-adapter.registry.js";
import { WalletVerificationService } from "../dist/wallet-verification/wallet-verification.service.js";
import { FakeWalletVerificationAdapter } from "./support/fake-wallet-verification.adapter.mjs";

const TRUSTED_DOMAIN = "https://app.carry-os.test";
const INITIAL_TIME = new Date("2026-01-01T00:00:00.000Z");

function createClock(initial = INITIAL_TIME) {
  let current = new Date(initial.getTime());

  return {
    now: () => new Date(current.getTime()),
    advance(milliseconds) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function createHarness() {
  const clock = createClock();
  const store = new InMemoryWalletChallengeStore();
  const config = createWalletVerificationConfig({
    trustedDomain: TRUSTED_DOMAIN,
  });
  const challenges = new WalletChallengeService(clock, store, config);
  const registry = new WalletVerificationAdapterRegistry([
    new FakeWalletVerificationAdapter(),
  ]);
  const service = new WalletVerificationService(challenges, registry, clock);

  return { service, store, clock };
}

test("stores the authenticated Carry account on an issued challenge", async () => {
  const { service } = createHarness();

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    subject: "  carry-user-a  ",
  });

  assert.equal(challenge.subject, "carry-user-a");
});

test("issues an explicitly unbound challenge when no subject is supplied", async () => {
  const { service } = createHarness();

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
  });

  assert.equal(challenge.subject, null);
});

test("returns the bound subject only from a verified challenge", async () => {
  const { service } = createHarness();
  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    subject: "carry-user-a",
  });

  const result = await service.verifyChallenge({
    challengeId: challenge.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  assert.equal(result.status, "verified");
  assert.equal(result.subject, "carry-user-a");
});

test("binds two challenges for the same wallet to different Carry accounts", async () => {
  const { service } = createHarness();

  const first = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    subject: "carry-user-a",
  });
  const second = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    subject: "carry-user-b",
  });

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.nonce, second.nonce);

  const secondResult = await service.verifyChallenge({
    challengeId: second.id,
    signature: "valid-signature",
    publicKey: "fake-public-key",
  });

  assert.equal(secondResult.status, "verified");
  assert.equal(secondResult.subject, "carry-user-b");
});

test("rejects invalid challenge subjects before a challenge is stored", async () => {
  const invalidSubjects = [
    "",
    "   ",
    "a".repeat(129),
    "bad\u0000subject",
    "bad\nsubject",
    42,
  ];

  for (const subject of invalidSubjects) {
    const { service, store } = createHarness();

    await assert.rejects(
      () =>
        service.issueChallenge({
          network: "ethereum",
          address: "fake_alice",
          subject,
        }),
      (error) => {
        assert.equal(error.name, "AppError");
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.equal(error.getStatus(), 400);
        return true;
      },
      `expected subject to be rejected: ${JSON.stringify(subject)}`,
    );

    assert.equal(await store.deleteExpired(new Date()), 0);
  }
});

test("accepts a subject at the maximum length", async () => {
  const { service } = createHarness();
  const subject = "a".repeat(128);

  const challenge = await service.issueChallenge({
    network: "ethereum",
    address: "fake_alice",
    subject,
  });

  assert.equal(challenge.subject, subject);
});
