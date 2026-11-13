import { createPublicKey, verify as verifySignature } from "node:crypto";
import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";

interface JwkSet {
  keys: SigningJwk[];
}

interface SigningJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
  key_ops?: string[];
}

interface NearAuthClaims {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
}

const JWKS_CACHE_MS = 5 * 60 * 1000;
const MAX_TOKEN_LENGTH = 7_168;

@Injectable()
export class NearJwtVerifier {
  private cachedKeys: SigningJwk[] = [];
  private cacheExpiresAt = 0;

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async verify(token: string): Promise<{ issuer: string; subject: string }> {
    const issuer = this.config.nearAuthIssuer;
    const audience = this.config.nearAuthAudience;
    const jwksUri = this.config.nearAuthJwksUri;
    if (!issuer || !audience || !jwksUri) throw new ServiceUnavailableException("NEAR Auth is not configured.");
    if (token.length > MAX_TOKEN_LENGTH) throw new UnauthorizedException("Invalid identity token.");

    const parts = token.split(".");
    if (parts.length !== 3) throw new UnauthorizedException("Invalid identity token.");

    try {
      const header = JSON.parse(this.decodePart(parts[0]!)) as { alg?: unknown; kid?: unknown };
      const claims = JSON.parse(this.decodePart(parts[1]!)) as NearAuthClaims;
      if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported token header");
      if (claims.iss !== issuer || typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("Invalid identity claims");
      const audiences = typeof claims.aud === "string" ? [claims.aud] : claims.aud;
      if (!Array.isArray(audiences) || !audiences.includes(audience)) throw new Error("Invalid audience");
      const now = Math.floor(Date.now() / 1000);
      if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("Expired token");
      if (typeof claims.nbf === "number" && claims.nbf > now) throw new Error("Token not active");

      let jwk = (await this.getKeys(jwksUri, false)).find((key) => key.kid === header.kid);
      if (!jwk) jwk = (await this.getKeys(jwksUri, true)).find((key) => key.kid === header.kid);
      if (
        !jwk ||
        jwk.kty !== "RSA" ||
        (jwk.alg !== undefined && jwk.alg !== "RS256") ||
        (jwk.use !== undefined && jwk.use !== "sig") ||
        (jwk.key_ops !== undefined && !jwk.key_ops.includes("verify"))
      ) throw new Error("Signing key not found");

      const publicKey = createPublicKey({ key: jwk, format: "jwk" });
      const signed = `${parts[0]}.${parts[1]}`;
      const signature = Buffer.from(parts[2]!, "base64url");
      if (!verifySignature("RSA-SHA256", Buffer.from(signed), publicKey, signature)) throw new Error("Invalid token signature");
      return { issuer, subject: claims.sub };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException("Invalid identity token.");
    }
  }

  private decodePart(value: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid token encoding");
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private async getKeys(uri: string, forceRefresh: boolean): Promise<SigningJwk[]> {
    if (!forceRefresh && Date.now() < this.cacheExpiresAt && this.cachedKeys.length > 0) return this.cachedKeys;
    let response: Response;
    try {
      response = await fetch(uri, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    } catch {
      throw new ServiceUnavailableException("Identity provider keys are unavailable.");
    }
    if (!response.ok) throw new ServiceUnavailableException("Identity provider keys are unavailable.");
    let payload: JwkSet;
    try { payload = await response.json() as JwkSet; } catch { throw new ServiceUnavailableException("Identity provider keys are invalid."); }
    if (!payload || !Array.isArray(payload.keys) || payload.keys.length === 0) throw new ServiceUnavailableException("Identity provider keys are invalid.");
    this.cachedKeys = payload.keys;
    this.cacheExpiresAt = Date.now() + JWKS_CACHE_MS;
    return this.cachedKeys;
  }
}
