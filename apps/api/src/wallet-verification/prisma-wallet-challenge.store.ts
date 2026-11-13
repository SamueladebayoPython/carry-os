import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { NetworkId } from "@carry-os/shared";

import { PrismaService } from "../database/prisma.service.js";
import type {
  ChallengeConsumption,
  WalletChallengeStore,
} from "./challenge.store.js";
import type { WalletChallenge } from "./wallet-verification.types.js";

interface WalletChallengeRow {
  id: string;
  nonce: string;
  network: string;
  address: string;
  subject: string | null;
  message: string;
  purpose: string;
  messageVersion: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** Durable challenge store. Consumption is a single conditional SQL UPDATE. */
@Injectable()
export class PrismaWalletChallengeStore implements WalletChallengeStore {
  readonly durable = true as const;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService | null,
  ) {}

  async create(challenge: WalletChallenge): Promise<void> {
    await this.requirePrisma().walletChallenge.create({
      data: {
        id: challenge.id,
        nonce: challenge.nonce,
        network: challenge.network,
        address: challenge.address,
        subject: challenge.subject,
        message: challenge.message,
        purpose: challenge.purpose,
        messageVersion: challenge.messageVersion,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
        consumedAt: null,
      },
    });
  }

  async consume(
    challengeId: string,
    now: Date,
  ): Promise<ChallengeConsumption> {
    const prisma = this.requirePrisma();
    const existing = await prisma.walletChallenge.findUnique({
      where: { id: challengeId },
    });

    if (existing === null) return { status: "not_found" };
    if (existing.consumedAt !== null) return { status: "already_consumed" };
    if (existing.expiresAt.getTime() <= now.getTime()) {
      return { status: "expired" };
    }

    // PostgreSQL evaluates both predicates as part of one atomic UPDATE.
    // Across API processes, exactly one competing caller can update this row.
    const update = await prisma.walletChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (update.count === 1) {
      return {
        status: "consumed",
        challenge: toChallenge({ ...existing, consumedAt: new Date(now) }),
      };
    }

    // Re-read only to classify the losing race. If the row remains usable,
    // the database response was inconsistent, so fail closed rather than
    // treating it as a consumed or missing challenge.
    const latest = await prisma.walletChallenge.findUnique({
      where: { id: challengeId },
    });
    if (latest === null) return { status: "not_found" };
    if (latest.consumedAt !== null) return { status: "already_consumed" };
    if (latest.expiresAt.getTime() <= now.getTime()) {
      return { status: "expired" };
    }

    throw new ServiceUnavailableException(
      "Wallet challenge storage could not confirm atomic consumption.",
    );
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.requirePrisma().walletChallenge.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }

  private requirePrisma(): PrismaService {
    if (this.prisma === null) {
      throw new ServiceUnavailableException(
        "A configured database is required for wallet verification.",
      );
    }
    return this.prisma;
  }
}

function toChallenge(row: WalletChallengeRow): WalletChallenge {
  return Object.freeze({
    id: row.id,
    nonce: row.nonce,
    network: row.network as NetworkId,
    address: row.address,
    subject: row.subject,
    message: row.message,
    purpose: row.purpose as WalletChallenge["purpose"],
    messageVersion: row.messageVersion as WalletChallenge["messageVersion"],
    issuedAt: new Date(row.issuedAt),
    expiresAt: new Date(row.expiresAt),
    consumedAt: row.consumedAt === null ? null : new Date(row.consumedAt),
  });
}
