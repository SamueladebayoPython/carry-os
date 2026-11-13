import type { WalletChallenge } from "./wallet-verification.types.js";

export const WALLET_CHALLENGE_STORE = Symbol(
  "WALLET_CHALLENGE_STORE",
);

export type ChallengeConsumption =
  | {
      readonly status: "consumed";
      readonly challenge: WalletChallenge;
    }
  | {
      readonly status: "not_found";
    }
  | {
      readonly status: "expired";
    }
  | {
      readonly status: "already_consumed";
    };

/**
 * Challenge persistence contract.
 *
 * `consume` must be atomic: for one challenge ID, at most one caller may
 * receive `{ status: "consumed" }`.
 */
export interface WalletChallengeStore {
  create(challenge: WalletChallenge): Promise<void>;
  consume(challengeId: string, now: Date): Promise<ChallengeConsumption>;
  deleteExpired(now: Date): Promise<number>;
}
