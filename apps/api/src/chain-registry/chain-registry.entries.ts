import { PLANNED_NETWORKS, type NetworkId } from "@carry-os/shared";

import {
  chainCapabilities,
  type ChainCapabilities,
  type ChainCapabilityStatus,
  type ChainRegistryEntry,
  type EvmCompatibility,
} from "./chain-registry.types.js";

/**
 * EVM classification per planned network. A `Record` keyed by `NetworkId`
 * makes the mapping exhaustive at compile time, so adding a network to the
 * shared contract fails the build until its compatibility is decided.
 *
 * Robinhood Chain is deliberately `unknown`: EVM compatibility is an open
 * decision and must not be assumed.
 */
const EVM_COMPATIBILITY: Readonly<Record<NetworkId, EvmCompatibility>> = {
  ethereum: "evm",
  solana: "non-evm",
  near: "non-evm",
  "robinhood-chain": "unknown",
};

const NOT_IMPLEMENTED: ChainCapabilityStatus = "not-implemented";

/**
 * Builds a fresh, frozen capability map for one entry. Freezing the nested
 * object prevents callers from mutating registry truth through a returned
 * reference.
 */
function createCapabilities(): ChainCapabilities {
  const capabilities = Object.fromEntries(
    chainCapabilities.map((capability) => [capability, NOT_IMPLEMENTED]),
  ) as Record<(typeof chainCapabilities)[number], ChainCapabilityStatus>;

  return Object.freeze(capabilities);
}

/**
 * Backend chain registry derived from the shared planned-network contract.
 * Every entry is frozen, and every capability remains `not-implemented`.
 */
export const CHAIN_REGISTRY: readonly ChainRegistryEntry[] = Object.freeze(
  PLANNED_NETWORKS.map((network) =>
    Object.freeze({
      ...network,
      evmCompatibility: EVM_COMPATIBILITY[network.id],
      capabilities: createCapabilities(),
    }),
  ),
);
