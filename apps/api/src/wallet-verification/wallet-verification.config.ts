import {
  DEFAULT_WALLET_CHALLENGE_TTL_MS,
  MAX_WALLET_CHALLENGE_TTL_MS,
} from "./wallet-verification.constants.js";

export const WALLET_VERIFICATION_CONFIG = Symbol(
  "WALLET_VERIFICATION_CONFIG",
);

const MAX_TRUSTED_DOMAIN_LENGTH = 2048;
const LOCAL_HTTP_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

export interface WalletVerificationConfigOptions {
  /** Trusted server-side application domain, never supplied by a client. */
  readonly trustedDomain: string;
  readonly challengeTtlMs?: number;
  /**
   * Explicitly permits plain HTTP, but only for loopback development/test
   * origins. Production callers must leave this disabled.
   */
  readonly allowLocalHttp?: boolean;
}

export interface WalletVerificationConfig {
  readonly trustedDomain: string;
  readonly challengeTtlMs: number;
}

export function createWalletVerificationConfig(
  options: WalletVerificationConfigOptions,
): WalletVerificationConfig {
  const trustedDomain = parseTrustedDomain(
    options.trustedDomain,
    options.allowLocalHttp === true,
  );
  const challengeTtlMs =
    options.challengeTtlMs ?? DEFAULT_WALLET_CHALLENGE_TTL_MS;

  if (!Number.isSafeInteger(challengeTtlMs) || challengeTtlMs <= 0) {
    throw new Error(
      "Wallet verification challenge TTL must be a positive safe integer.",
    );
  }

  if (challengeTtlMs > MAX_WALLET_CHALLENGE_TTL_MS) {
    throw new Error(
      `Wallet verification challenge TTL must not exceed ${MAX_WALLET_CHALLENGE_TTL_MS} milliseconds.`,
    );
  }

  return Object.freeze({ trustedDomain, challengeTtlMs });
}

function parseTrustedDomain(
  value: string,
  allowLocalHttp: boolean,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Wallet verification trusted domain is required.");
  }

  if (/\s/.test(value)) {
    throw new Error(
      "Wallet verification trusted domain must not contain whitespace.",
    );
  }

  if (value.length > MAX_TRUSTED_DOMAIN_LENGTH) {
    throw new Error(
      `Wallet verification trusted domain must not exceed ${MAX_TRUSTED_DOMAIN_LENGTH} characters.`,
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Wallet verification trusted domain must be a valid HTTP(S) origin.",
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      "Wallet verification trusted domain must use HTTP(S).",
    );
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error(
      "Wallet verification trusted domain must not include credentials.",
    );
  }

  if (
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new Error(
      "Wallet verification trusted domain must not include a path, query, or fragment.",
    );
  }

  if (url.protocol === "http:") {
    if (!allowLocalHttp) {
      throw new Error(
        "Wallet verification trusted domain must use HTTPS.",
      );
    }

    if (!LOCAL_HTTP_HOSTNAMES.has(url.hostname)) {
      throw new Error(
        "Wallet verification only allows HTTP for localhost development/test origins.",
      );
    }
  }

  return url.origin;
}
