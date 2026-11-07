import { z } from "zod";

/**
 * Contract for the API liveness response. Product health and readiness checks
 * are intentionally separate concerns and are not defined yet.
 */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("carry-os-api"),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
