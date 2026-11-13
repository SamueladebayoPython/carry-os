import type {
  ChallengeConsumption,
  WalletChallengeStore,
} from "./challenge.store.js";
import type { WalletChallenge } from "./wallet-verification.types.js";

/**
 * In-memory challenge store for local development and tests only.
 *
 * It is not production-ready: state is lost on restart and is not shared
 * between multiple API instances. A production store must use an atomic
 * database or Redis operation. `WalletVerificationModule.forRoot` rejects this
 * store in production whether it is selected by default or supplied
 * explicitly.
 */
export class InMemoryWalletChallengeStore
  implements WalletChallengeStore
{
  private readonly challenges = new Map<string, WalletChallenge>();

  async create(challenge: WalletChallenge): Promise<void> {
    if (this.challenges.has(challenge.id)) {
      throw new Error("Duplicate wallet challenge ID.");
    }

    this.challenges.set(challenge.id, freezeChallenge(challenge));
  }

  async consume(
    challengeId: string,
    now: Date,
  ): Promise<ChallengeConsumption> {
    const challenge = this.challenges.get(challengeId);

    if (challenge === undefined) {
      return { status: "not_found" };
    }

    if (challenge.consumedAt !== null) {
      return { status: "already_consumed" };
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      return { status: "expired" };
    }

    // No await occurs before this replacement, so two concurrent callers
    // cannot both observe an unconsumed challenge.
    const consumed = freezeChallenge({
      ...challenge,
      consumedAt: new Date(now.getTime()),
    });

    this.challenges.set(challengeId, consumed);

    return { status: "consumed", challenge: consumed };
  }

  async deleteExpired(now: Date): Promise<number> {
    let deleted = 0;

    for (const [challengeId, challenge] of this.challenges) {
      if (challenge.expiresAt.getTime() <= now.getTime()) {
        this.challenges.delete(challengeId);
        deleted += 1;
      }
    }

    return deleted;
  }
}

function freezeChallenge(challenge: WalletChallenge): WalletChallenge {
  return Object.freeze({
    ...challenge,
    issuedAt: new Date(challenge.issuedAt.getTime()),
    expiresAt: new Date(challenge.expiresAt.getTime()),
    consumedAt:
      challenge.consumedAt === null
        ? null
        : new Date(challenge.consumedAt.getTime()),
  });
}
