import { Inject, Injectable } from "@nestjs/common";

import {
  forbiddenError,
  unauthorizedError,
  validationError,
} from "../common/errors/app-error.js";
import { CLOCK, type Clock } from "../wallet-verification/clock.js";
import { WalletVerificationService } from "../wallet-verification/wallet-verification.service.js";
import {
  WALLET_LINK_STORE,
  type LinkedWalletRecord,
  type WalletLinkStore,
} from "./wallet-link.store.js";

export interface LinkWalletInput {
  /**
   * User id resolved from the authenticated Carry session. This is only an
   * account identity; it never proves control of a wallet.
   */
  readonly authenticatedUserId: string;
  readonly challengeId: string;
  /** Signature produced by the wallet over the stored challenge message. */
  readonly signature: string;
  /** Public key that must control the challenged wallet address. */
  readonly publicKey: string;
}

const MAX_USER_ID_LENGTH = 128;

/**
 * Links a wallet to a Carry account after cryptographic ownership
 * verification.
 *
 * Security properties:
 * - A Carry session alone can never link a wallet; a wallet signature is
 *   mandatory.
 * - The challenge must be bound to the same authenticated account
 *   (`subject === authenticatedUserId`), so a signature phished from another
 *   user cannot be redeemed under a different session.
 * - A wallet that is already linked to another account is never reassigned.
 * - The challenge is consumed before any link decision, so a failed attempt
 *   cannot be retried with the same challenge.
 */
@Injectable()
export class WalletLinkingService {
  constructor(
    @Inject(WalletVerificationService)
    private readonly verification: WalletVerificationService,
    @Inject(WALLET_LINK_STORE)
    private readonly store: WalletLinkStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async linkWallet(input: LinkWalletInput): Promise<LinkedWalletRecord> {
    const userId = requireUserId(input.authenticatedUserId);
    requireNonEmptyString(input.challengeId, "A wallet challenge id is required.");
    // Explicitly require wallet proof. A valid session is not a substitute.
    requireNonEmptyString(
      input.signature,
      "A wallet signature is required to link a wallet.",
    );
    requireNonEmptyString(
      input.publicKey,
      "A wallet public key is required to link a wallet.",
    );

    const result = await this.verification.verifyChallenge({
      challengeId: input.challengeId,
      signature: input.signature,
      publicKey: input.publicKey,
    });

    if (result.status !== "verified") {
      // Deliberately do not reveal which stage failed: unknown, expired and
      // replayed challenges are all reported as an unusable challenge.
      throw unauthorizedError("Wallet ownership could not be verified.");
    }

    if (result.subject === null) {
      throw forbiddenError(
        "Wallet challenge is not bound to a Carry account.",
      );
    }

    if (result.subject !== userId) {
      throw forbiddenError(
        "Wallet challenge belongs to a different Carry account.",
      );
    }

    const chain = result.network;
    const key = {
      chain,
      network: result.network,
      normalizedAddress: result.address,
    } as const;

    const existing = await this.store.findByAddress(key);

    if (existing !== null) {
      if (existing.userId !== userId) {
        throw forbiddenError(
          "This wallet is already linked to another account.",
        );
      }

      return existing;
    }

    const created = await this.store.create({
      userId,
      chain,
      network: result.network,
      address: result.address,
      normalizedAddress: result.address,
      verifiedAt: this.clock.now(),
    });

    if (created.status === "conflict" && created.wallet.userId !== userId) {
      throw forbiddenError(
        "This wallet is already linked to another account.",
      );
    }

    return created.wallet;
  }
}

function requireUserId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_USER_ID_LENGTH
  ) {
    throw unauthorizedError("An authenticated Carry account is required.");
  }

  return value;
}

function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(message);
  }

  return value;
}
