import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAIN_TRANSACTION_AUTHORIZATION_KIND,
  assertChainTransactionAuthorized,
  toChainTransactionAuthorization,
} from "../dist/auth/chain-transaction-authorization.js";

const VERIFIED_AT = new Date("2026-01-01T00:00:00.000Z");
const VERIFIED_RESULT = Object.freeze({
  status: "verified",
  challengeId: "challenge-1",
  network: "near",
  address: "alice.near",
  subject: "carry-user-a",
  verifiedAt: VERIFIED_AT,
});

function assertForbidden(error) {
  assert.equal(error.name, "AppError");
  assert.equal(error.code, "FORBIDDEN");
  assert.equal(error.getStatus(), 403);
  return true;
}

test("creates an authorization from a verified wallet result", () => {
  const authorization = toChainTransactionAuthorization(VERIFIED_RESULT);

  assert.equal(authorization.kind, CHAIN_TRANSACTION_AUTHORIZATION_KIND);
  assert.equal(authorization.network, "near");
  assert.equal(authorization.address, "alice.near");
  assert.equal(authorization.challengeId, "challenge-1");
  assert.equal(authorization.subject, "carry-user-a");
  assert.equal(authorization.verifiedAt.getTime(), VERIFIED_AT.getTime());
  assert.equal(Object.isFrozen(authorization), true);
});

test("rejects a non-verified result when creating an authorization", () => {
  for (const status of [
    "invalid_signature",
    "not_found",
    "expired",
    "already_consumed",
  ]) {
    assert.throws(
      () =>
        toChainTransactionAuthorization({
          status,
          challengeId: "challenge-1",
        }),
      assertForbidden,
      `expected ${status} to be rejected`,
    );
  }
});

test("a login session alone cannot authorize a blockchain transaction", () => {
  for (const context of [
    { authenticatedUserId: "carry-user-a" },
    { authenticatedUserId: "carry-user-a", authorization: undefined },
    { authenticatedUserId: "carry-user-a", authorization: null },
  ]) {
    assert.throws(
      () => assertChainTransactionAuthorized(context),
      assertForbidden,
    );
  }
});

test("a hand-built authorization object is rejected", () => {
  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-a",
        authorization: {
          kind: CHAIN_TRANSACTION_AUTHORIZATION_KIND,
          network: "near",
          address: "alice.near",
          challengeId: "challenge-1",
          verifiedAt: VERIFIED_AT,
        },
      }),
    assertForbidden,
  );
});

test("a serialized or cloned authorization is rejected", () => {
  const authorization = toChainTransactionAuthorization(VERIFIED_RESULT);
  const clone = JSON.parse(JSON.stringify(authorization));

  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-a",
        authorization: clone,
      }),
    assertForbidden,
  );
});

test("non-object authorization values are rejected", () => {
  for (const authorization of [
    "wallet-signature",
    1,
    true,
    [],
    () => true,
  ]) {
    assert.throws(
      () =>
        assertChainTransactionAuthorized({
          authenticatedUserId: "carry-user-a",
          authorization,
        }),
      assertForbidden,
    );
  }
});

test("accepts an authorization issued from a verified wallet signature", () => {
  const authorization = toChainTransactionAuthorization(VERIFIED_RESULT);

  const resolved = assertChainTransactionAuthorized({
    authenticatedUserId: "carry-user-a",
    authorization,
  });

  assert.equal(resolved, authorization);
});

test("consumes the authorization so it cannot be replayed", () => {
  const authorization = toChainTransactionAuthorization(VERIFIED_RESULT);

  assertChainTransactionAuthorized({
    authenticatedUserId: "carry-user-a",
    authorization,
  });

  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-a",
        authorization,
      }),
    assertForbidden,
  );
});

test("rejects an authorization bound to a different Carry account", () => {
  const authorization = toChainTransactionAuthorization(VERIFIED_RESULT);

  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-b",
        authorization,
      }),
    assertForbidden,
  );

  // A rejected authorization is burned and cannot be retried.
  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-a",
        authorization,
      }),
    assertForbidden,
  );
});

test("rejects an unbound wallet authorization when a session is present", () => {
  const authorization = toChainTransactionAuthorization({
    ...VERIFIED_RESULT,
    subject: null,
  });

  assert.throws(
    () =>
      assertChainTransactionAuthorized({
        authenticatedUserId: "carry-user-a",
        authorization,
      }),
    assertForbidden,
  );
});
