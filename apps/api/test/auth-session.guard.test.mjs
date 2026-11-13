import assert from "node:assert/strict";
import test from "node:test";
import { AuthSessionGuard } from "../dist/auth/auth-session.guard.js";

const identity = { userId: "carry-user", issuer: "https://issuer.test/", subject: "auth0|123" };

function setup({ method = "GET", cookie = "carry_session=secret", csrf, authenticated = true } = {}) {
  const calls = [];
  const auth = {
    cookieName: "carry_session",
    resolveSession(value) {
      calls.push(["resolve", value]);
      if (!authenticated) throw new Error("Not authenticated.");
      return { identity, csrfToken: "csrf", expiresAt: "2099-01-01T00:00:00.000Z" };
    },
    assertCsrfToken(value, token) {
      calls.push(["csrf", value, token]);
      if (token !== "csrf") throw new Error("Invalid CSRF token.");
    },
  };
  const request = { method, headers: { cookie, "x-csrf-token": csrf } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  return { guard: new AuthSessionGuard(auth), context, request, calls };
}

test("guard resolves cookie session and attaches identity", async () => {
  const { guard, context, request, calls } = setup();
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(request.authIdentity, identity);
  assert.deepEqual(calls, [["resolve", "secret"]]);
});

test("guard requires matching CSRF token for unsafe methods", async () => {
  const { guard, context, calls } = setup({ method: "POST", csrf: "csrf" });
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(calls, [["resolve", "secret"], ["csrf", "secret", "csrf"]]);
});

test("guard rejects unsafe methods with invalid CSRF token", async () => {
  const { guard, context } = setup({ method: "POST", csrf: "wrong" });
  await assert.rejects(() => guard.canActivate(context), /Invalid CSRF token/);
});

test("guard rejects requests without an authenticated session", async () => {
  const { guard, context } = setup({ authenticated: false });
  await assert.rejects(() => guard.canActivate(context), /Not authenticated/);
});

test("guard permits safe methods without a CSRF header", async () => {
  const { guard, context, calls } = setup({ method: "OPTIONS" });
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(calls, [["resolve", "secret"]]);
});
