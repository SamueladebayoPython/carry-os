import type { NetworkSupportEntry } from "@carry-os/shared";

/**
 * Chain-family classification. `unknown` is an explicit answer: it means the
 * network has not been confirmed as EVM-compatible or non-EVM, and must not be
 * treated as either.
 */
export const evmCompatibilities = ["evm", "non-evm", "unknown"] as const;

export type EvmCompatibility = (typeof evmCompatibilities)[number];

/**
 * Backend capabilities that a network may eventually provide. Listing a
 * capability here does not mean it exists.
 */
export const chainCapabilities = [
  "rpc",
  "nftDiscovery",
  "walletVerification",
  "custody",
  "transactions",
] as const;

export type ChainCapability = (typeof chainCapabilities)[number];

export const chainCapabilityStatuses = ["not-implemented"] as const;

export type ChainCapabilityStatus =
  (typeof chainCapabilityStatuses)[number];

export type ChainCapabilities = Readonly<
  Record<ChainCapability, ChainCapabilityStatus>
>;

/**
 * Internal backend view of a planned network. Identity, name, status and notes
 * are inherited from the shared network contract so there is only one source
 * of truth for network definitions.
 */
export interface ChainRegistryEntry extends NetworkSupportEntry {
  readonly evmCompatibility: EvmCompatibility;
  readonly capabilities: ChainCapabilities;
}
