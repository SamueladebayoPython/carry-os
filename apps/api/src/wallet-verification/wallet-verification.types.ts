import type { NetworkId } from "@carry-os/shared";

export type WalletVerificationPurpose =
  "wallet-ownership-verification";

export type WalletChallengeMessageVersion = "1";

/**
 * Internal record of a wallet ownership challenge.
 *
 * `message` is the exact string that the wallet must sign. It is stored at
 * issuance and must be passed to the adapter unchanged during verification.
 */
export interface WalletChallenge {
  readonly id: string;
  readonly nonce: string;
  readonly network: NetworkId;
  readonly address: string;
  /**
   * Carry account this challenge was issued for, or null for an unbound
   * internal challenge. A bound challenge must only be redeemed by the same
   * account, which stops a signed challenge from being reused under another
   * session.
   */
  readonly subject: string | null;
  readonly message: string;
  readonly purpose: WalletVerificationPurpose;
  readonly messageVersion: WalletChallengeMessageVersion;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export interface IssueWalletChallengeInput {
  readonly network: NetworkId;
  readonly address: string;
  /**
   * Authenticated Carry account that will redeem this challenge. Callers that
   * expose wallet linking must always supply it.
   */
  readonly subject?: string;
}

export interface VerifyWalletChallengeInput {
  readonly challengeId: string;
  readonly signature: string;
  /**
   * Public key returned by the wallet. Required by chains that verify key
   * ownership; other adapters may ignore it.
   */
  readonly publicKey: string;
}

/**
 * The result proves only that the adapter verified control of the stored
 * address. It does not create a session, authenticate a Carry OS account,
 * grant custody permissions, or establish beneficiary rights.
 */
export type WalletVerificationResult =
  | {
      readonly status: "verified";
      readonly challengeId: string;
      readonly network: NetworkId;
      readonly address: string;
      readonly subject: string | null;
      readonly verifiedAt: Date;
    }
  | {
      readonly status: "invalid_signature";
      readonly challengeId: string;
    }
  | {
      readonly status: "not_found";
      readonly challengeId: string;
    }
  | {
      readonly status: "expired";
      readonly challengeId: string;
    }
  | {
      readonly status: "already_consumed";
      readonly challengeId: string;
    };
