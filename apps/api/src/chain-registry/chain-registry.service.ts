import { Injectable } from "@nestjs/common";
import { networkIdSchema, type NetworkId } from "@carry-os/shared";

import { notFoundError } from "../common/errors/app-error.js";
import { CHAIN_REGISTRY } from "./chain-registry.entries.js";
import type { ChainRegistryEntry } from "./chain-registry.types.js";

/**
 * Read-only lookup over the internal chain registry. It performs no network
 * calls, holds no secrets, and exposes no product endpoint on its own.
 */
@Injectable()
export class ChainRegistryService {
  private readonly entriesById: ReadonlyMap<NetworkId, ChainRegistryEntry>;

  constructor() {
    this.entriesById = new Map(
      CHAIN_REGISTRY.map((entry) => [entry.id, entry] as const),
    );
  }

  list(): readonly ChainRegistryEntry[] {
    return CHAIN_REGISTRY;
  }

  get(id: string): ChainRegistryEntry | undefined {
    const parsed = networkIdSchema.safeParse(id);
    return parsed.success ? this.entriesById.get(parsed.data) : undefined;
  }

  has(id: string): boolean {
    return this.get(id) !== undefined;
  }

  require(id: string): ChainRegistryEntry {
    const entry = this.get(id);

    if (entry === undefined) {
      throw notFoundError("Chain not found.");
    }

    return entry;
  }
}
