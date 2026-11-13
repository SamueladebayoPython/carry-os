import type {
  CreateLinkedWalletInput,
  CreateLinkedWalletResult,
  LinkedWalletRecord,
  WalletLinkKey,
  WalletLinkStore,
} from "./wallet-link.store.js";

/**
 * In-memory wallet link store for local development and tests only.
 *
 * State is lost on restart and is not shared between API instances. The
 * production module wiring rejects this store so that a real unique
 * constraint protects wallet ownership.
 */
export class InMemoryWalletLinkStore implements WalletLinkStore {
  private readonly wallets = new Map<string, LinkedWalletRecord>();
  private nextId = 1;

  async findByAddress(key: WalletLinkKey): Promise<LinkedWalletRecord | null> {
    return this.wallets.get(storeKey(key)) ?? null;
  }

  async create(
    input: CreateLinkedWalletInput,
  ): Promise<CreateLinkedWalletResult> {
    const key = storeKey(input);
    const existing = this.wallets.get(key);

    if (existing !== undefined) {
      return { status: "conflict", wallet: existing };
    }

    // No await occurs between the lookup above and this insert, so two
    // concurrent callers cannot both observe an absent record.
    const wallet: LinkedWalletRecord = Object.freeze({
      id: `wallet-${this.nextId}`,
      userId: input.userId,
      chain: input.chain,
      network: input.network,
      address: input.address,
      normalizedAddress: input.normalizedAddress,
      verifiedAt: new Date(input.verifiedAt.getTime()),
    });

    this.nextId += 1;
    this.wallets.set(key, wallet);

    return { status: "created", wallet };
  }
}

function storeKey(key: WalletLinkKey): string {
  return JSON.stringify([
    key.chain,
    key.network,
    key.normalizedAddress,
  ]);
}
