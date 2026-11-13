/**
 * Internal wallet ownership verification constants.
 *
 * The message format and version are provisional. They are not an approved
 * wallet-signing standard and must not be presented as one.
 */
export const WALLET_OWNERSHIP_VERIFICATION_PURPOSE =
  "wallet-ownership-verification" as const;

export const WALLET_CHALLENGE_MESSAGE_VERSION = "1" as const;

/** A 256-bit nonce is enough to make challenge guessing impractical. */
export const WALLET_CHALLENGE_NONCE_BYTES = 32;

/** Short default lifetime; callers may configure a different positive TTL. */
export const DEFAULT_WALLET_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Upper bound for a challenge lifetime. The review recorded in the Stage 1
 * remediation approved 15 minutes unless a stricter product limit is adopted.
 */
export const MAX_WALLET_CHALLENGE_TTL_MS = 15 * 60 * 1000;
