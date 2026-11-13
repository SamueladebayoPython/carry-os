import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { NetworkId } from "@carry-os/shared";

import { PrismaService } from "../database/prisma.service.js";
import type {
  CreateLinkedWalletInput,
  CreateLinkedWalletResult,
  LinkedWalletRecord,
  WalletLinkKey,
  WalletLinkStore,
} from "./wallet-link.store.js";

/** Structural view of the Prisma `LinkedWallet` row. */
interface LinkedWalletRow {
  id: string;
  userId: string;
  chain: string;
  network: string;
  address: string;
  normalizedAddress: string;
  verifiedAt: Date | null;
}

/**
 * Database-backed wallet link store.
 *
 * Ownership is enforced by the existing unique index on
 * `(chain, network, normalizedAddress)`. A racing insert surfaces as a
 * `P2002` unique violation, which is translated into `conflict` after
 * re-reading the winning row. The record is never reassigned.
 */
@Injectable()
export class PrismaWalletLinkStore implements WalletLinkStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService | null,
  ) {}

  async findByAddress(
    key: WalletLinkKey,
  ): Promise<LinkedWalletRecord | null> {
    const row = await this.requirePrisma().linkedWallet.findUnique({
      where: {
        chain_network_normalizedAddress: {
          chain: key.chain,
          network: key.network,
          normalizedAddress: key.normalizedAddress,
        },
      },
    });

    return row === null ? null : toRecord(row);
  }

  async create(
    input: CreateLinkedWalletInput,
  ): Promise<CreateLinkedWalletResult> {
    const prisma = this.requirePrisma();

    try {
      const row = await prisma.linkedWallet.create({
        data: {
          userId: input.userId,
          chain: input.chain,
          network: input.network,
          address: input.address,
          normalizedAddress: input.normalizedAddress,
          verifiedAt: input.verifiedAt,
        },
      });

      return { status: "created", wallet: toRecord(row) };
    } catch (error: unknown) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }

      const row = await prisma.linkedWallet.findUnique({
        where: {
          chain_network_normalizedAddress: {
            chain: input.chain,
            network: input.network,
            normalizedAddress: input.normalizedAddress,
          },
        },
      });

      // If the competing row disappeared between the insert and this read,
      // surface the original error rather than guessing.
      if (row === null) {
        throw error;
      }

      return { status: "conflict", wallet: toRecord(row) };
    }
  }

  private requirePrisma(): PrismaService {
    if (this.prisma === null) {
      throw new ServiceUnavailableException(
        "A configured database is required for wallet linking.",
      );
    }

    return this.prisma;
  }
}

function toRecord(row: LinkedWalletRow): LinkedWalletRecord {
  return Object.freeze({
    id: row.id,
    userId: row.userId,
    chain: row.chain,
    network: row.network as NetworkId,
    address: row.address,
    normalizedAddress: row.normalizedAddress,
    verifiedAt: row.verifiedAt ?? new Date(0),
  });
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
