import { z } from "zod";

/**
 * Networks named in the carry os product plan. Being listed here does not mean
 * a network integration exists. Every network starts as "planned".
 */
export const networkIds = [
  "ethereum",
  "solana",
  "near",
  "robinhood-chain",
] as const;

export type NetworkId = (typeof networkIds)[number];

export const networkImplementationStatuses = [
  "planned",
  "in-progress",
  "implemented",
] as const;

export type NetworkImplementationStatus =
  (typeof networkImplementationStatuses)[number];

export const networkIdSchema = z.enum(networkIds);

export const networkSupportEntrySchema = z.object({
  id: networkIdSchema,
  name: z.string().min(1),
  status: z.enum(networkImplementationStatuses),
  notes: z.string().min(1),
});

export type NetworkSupportEntry = z.infer<typeof networkSupportEntrySchema>;

/**
 * All supported networks are planned only. No network should be moved to
 * "implemented" until its integration and tests are complete.
 */
export const PLANNED_NETWORKS: readonly NetworkSupportEntry[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    status: "planned",
    notes: "Integration and testnet details are TBD.",
  },
  {
    id: "solana",
    name: "Solana",
    status: "planned",
    notes: "Integration and testnet details are TBD.",
  },
  {
    id: "near",
    name: "NEAR",
    status: "planned",
    notes: "Integration and testnet details are TBD.",
  },
  {
    id: "robinhood-chain",
    name: "Robinhood Chain",
    status: "planned",
    notes: "Network capabilities and integration dependencies are TBD.",
  },
];
