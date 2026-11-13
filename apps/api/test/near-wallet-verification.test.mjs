import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { KeyPairSigner, baseEncode } from "near-api-js";
import {
  AccessKeyDoesNotExistError,
  AccountDoesNotExistError,
} from "near-api-js/rpc-errors";

import { NearWalletVerificationAdapter } from "../dist/wallet-verification/adapters/near-wallet-verification.adapter.js";
import { InMemoryWalletChallengeStore } from "../dist/wallet-verification/in-memory-challenge.store.js";
import {
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "../dist/wallet-verification/wallet-verification.constants.js";
import { WalletVerificationModule } from "../dist/wallet-verification/wallet-verification.module.js";
import { WalletVerificationService } from "../dist/wallet-verification/wallet-verification.service.js";

const TRUSTED_DOMAIN = "https://app.carry-os.test";
const ALICE = "alice.near";
const BOB = "bob.near";

const NONCE_BYTES = new Uint8Array(32).fill(9);
const NONCE = Buffer.from(NONCE_BYTES).toString("base64url");
const OTHER_NONCE_BYTES = new Uint8Array(32).fill(8);
const OTHER_NONCE = Buffer.from(OTHER_NONCE_BYTES).toString("base64url");

function challengeMessage({
  address = ALICE,
  nonce = NONCE,
  purpose = WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
  version = WALLET_CHALLENGE_MESSAGE_VERSION,
} = {}) {
  return JSON.stringify({
    version,
    purpose,
    domain: TRUSTED_DOMAIN,
    network: "near",
    address,
    nonce,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:05:00.000Z",
  });
}

const MESSAGE = challengeMessage();

function deterministicSigner(fill) {
  return KeyPairSigner.fromSecretKey(
    `ed25519:${baseEncode(new Uint8Array(32).fill(fill))}`,
  );
}

const signerA = deterministicSigner(1);
const signerB = deterministicSigner(2);
const publicKeyA = await signerA.getPublicKey();
const publicKeyB = await signerB.getPublicKey();
const implicitAccountA = Buffer.from(publicKeyA.data).toString("hex");

async function sign({
  signer = signerA,
  accountId = ALICE,
  message = MESSAGE,
  recipient = TRUSTED_DOMAIN,
  nonce = NONCE_BYTES,
} = {}) {
  const signed = await signer.signNep413Message(accountId, {
    message,
    recipient,
    nonce: new Uint8Array(nonce),
  });

  return {
    accountId,
    publicKey: signed.publicKey.toString(),
    signature: Buffer.from(signed.signature).toString("base64"),
  };
}

function createProvider({ permissions = {}, failure } = {}) {
  const calls = [];

  return {
    calls,
    async viewAccessKey({ accountId, publicKey }) {
      const publicKeyString = publicKey.toString();
      calls.push({ accountId, publicKey: publicKeyString });

      if (failure !== undefined) {
        throw failure;
      }

      const permission = permissions[`${accountId}:${publicKeyString}`];

      if (permission === undefined) {
        throw new AccessKeyDoesNotExistError(
          publicKey,
          "test-block-hash",
          1,
        );
      }

      return {
        nonce: 0n,
        permission,
        block_hash: "test-block-hash",
        block_height: 1,
      };
    },
  };
}

function fullAccess(accountId, publicKey) {
  return { [`${accountId}:${publicKey}`]: "FullAccess" };
}

function createAdapter(provider, trustedDomain = TRUSTED_DOMAIN) {
  return new NearWalletVerificationAdapter({ provider, trustedDomain });
}

test("verifies a valid NEP-413 signature with a full-access key", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, true);
  assert.deepEqual(provider.calls, [
    { accountId: ALICE, publicKey: publicKeyA.toString() },
  ]);
});

