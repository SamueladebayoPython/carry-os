import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";
import { NearJwtVerifier } from "./near-jwt-verifier.js";
import type { AuthenticatedIdentity, SessionResponse, StoredSession } from "./auth.types.js";

const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_COOKIE = "carry_session";

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly identities = new Map<string, AuthenticatedIdentity>();

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(NearJwtVerifier) private readonly verifier: NearJwtVerifier,
  ) {}

  get cookieName(): string { return SESSION_COOKIE; }
  get isProduction(): boolean { return this.config.isProduction; }

  async exchangeToken(token: string, origin: string | undefined): Promise<{ cookie: string; response: SessionResponse }> {
    this.assertEnabled();
    this.assertAllowedOrigin(origin);
    const verified = await this.verifier.verify(token);
    const identityKey = `${verified.issuer}\u0000${verified.subject}`;
    let identity = this.identities.get(identityKey);
    if (!identity) {
      identity = { userId: randomUUID(), issuer: verified.issuer, subject: verified.subject };
      this.identities.set(identityKey, identity);
    }

    const rawToken = randomBytes(32).toString("base64url");
    const now = Date.now();
    const session: StoredSession = {
      tokenHash: this.hash(rawToken),
      csrfToken: randomBytes(32).toString("base64url"),
      identity,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + ABSOLUTE_LIFETIME_MS,
    };
    this.sessions.set(session.tokenHash, session);
    this.pruneExpired(now);
    return { cookie: rawToken, response: this.toResponse(session) };
  }

  resolveSession(rawToken: string | undefined): { identity: AuthenticatedIdentity; csrfToken: string; expiresAt: string } {
    this.assertEnabled();
    const session = this.findSession(rawToken);
    session.lastSeenAt = Date.now();
    return {
      identity: session.identity,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  logout(rawToken: string | undefined, csrfToken: string | undefined, origin: string | undefined): void {
    this.assertEnabled();
    this.assertAllowedOrigin(origin);
    const session = this.findSession(rawToken);
    if (!csrfToken || !this.constantTimeEqual(csrfToken, session.csrfToken)) throw new UnauthorizedException("Invalid CSRF token.");
    this.sessions.delete(session.tokenHash);
  }

  assertCsrfToken(rawToken: string | undefined, csrfToken: string | undefined): void {
    const session = this.findSession(rawToken);
    if (!csrfToken || !this.constantTimeEqual(csrfToken, session.csrfToken)) {
      throw new UnauthorizedException("Invalid CSRF token.");
    }
  }

  private assertEnabled(): void {
    if (!this.config.authEnabled) throw new ServiceUnavailableException("Authentication is not enabled.");
    if (this.config.authSessionStore !== "memory" || this.config.isProduction) {
      throw new ServiceUnavailableException("Persistent session storage is required before production authentication can be enabled.");
    }
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    if (!origin || !this.config.webOrigins.includes(origin)) throw new UnauthorizedException("Request origin is not allowed.");
  }

  private findSession(rawToken: string | undefined): StoredSession {
    if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      throw new UnauthorizedException("Not authenticated.");
    }
    const tokenHash = this.hash(rawToken);
    const session = this.sessions.get(tokenHash);
    const now = Date.now();
    if (!session || session.expiresAt <= now || session.lastSeenAt + IDLE_TIMEOUT_MS <= now) {
      if (session) this.sessions.delete(tokenHash);
      throw new UnauthorizedException("Not authenticated.");
    }
    return session;
  }

  private toResponse(session: StoredSession): SessionResponse {
    return {
      authenticated: true,
      user: { id: session.identity.userId },
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  private hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

  private constantTimeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private pruneExpired(now: number): void {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= now || session.lastSeenAt + IDLE_TIMEOUT_MS <= now) this.sessions.delete(key);
    }
  }
}
