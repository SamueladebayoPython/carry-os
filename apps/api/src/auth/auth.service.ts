import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { NearJwtVerifier } from "./near-jwt-verifier.js";
import type { AuthenticatedIdentity, SessionResponse } from "./auth.types.js";

const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_COOKIE = "carry_session";

interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  user: { status: "ACTIVE" | "SUSPENDED" };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(NearJwtVerifier) private readonly verifier: NearJwtVerifier,
    @Inject(PrismaService) private readonly prisma: PrismaService | null,
  ) {}

  get cookieName(): string { return SESSION_COOKIE; }
  get isProduction(): boolean { return this.config.isProduction; }

  async exchangeToken(token: string, origin: string | undefined): Promise<{ cookie: string; response: SessionResponse }> {
    this.assertEnabled();
    this.assertAllowedOrigin(origin);
    const verified = await this.verifier.verify(token);
    const identity = await this.resolveIdentity(verified.issuer, verified.subject);

    const rawToken = randomBytes(32).toString("base64url");
    const csrfToken = this.deriveCsrfToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS);
    await this.prisma!.authSession.create({
      data: {
        userId: identity.userId,
        tokenHash: this.hash(rawToken),
        csrfTokenHash: this.hash(csrfToken),
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });

    return {
      cookie: rawToken,
      response: {
        authenticated: true,
        user: { id: identity.userId },
        csrfToken,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async resolveSession(rawToken: string | undefined): Promise<{ identity: AuthenticatedIdentity; csrfToken: string; expiresAt: string }> {
    this.assertEnabled();
    const session = await this.findSession(rawToken);
    const csrfToken = this.deriveCsrfToken(rawToken!);
    if (!this.matchesCsrfToken(csrfToken, session.csrfTokenHash)) {
      throw new ServiceUnavailableException("Stored CSRF token hash does not match the configured server secret.");
    }
    return {
      identity: { userId: session.userId },
      csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async logout(rawToken: string | undefined, csrfToken: string | undefined, origin: string | undefined): Promise<void> {
    this.assertEnabled();
    this.assertAllowedOrigin(origin);
    const session = await this.findSession(rawToken);
    if (!this.matchesCsrfToken(csrfToken, session.csrfTokenHash)) throw new UnauthorizedException("Invalid CSRF token.");
    await this.prisma!.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  async assertCsrfToken(rawToken: string | undefined, csrfToken: string | undefined): Promise<void> {
    const session = await this.findSession(rawToken);
    if (!this.matchesCsrfToken(csrfToken, session.csrfTokenHash)) {
      throw new UnauthorizedException("Invalid CSRF token.");
    }
  }

  private assertEnabled(): void {
    if (!this.config.authEnabled) throw new ServiceUnavailableException("Authentication is not enabled.");
    if (!this.config.authCsrfSecret || Buffer.byteLength(this.config.authCsrfSecret, "utf8") < 32) {
      throw new ServiceUnavailableException("A server-side AUTH_CSRF_SECRET of at least 32 bytes is required.");
    }
    if (this.config.authSessionStore !== "database" || !this.prisma) {
      throw new ServiceUnavailableException("A configured PostgreSQL session store is required before authentication can be enabled.");
    }
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    if (!origin || !this.config.webOrigins.includes(origin)) throw new UnauthorizedException("Request origin is not allowed.");
  }

  private async resolveIdentity(issuer: string, subject: string): Promise<AuthenticatedIdentity> {
    const existing = await this.prisma!.authIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      select: { userId: true, user: { select: { status: true } } },
    });
    if (existing) {
      if (existing.user.status !== "ACTIVE") throw new ForbiddenException("Carry account is suspended.");
      return { userId: existing.userId, issuer, subject };
    }

    try {
      const user = await this.prisma!.user.create({
        data: {
          identities: { create: { provider: "near-auth", issuer, subject } },
        },
        select: { id: true, status: true },
      });
      return { userId: user.id, issuer, subject };
    } catch (error) {
      // A concurrent login may have inserted the issuer/subject pair first.
      const racedIdentity = await this.prisma!.authIdentity.findUnique({
        where: { issuer_subject: { issuer, subject } },
        select: { userId: true, user: { select: { status: true } } },
      });
      if (racedIdentity) {
        if (racedIdentity.user.status !== "ACTIVE") throw new ForbiddenException("Carry account is suspended.");
        return { userId: racedIdentity.userId, issuer, subject };
      }
      throw error;
    }
  }

  private async findSession(rawToken: string | undefined): Promise<SessionRecord> {
    this.assertEnabled();
    if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      throw new UnauthorizedException("Not authenticated.");
    }
    const tokenHash = this.hash(rawToken);
    const session = await this.prisma!.authSession.findUnique({
      where: { tokenHash },
      include: { user: { select: { status: true } } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.user.status !== "ACTIVE" || session.expiresAt <= now || session.lastSeenAt.getTime() + IDLE_TIMEOUT_MS <= now.getTime()) {
      if (session && !session.revokedAt) {
        await this.prisma!.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw new UnauthorizedException("Not authenticated.");
    }

    const refreshed = await this.prisma!.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gt: new Date(now.getTime() - IDLE_TIMEOUT_MS) },
      },
      data: { lastSeenAt: now },
    });
    if (refreshed.count !== 1) throw new UnauthorizedException("Not authenticated.");
    return { ...session, lastSeenAt: now };
  }

  private hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

  private deriveCsrfToken(rawSessionToken: string): string {
    return createHmac("sha256", this.config.authCsrfSecret!)
      .update(`carry-os:csrf:v1:${rawSessionToken}`)
      .digest("base64url");
  }

  private matchesCsrfToken(token: string | undefined, storedHash: string): boolean {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    return this.constantTimeEqual(this.hash(token), storedHash);
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
