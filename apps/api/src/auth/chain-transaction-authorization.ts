import type { NetworkId } from "@carry-os/shared";

import { forbiddenError } from "../common/errors/app-error.js";
import type { WalletVerificationResult } from "../wallet-verification/wallet-verification.types.js";
import { isAuthenticWalletVerificationResult } from "../wallet-verification/wallet-verification.service.js";

export const CHAIN_TRANSACTION_AUTHORIZATION_KIND =
  "wallet-signature" as const;

/**
 * Capability proving that a wallet signed for a chain action.
 *
 * It can only be created from a `verified` wallet-verification result and is
 * branded in-process, so a caller cannot mint one from a Carry session or by
 * replaying a serialized JSON object. It is consumed on first authorization.
 */
export interface ChainTransactionAuthorization {
  readonly kind: typeof CHAIN_TRANSACTION_AUTHORIZATION_KIND;
  readonly network: NetworkId;
  readonly address: string;
  readonly challengeId: string;
  /**
   * Carry account the underlying challenge was bound to, or null when the
   * challenge was unbound. A session-authenticated request requires a match.
   */
  readonly subject: string | null;
  readonly verifiedAt: Date;
}

const issuedAuthorizations = new WeakSet<object>();

export interface ChainTransactionRequestContext {
  /** Present when a Carry login session authenticated the request. */
  readonly authenticatedUserId?: string;
  /**
   * Wallet authorization attached by a controller after verifying a wallet
   * signature. A session identity must never be used in its place.
   */
  readonly authorization?: unknown;
}

/**
 * Converts a verified wallet signature into a single-use authorization object.
 */
export function toChainTransactionAuthorization(
  result: WalletVerificationResult,
): ChainTransactionAuthorization {
  if (!isAuthenticWalletVerificationResult(result)) {
    throw forbiddenError(
      "A verified wallet signature is required to authorize a blockchain transaction.",
    );
  }

  const authorization: ChainTransactionAuthorization = Object.freeze({
    kind: CHAIN_TRANSACTION_AUTHORIZATION_KIND,
    network: result.network,
    address: result.address,
    challengeId: result.challengeId,
    subject: result.subject,
    verifiedAt: new Date(result.verifiedAt.getTime()),
  });

  issuedAuthorizations.add(authorization);

  return authorization;
}

/**
 * Boundary assertion for any endpoint that can move on-chain assets.
 *
 * A login session is account-scoped and is explicitly not sufficient: without
 * an in-process authorization created by `toChainTransactionAuthorization`,
 * the request is rejected. The authorization is consumed here, so replaying it
 * fails. When a session is present, the wallet challenge must be bound to the
 * same Carry account.
 *
 * This does not replace signature verification; it prevents a session from
 * being accepted in its place.
 */
export function assertChainTransactionAuthorized(
  context: ChainTransactionRequestContext,
): ChainTransactionAuthorization {
  const authorization = context.authorization;

  if (
    authorization === null ||
    typeof authorization !== "object" ||
    !issuedAuthorizations.has(authorization)
  ) {
    throw forbiddenError(
      "Login sessions cannot authorize blockchain transactions. A verified wallet signature is required.",
    );
  }

  const resolved = authorization as ChainTransactionAuthorization;

  if (
    context.authenticatedUserId !== undefined &&
    (resolved.subject === null ||
      resolved.subject !== context.authenticatedUserId)
  ) {
    issuedAuthorizations.delete(resolved);
    throw forbiddenError(
      "Wallet authorization does not belong to the authenticated account.",
    );
  }

  issuedAuthorizations.delete(resolved);

  return resolved;
}