test("verifies a valid signature for an implicit account derived from the key", async () => {
  const provider = createProvider({
    permissions: fullAccess(implicitAccountA, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const message = challengeMessage({ address: implicitAccountA });
  const signed = await sign({ accountId: implicitAccountA, message });

  const verified = await adapter.verifySignature({
    address: implicitAccountA,
    message,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, true);
});

test("rejects an implicit account that does not match the public key", async () => {
  const provider = createProvider();
  const adapter = createAdapter(provider);
  const message = challengeMessage({ address: implicitAccountA });
  const signed = await sign({ message });

  const verified = await adapter.verifySignature({
    address: implicitAccountA,
    message,
    nonce: NONCE,
    publicKey: publicKeyB.toString(),
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects an invalid signature", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();
  const tampered = Buffer.from(signed.signature, "base64");
  tampered[0] ^= 0xff;

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: tampered.toString("base64"),
  });

  assert.equal(verified, false);
});

test("rejects a signature made by a different public key", async () => {
  const provider = createProvider({
    permissions: {
      ...fullAccess(ALICE, publicKeyA.toString()),
      ...fullAccess(ALICE, publicKeyB.toString()),
    },
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    // Signature was produced by key A, but key B is supplied and is also a
    // full-access key on the account.
    publicKey: publicKeyB.toString(),
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.deepEqual(provider.calls, [
    { accountId: ALICE, publicKey: publicKeyB.toString() },
  ]);
});

test("rejects a signature made with a different nonce", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign({ nonce: OTHER_NONCE_BYTES });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects a signature made for a different recipient", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign({ recipient: "https://attacker.test" });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects a signature made over a tampered message", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign({ message: `${MESSAGE} ` });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects a message whose address does not match the stored account", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const message = challengeMessage({ address: BOB });
  const signed = await sign({ message });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects a message whose nonce does not match the stored nonce", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const message = challengeMessage({ nonce: OTHER_NONCE });
  const signed = await sign({ message });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects a message with the wrong purpose", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const message = challengeMessage({ purpose: "unrelated-purpose" });
  const signed = await sign({ message });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects a message with the wrong version", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const message = challengeMessage({ version: "2" });
  const signed = await sign({ message });

  const verified = await adapter.verifySignature({
    address: ALICE,
    message,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects malformed or incomplete challenge messages", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();
  const messages = [
    "not json",
    JSON.stringify({ address: ALICE, nonce: NONCE }),
    JSON.stringify([
      WALLET_CHALLENGE_MESSAGE_VERSION,
      WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
      ALICE,
      NONCE,
    ]),
    JSON.stringify({
      version: WALLET_CHALLENGE_MESSAGE_VERSION,
      purpose: WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
      address: ALICE,
      nonce: 42,
    }),
  ];

  for (const message of messages) {
    assert.equal(
      await adapter.verifySignature({
        address: ALICE,
        message,
        nonce: NONCE,
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
      false,
      `expected message to be rejected: ${message}`,
    );
  }

  assert.equal(provider.calls.length, 0);
});

test("ignores a client-supplied account ID and uses the stored challenge account", async () => {
  const provider = createProvider({
    permissions: fullAccess(BOB, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign({ accountId: BOB });

  const verified = await adapter.verifySignature({
    address: ALICE,
    // Extra accountId is ignored; ALICE is the stored challenge address.
    accountId: BOB,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.deepEqual(provider.calls, [
    { accountId: ALICE, publicKey: publicKeyA.toString() },
  ]);
});

test("rejects a public key that is not associated with the stored account", async () => {
  const provider = createProvider();
  const adapter = createAdapter(provider);
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects a key when the account does not exist", async () => {
  const provider = createProvider({
    failure: new AccountDoesNotExistError(
      ALICE,
      "test-block-hash",
      1,
    ),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects a function-call key when full access is required", async () => {
  const provider = createProvider({
    permissions: {
      [`${ALICE}:${publicKeyA.toString()}`]: {
        FunctionCall: {
          receiver_id: "app.carry-os.test",
          allowance: "0",
          method_names: ["verify"],
        },
      },
    },
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
});

test("rejects non-Ed25519 public keys", async () => {
  const provider = createProvider();
  const adapter = createAdapter(provider);
  const secp256k1PublicKey = `secp256k1:${baseEncode(
    new Uint8Array(64).fill(5),
  )}`;
  const signed = await sign();

  const verified = await adapter.verifySignature({
    address: ALICE,
    message: MESSAGE,
    nonce: NONCE,
    publicKey: secp256k1PublicKey,
    signature: signed.signature,
  });

  assert.equal(verified, false);
  assert.equal(provider.calls.length, 0);
});

test("rejects invalid signature encodings", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();
  const invalidSignatures = [
    "",
    "not a base64 signature!",
    Buffer.from(new Uint8Array(32)).toString("base64"),
    `${signed.signature}AA`,
    "ab+cd-_",
  ];

  for (const signature of invalidSignatures) {
    const verified = await adapter.verifySignature({
      address: ALICE,
      message: MESSAGE,
      nonce: NONCE,
      publicKey: signed.publicKey,
      signature,
    });

    assert.equal(
      verified,
      false,
      `expected signature encoding to be rejected: ${JSON.stringify(signature)}`,
    );
  }
});

test("rejects malformed NEAR account IDs during normalization", () => {
  const adapter = createAdapter(createProvider());
  const malformed = [
    "",
    "   ",
    "a",
    "Alice.near",
    "alice.NEAR",
    "alice..near",
    "alice.near.",
    ".alice.near",
    "alice near",
    "alice/near",
    "-alice.near",
    "alice-.near",
    "_alice.near",
    `${"a".repeat(65)}.near`,
    42,
    undefined,
  ];

  for (const address of malformed) {
    assert.throws(
      () => adapter.normalizeAddress(address),
      (error) => {
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.equal(error.getStatus(), 400);
        return true;
      },
      `expected account ID to be rejected: ${JSON.stringify(address)}`,
    );
  }
});

test("trims and accepts valid named and implicit account IDs", () => {
  const adapter = createAdapter(createProvider());

  assert.equal(adapter.normalizeAddress(`  ${ALICE}  `), ALICE);
  assert.equal(
    adapter.normalizeAddress(implicitAccountA),
    implicitAccountA,
  );
});

test("fails closed when the RPC provider fails", async () => {
  const provider = createProvider({
    failure: new Error("rpc unavailable"),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  await assert.rejects(
    () =>
      adapter.verifySignature({
        address: ALICE,
        message: MESSAGE,
        nonce: NONCE,
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
    /rpc unavailable/,
  );
});

test("rejects malformed nonces and public keys", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const adapter = createAdapter(provider);
  const signed = await sign();

  for (const nonce of [
    "",
    "not-base64url!",
    Buffer.from(new Uint8Array(31)).toString("base64url"),
    Buffer.from(new Uint8Array(33)).toString("base64url"),
  ]) {
    assert.equal(
      await adapter.verifySignature({
        address: ALICE,
        message: challengeMessage({ nonce }),
        nonce,
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
      false,
    );
  }

  for (const publicKey of [
    "",
    "ed25519:not-base58!",
    "ed25519:1111",
    "unknown:11111111111111111111111111111111",
  ]) {
    assert.equal(
      await adapter.verifySignature({
        address: ALICE,
        message: MESSAGE,
        nonce: NONCE,
        publicKey,
        signature: signed.signature,
      }),
      false,
    );
  }
});

test("registers the NEAR adapter through the wallet-verification module", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const application = await NestFactory.createApplicationContext(
    WalletVerificationModule.forRoot({
      trustedDomain: TRUSTED_DOMAIN,
      nodeEnv: "test",
      challengeStore: new InMemoryWalletChallengeStore(),
      near: { provider },
    }),
    { logger: false },
  );

  try {
    const service = application.get(WalletVerificationService);
    const challenge = await service.issueChallenge({
      network: "near",
      address: ALICE,
    });
    const signed = await signerA.signNep413Message(ALICE, {
      message: challenge.message,
      recipient: TRUSTED_DOMAIN,
      nonce: Buffer.from(challenge.nonce, "base64url"),
    });

    const result = await service.verifyChallenge({
      challengeId: challenge.id,
      publicKey: signed.publicKey.toString(),
      signature: Buffer.from(signed.signature).toString("base64"),
    });

    assert.equal(result.status, "verified");
    assert.equal(result.address, ALICE);
    assert.equal(result.network, "near");
  } finally {
    await application.close();
  }
});

test("normalizes a trailing-slash near.trustedDomain to the main trusted domain", async () => {
  const provider = createProvider({
    permissions: fullAccess(ALICE, publicKeyA.toString()),
  });
  const application = await NestFactory.createApplicationContext(
    WalletVerificationModule.forRoot({
      trustedDomain: `${TRUSTED_DOMAIN}/`,
      nodeEnv: "test",
      challengeStore: new InMemoryWalletChallengeStore(),
      near: {
        provider,
        trustedDomain: `${TRUSTED_DOMAIN}/`,
      },
    }),
    { logger: false },
  );

  try {
    const service = application.get(WalletVerificationService);
    const challenge = await service.issueChallenge({
      network: "near",
      address: ALICE,
    });
    const signed = await signerA.signNep413Message(ALICE, {
      message: challenge.message,
      recipient: TRUSTED_DOMAIN,
      nonce: Buffer.from(challenge.nonce, "base64url"),
    });

    const result = await service.verifyChallenge({
      challengeId: challenge.id,
      publicKey: signed.publicKey.toString(),
      signature: Buffer.from(signed.signature).toString("base64"),
    });

    assert.equal(result.status, "verified");
  } finally {
    await application.close();
  }
});

test("rejects a whitespace-only NEAR adapter recipient", () => {
  assert.throws(
    () => createAdapter(createProvider(), "   "),
    /A NEAR NEP-413 recipient is required/,
  );
});

test("rejects a whitespace-only near.trustedDomain module recipient", () => {
  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "test",
        near: {
          provider: createProvider(),
          trustedDomain: "   ",
        },
      }),
    /must not contain whitespace/,
  );
});

test("rejects a near.trustedDomain that differs from the main trusted domain", () => {
  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "test",
        near: {
          provider: createProvider(),
          trustedDomain: "https://attacker.test",
        },
      }),
    /must match the wallet verification trusted domain/,
  );
});

test("applies the main trusted-domain HTTP rule to near.trustedDomain", () => {
  assert.throws(
    () =>
      WalletVerificationModule.forRoot({
        trustedDomain: TRUSTED_DOMAIN,
        nodeEnv: "test",
        near: {
          provider: createProvider(),
          trustedDomain: "http://app.carry-os.test",
        },
      }),
    /must use HTTPS/,
  );
});
