import { Inject, Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";

import { internalServerError, validationError } from "../common/errors/app-error.js";
import { buildWalletChallengeMessage } from "./challenge.message.js";
import {
  WALLET_CHALLENGE_STORE,
  type ChallengeConsumption,
  type WalletChallengeStore,
} from "./challenge.store.js";
import { CLOCK, type Clock } from "./clock.js";
import {
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_CHALLENGE_NONCE_BYTES,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "./wallet-verification.constants.js";
import {
  WALLET_VERIFICATION_CONFIG,
  type WalletVerificationConfig,
} from "./wallet-verification.config.js";
import type { WalletChallenge } from "./wallet-verification.types.js";
import type { WalletVerificationAdapter } from "./adapters/wallet-verification-adapter.js";

@Injectable()
export class WalletChallengeService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(WALLET_CHALLENGE_STORE)
    private readonly store: WalletChallengeStore,
    @Inject(WALLET_VERIFICATION_CONFIG)
    private readonly config: WalletVerificationConfig,
  ) {}

  async issue(
    adapter: WalletVerificationAdapter,
    address: string,
    subject: string | null = null,
  ): Promise<WalletChallenge> {
    const normalizedAddress = adapter.normalizeAddress(address);
    const normalizedSubject = normalizeSubject(subject);

    if (
      typeof normalizedAddress !== "string" ||
      normalizedAddress.trim().length === 0
    ) {
      throw internalServerError(
        new Error(
          "Wallet verification adapter returned an invalid normalized address.",
        ),
      );
    }

    const issuedAt = this.clock.now();

    if (!isValidDate(issuedAt)) {
      throw internalServerError(
        new Error("Wallet verification clock returned an invalid date."),
      );
    }

    const expiresAt = new Date(
      issuedAt.getTime() + this.config.challengeTtlMs,
    );

    if (
      !isValidDate(expiresAt) ||
      expiresAt.getTime() <= issuedAt.getTime()
    ) {
      throw internalServerError(
        new Error("Wallet verification challenge expiry is invalid."),
      );
    }

    const nonce = randomBytes(WALLET_CHALLENGE_NONCE_BYTES).toString(
      "base64url",
    );
    const message = buildWalletChallengeMessage({
      trustedDomain: this.config.trustedDomain,
      network: adapter.network,
      address: normalizedAddress,
      nonce,
      issuedAt,
      expiresAt,
    });

    const challenge = Object.freeze({
      id: randomUUID(),
      nonce,
      network: adapter.network,
      address: normalizedAddress,
      subject: normalizedSubject,
      message,
      purpose: WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
      messageVersion: WALLET_CHALLENGE_MESSAGE_VERSION,
      issuedAt,
      expiresAt,
      consumedAt: null,
    } satisfies WalletChallenge);

    await this.store.create(challenge);

    return challenge;
  }

  consume(
    challengeId: string,
    now: Date,
  ): Promise<ChallengeConsumption> {
    return this.store.consume(challengeId, now);
  }

  cleanupExpired(): Promise<number> {
    return this.store.deleteExpired(this.clock.now());
  }
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

const MAX_SUBJECT_LENGTH = 128;

/**
 * A challenge subject is the authenticated Carry account that will redeem the
 * challenge. It is stored verbatim (after trimming) and must be present in the
 * verification result so the linking layer can reject cross-account reuse.
 */
function normalizeSubject(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw validationError("Invalid wallet challenge subject.");
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_SUBJECT_LENGTH ||
    containsControlCharacter(trimmed)
  ) {
    throw validationError("Invalid wallet challenge subject.");
  }

  return trimmed;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}
