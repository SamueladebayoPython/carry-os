import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";

import { Module, UnauthorizedException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AuthService } from "../dist/auth/auth.service.js";
import { AuthSessionGuard } from "../dist/auth/auth-session.guard.js";
import { ValidationModule } from "../dist/common/validation/validation.module.js";
import { WalletLinkingController } from "../dist/wallet-linking/wallet-linking.controller.js";
import { WalletLinkingService } from "../dist/wallet-linking/wallet-linking.service.js";
import { WalletVerificationService } from "../dist/wallet-verification/wallet-verification.service.js";
import { WALLET_VERIFICATION_CONFIG } from "../dist/wallet-verification/wallet-verification.config.js";

function createTestModule(calls) {
  const auth = {
    cookieName: "carry_session",
    async resolveSession(cookie) {
      if (cookie !== "session-token") throw new UnauthorizedException();
      return { identity: { userId: "carry-user-123" } };
    },
    async assertCsrfToken(cookie, csrfToken) {
      if (cookie !== "session-token" || csrfToken !== "valid-csrf") {
        throw new UnauthorizedException("Invalid CSRF token.");
      }
    },
  };
  const verification = {
    async issueChallenge(input) {
      calls.challengeInput = input;
      return {
        id: "8056e8a4-7ec0-47dd-bafc-558b1a9b2781",
        network: input.network,
        address: input.address,
        message: "stored-signed-message",
        nonce: "opaque-nonce",
        expiresAt: new Date("2026-01-01T00:05:00.000Z"),
      };
    },
  };
  const linking = {
    async linkWallet(input) {
      calls.linkInput = input;
      return {
        network: "near",
        address: "alice.near",
        verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    },
  };
  class WalletLinkingTestModule {}
  Module({
    imports: [ValidationModule],
    controllers: [WalletLinkingController],
    providers: [
      AuthSessionGuard,
      { provide: AuthService, useValue: auth },
      { provide: WalletVerificationService, useValue: verification },
      { provide: WalletLinkingService, useValue: linking },
      {
        provide: WALLET_VERIFICATION_CONFIG,
        useValue: { trustedDomain: "https://carry.example", challengeTtlMs: 300_000 },
      },
    ],
  })(WalletLinkingTestModule);
  return WalletLinkingTestModule;
}

async function startApp(t, calls) {
  const app = await NestFactory.create(createTestModule(calls), { logger: false });
  app.setGlobalPrefix("api");
  await app.listen(0, "127.0.0.1");
  t.after(async () => app.close());
  const address = app.getHttpServer().address();
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

const sessionHeaders = {
  cookie: "carry_session=session-token",
  "x-csrf-token": "valid-csrf",
  "content-type": "application/json",
};

test("wallet challenge endpoint requires a valid Carry session and CSRF token", async (t) => {
  const calls = {};
  const { baseUrl } = await startApp(t, calls);
  const endpoint = `${baseUrl}/api/wallets/near/challenge`;

  assert.equal((await fetch(endpoint, { method: "POST", body: JSON.stringify({ address: "alice.near" }) })).status, 401);
  assert.equal((await fetch(endpoint, {
    method: "POST",
    headers: { cookie: sessionHeaders.cookie, "content-type": "application/json" },
    body: JSON.stringify({ address: "alice.near" }),
  })).status, 401);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ address: "alice.near" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.challengeInput, {
    network: "near",
    address: "alice.near",
    subject: "carry-user-123",
  });
  assert.equal((await response.json()).recipient, "https://carry.example");
});

test("wallet link endpoint requires signature and public key before linking", async (t) => {
  const calls = {};
  const { baseUrl } = await startApp(t, calls);
  const endpoint = `${baseUrl}/api/wallets/near/link`;

  const invalid = await fetch(endpoint, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ challengeId: "8056e8a4-7ec0-47dd-bafc-558b1a9b2781" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(calls.linkInput, undefined);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      challengeId: "8056e8a4-7ec0-47dd-bafc-558b1a9b2781",
      signature: "wallet-produced-signature",
      publicKey: "ed25519:wallet-produced-public-key",
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.linkInput, {
    authenticatedUserId: "carry-user-123",
    challengeId: "8056e8a4-7ec0-47dd-bafc-558b1a9b2781",
    signature: "wallet-produced-signature",
    publicKey: "ed25519:wallet-produced-public-key",
  });
});

test("wallet-linking endpoints are absent while authentication is disabled", async (t) => {
  const { createApp } = await import("../dist/bootstrap.js");
  const app = await createApp({
    env: { NODE_ENV: "test", AUTH_ENABLED: "false" },
    logger: false,
  });
  await app.listen(0, "127.0.0.1");
  t.after(async () => app.close());
  const address = app.getHttpServer().address();

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/wallets/near/challenge`,
    { method: "POST", body: JSON.stringify({ address: "alice.near" }) },
  );
  assert.equal(response.status, 404);
});

test("production app mounts wallet endpoints and rejects requests without a session", async (t) => {
  const { createApp } = await import("../dist/bootstrap.js");
  const app = await createApp({
    env: {
      NODE_ENV: "production",
      WEB_ORIGIN: "https://app.example",
      AUTH_ENABLED: "true",
      DATABASE_URL: "postgresql://carry:secret@127.0.0.1:5432/carry_os",
      AUTH_CSRF_SECRET: "c".repeat(32),
      NEAR_AUTH_ISSUER: "https://issuer.example",
      NEAR_AUTH_AUDIENCE: "carry-api",
      NEAR_AUTH_JWKS_URI: "https://issuer.example/.well-known/jwks.json",
    },
    logger: false,
  });
  await app.listen(0, "127.0.0.1");
  t.after(async () => app.close());
  const address = app.getHttpServer().address();

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/wallets/near/challenge`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "alice.near" }),
    },
  );
  assert.equal(response.status, 401);
});
