import type { NetworkId } from "@carry-os/shared";

export const WALLET_LINK_STORE = Symbol("WALLET_LINK_STORE");

/**
 * Identity of a linked wallet. `normalizedAddress` is produced by the
 * chain-specific wallet-verification adapter, never by the client.
 *
 * `chain` and `network` are both the canonical network identifier today.
 * They are kept separate so a future chain family with multiple networks
 * (for example an EVM chain id) can be introduced without a schema change.
 */
export interface WalletLinkKey {
  readonly chain: string;
  readonly network: NetworkId;
  readonly normalizedAddress: string;
}

export interface LinkedWalletRecord {
  readonly id: string;
  readonly userId: string;
  readonly chain: string;
  readonly network: NetworkId;
  readonly address: string;
  readonly normalizedAddress: string;
  readonly verifiedAt: Date;
}

export interface CreateLinkedWalletInput {
  readonly userId: string;
  readonly chain: string;
  readonly network: NetworkId;
  readonly address: string;
  readonly normalizedAddress: string;
  readonly verifiedAt: Date;
}

export type CreateLinkedWalletResult =
  | {
      readonly status: "created";
      readonly wallet: LinkedWalletRecord;
    }
  | {
      readonly status: "conflict";
      readonly wallet: LinkedWalletRecord;
    };

/**
 * Persistence boundary for linked wallets.
 *
 * `create` must be atomic on `(chain, network, normalizedAddress)`. If a
 * record already exists it must return `conflict` with the existing record
 * rather than overwriting it, so a wallet can never be reassigned silently.
 */
export interface WalletLinkStore {
  findByAddress(key: WalletLinkKey): Promise<LinkedWalletRecord | null>;
  create(input: CreateLinkedWalletInput): Promise<CreateLinkedWalletResult>;
}
