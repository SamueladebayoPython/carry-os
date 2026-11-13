import type { NetworkId } from "@carry-os/shared";

import {
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "./wallet-verification.constants.js";

export interface WalletChallengeMessageInput {
  readonly trustedDomain: string;
  readonly network: NetworkId;
  readonly address: string;
  readonly nonce: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

/**
 * Builds a deterministic, provisional internal message.
 *
 * This is not an approved wallet-signing standard. The exact format may change
 * before public API exposure; the issued string must be stored and verified
 * unchanged.
 */
export function buildWalletChallengeMessage(
  input: WalletChallengeMessageInput,
): string {
  return JSON.stringify({
    version: WALLET_CHALLENGE_MESSAGE_VERSION,
    purpose: WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
    domain: input.trustedDomain,
    network: input.network,
    address: input.address,
    nonce: input.nonce,
    issuedAt: input.issuedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
  });
}
