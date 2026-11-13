import { Inject, Injectable } from "@nestjs/common";
import { networkIdSchema } from "@carry-os/shared";

import {
  internalServerError,
  validationError,
} from "../common/errors/app-error.js";
import { WalletChallengeService } from "./challenge.service.js";
import { CLOCK, type Clock } from "./clock.js";
import { WalletVerificationAdapterRegistry } from "./adapters/wallet-verification-adapter.registry.js";
import {
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "./wallet-verification.constants.js";
import type {
  IssueWalletChallengeInput,
  VerifyWalletChallengeInput,
  WalletChallenge,
  WalletVerificationResult,
} from "./wallet-verification.types.js";

const authenticVerifiedResults = new WeakSet<object>();

/** Returns true only for success values issued by this process's verifier. */
export function isAuthenticWalletVerificationResult(
  value: unknown,
): value is Extract<WalletVerificationResult, { status: "verified" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticVerifiedResults.has(value)
  );
}

/**
 * Internal wallet ownership verification engine.
 *
 * A successful result means only that an adapter verified control of the
 * stored address. This service does not create sessions, authenticate Carry OS
 * accounts, grant custody permissions, or establish beneficiary rights.
 */
@Injectable()
export class WalletVerificationService {
  constructor(
    @Inject(WalletChallengeService)
    private readonly challenges: WalletChallengeService,
    @Inject(WalletVerificationAdapterRegistry)
    private readonly adapters: WalletVerificationAdapterRegistry,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async issueChallenge(
    input: IssueWalletChallengeInput,
  ): Promise<WalletChallenge> {
    const parsedNetwork = networkIdSchema.safeParse(input.network);

    if (!parsedNetwork.success) {
      throw validationError("Unsupported wallet network.");
    }

    const adapter = this.adapters.require(parsedNetwork.data);

    return this.challenges.issue(adapter, input.address, input.subject);
  }

  async verifyChallenge(
    input: VerifyWalletChallengeInput,
  ): Promise<WalletVerificationResult> {
    const now = this.clock.now();
    const consumption = await this.challenges.consume(
      input.challengeId,
      now,
    );

    if (consumption.status === "not_found") {
      return {
        status: "not_found",
        challengeId: input.challengeId,
      };
    }

    if (consumption.status === "expired") {
      return { status: "expired", challengeId: input.challengeId };
    }

    if (consumption.status === "already_consumed") {
      return {
        status: "already_consumed",
        challengeId: input.challengeId,
      };
    }

    const challenge = consumption.challenge;

    if (
      challenge.purpose !== WALLET_OWNERSHIP_VERIFICATION_PURPOSE ||
      challenge.messageVersion !== WALLET_CHALLENGE_MESSAGE_VERSION
    ) {
      return {
        status: "invalid_signature",
        challengeId: challenge.id,
      };
    }

    const adapter = this.adapters.get(challenge.network);

    if (adapter === undefined) {
      throw validationError(
        "Wallet verification is not supported for this network.",
      );
    }

    let verified: unknown;

    try {
      verified = await adapter.verifySignature({
        address: challenge.address,
        message: challenge.message,
        signature: input.signature,
        nonce: challenge.nonce,
        publicKey: input.publicKey,
      });
    } catch (error: unknown) {
      throw internalServerError(error);
    }

    if (verified !== true && verified !== false) {
      throw internalServerError(
        new Error(
          "Wallet verification adapter returned a non-boolean result.",
        ),
      );
    }

    if (verified === false) {
      return {
        status: "invalid_signature",
        challengeId: challenge.id,
      };
    }

    const result = Object.freeze({
      status: "verified",
      challengeId: challenge.id,
      network: challenge.network,
      address: challenge.address,
      subject: challenge.subject,
      verifiedAt: this.clock.now(),
    } satisfies Extract<WalletVerificationResult, { status: "verified" }>);
    authenticVerifiedResults.add(result);
    return result;
  }

  cleanupExpiredChallenges(): Promise<number> {
    return this.challenges.cleanupExpired();
  }
}
