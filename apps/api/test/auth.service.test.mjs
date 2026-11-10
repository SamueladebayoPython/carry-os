import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../dist/auth/auth.service.js";

function createService() {
  const identities = new Map();
  const sessions = new Map();
  const user = { id: "carry-user", status: "ACTIVE" };
  const prisma = {
    authIdentity: {
      findUnique: async ({ where }) => {
        const identity = identities.get(`${where.issuer_subject.issuer}\0${where.issuer_subject.subject}`);
        return identity ? { ...identity, user: { status: user.status } } : null;
      },
    },
    user: {
      create: async ({ data }) => {
        const identity = data.identities.create;
        identities.set(`${identity.issuer}\0${identity.subject}`, { userId: user.id });
        return { id: user.id };
      },
    },
    authSession: {
      create: async ({ data }) => {
        const session = { id: `session-${sessions.size + 1}`, revokedAt: null, user, ...data };
        sessions.set(session.tokenHash, session);
        return session;
      },
      findUnique: async ({ where }) => sessions.get(where.tokenHash) ?? null,
      updateMany: async ({ where, data }) => {
        const session = [...sessions.values()].find((entry) => entry.id === where.id);
        if (!session || (where.revokedAt === null && session.revokedAt !== null)) return { count: 0 };
        if (where.expiresAt?.gt && session.expiresAt <= where.expiresAt.gt) return { count: 0 };
        if (where.lastSeenAt?.gt && session.lastSeenAt <= where.lastSeenAt.gt) return { count: 0 };
        Object.assign(session, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const session = [...sessions.values()].find((entry) => entry.id === where.id);
        Object.assign(session, data);
        return session;
      },
    },
  };
  const config = {
    authEnabled: true,
    authCsrfSecret: "local-test-csrf-secret-0123456789abcdef",
    authSessionStore: "database",
    isProduction: false,
    webOrigins: ["http://localhost:3000"],
  };
  const verifier = {
    verify: async () => ({ issuer: "https://issuer.test/", subject: "auth0|123" }),
  };
  return { service: new AuthService(config, verifier, prisma), sessions };
}

test("CSRF value is derived from a separate secret and only its hash is retained", async () => {
  const { service, sessions } = createService();
  const result = await service.exchangeToken("test-jwt", "http://localhost:3000");
  const session = [...sessions.values()][0];

  assert.notEqual(result.cookie, result.response.csrfToken);
  assert.equal(session.csrfToken, undefined);
  assert.match(session.csrfTokenHash, /^[a-f0-9]{64}$/);
  assert.equal((await service.resolveSession(result.cookie)).csrfToken, result.response.csrfToken);
});

test("CSRF hash is checked before a state-changing request succeeds", async () => {
  const { service } = createService();
  const result = await service.exchangeToken("test-jwt", "http://localhost:3000");

  await assert.rejects(() => service.assertCsrfToken(result.cookie, "wrong-token"), /Invalid CSRF token/);
  await assert.doesNotReject(() => service.assertCsrfToken(result.cookie, result.response.csrfToken));
});

test("logout revokes the persisted session", async () => {
  const { service, sessions } = createService();
  const result = await service.exchangeToken("test-jwt", "http://localhost:3000");

  await service.logout(result.cookie, result.response.csrfToken, "http://localhost:3000");
  assert.ok([...sessions.values()][0].revokedAt instanceof Date);
  await assert.rejects(() => service.resolveSession(result.cookie), /Not authenticated/);
});
