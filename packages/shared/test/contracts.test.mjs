import assert from "node:assert/strict";
import test from "node:test";

import {
  healthResponseSchema,
  networkIds,
  PLANNED_NETWORKS,
  networkSupportEntrySchema,
} from "../dist/index.js";

test("health response contract accepts the documented shape", () => {
  const result = healthResponseSchema.safeParse({
    status: "ok",
    service: "carry-os-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.success, true);
});

test("health response contract rejects an invalid status", () => {
  const result = healthResponseSchema.safeParse({
    status: "degraded",
    service: "carry-os-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.success, false);
});

test("every planned network is validated and none is marked implemented", () => {
  assert.equal(PLANNED_NETWORKS.length, networkIds.length);

  for (const network of PLANNED_NETWORKS) {
    const result = networkSupportEntrySchema.safeParse(network);
    assert.equal(result.success, true);
    assert.equal(network.status, "planned");
  }
});
