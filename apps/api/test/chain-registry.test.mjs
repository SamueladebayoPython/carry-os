import assert from "node:assert/strict";
import test from "node:test";

import {
  networkIds,
  networkSupportEntrySchema,
  PLANNED_NETWORKS,
} from "@carry-os/shared";

import { createApp } from "../dist/bootstrap.js";
import { CHAIN_REGISTRY } from "../dist/chain-registry/chain-registry.entries.js";
import { ChainRegistryService } from "../dist/chain-registry/chain-registry.service.js";

const EXPECTED_NETWORK_IDS = [
  "ethereum",
  "solana",
  "near",
  "robinhood-chain",
];

const EXPECTED_CAPABILITIES = [
  "rpc",
  "nftDiscovery",
  "walletVerification",
  "custody",
  "transactions",
];

const EXPECTED_EVM_COMPATIBILITY = {
  ethereum: "evm",
  solana: "non-evm",
  near: "non-evm",
  "robinhood-chain": "unknown",
};

const PROHIBITED_FIELDS = [
  "chainId",
  "evmChainId",
  "rpcUrl",
  "rpcUrls",
  "testnet",
  "mainnet",
  "tokenStandards",
  "contractAddress",
  "programId",
  "vaultAddress",
];

function registryEntry(id) {
  const entry = CHAIN_REGISTRY.find((candidate) => candidate.id === id);
  assert.ok(entry, `expected a registry entry for ${id}`);
  return entry;
}

test("registry covers exactly the shared planned networks", () => {
  assert.deepEqual(
    CHAIN_REGISTRY.map((entry) => entry.id),
    EXPECTED_NETWORK_IDS,
  );
  assert.deepEqual([...networkIds], EXPECTED_NETWORK_IDS);
  assert.equal(CHAIN_REGISTRY.length, PLANNED_NETWORKS.length);
  assert.equal(
    new Set(CHAIN_REGISTRY.map((entry) => entry.id)).size,
    CHAIN_REGISTRY.length,
  );
});

test("registry entries stay consistent with the shared network contract", () => {
  for (const entry of CHAIN_REGISTRY) {
    const planned = PLANNED_NETWORKS.find(
      (candidate) => candidate.id === entry.id,
    );

    assert.ok(planned, `expected a planned network for ${entry.id}`);
    assert.equal(networkSupportEntrySchema.safeParse(entry).success, true);
    assert.equal(entry.name, planned.name);
    assert.equal(entry.status, planned.status);
    assert.equal(entry.notes, planned.notes);
  }
});

test("all four networks remain planned", () => {
  for (const entry of CHAIN_REGISTRY) {
    assert.equal(entry.status, "planned");
  }
});

test("every capability is explicitly not implemented", () => {
  for (const entry of CHAIN_REGISTRY) {
    assert.deepEqual(
      Object.keys(entry.capabilities).sort(),
      [...EXPECTED_CAPABILITIES].sort(),
    );

    for (const capability of EXPECTED_CAPABILITIES) {
      assert.equal(entry.capabilities[capability], "not-implemented");
    }
  }
});

test("EVM compatibility is recorded without assuming Robinhood Chain is EVM", () => {
  for (const [id, expected] of Object.entries(
    EXPECTED_EVM_COMPATIBILITY,
  )) {
    assert.equal(registryEntry(id).evmCompatibility, expected);
  }
});

test("registry entries contain no invented chain identifiers or endpoints", () => {
  for (const entry of CHAIN_REGISTRY) {
    for (const field of PROHIBITED_FIELDS) {
      assert.equal(
        Object.hasOwn(entry, field),
        false,
        `${entry.id} must not declare ${field}`,
      );
    }
  }
});

test("registry entries and nested capability maps are frozen", () => {
  assert.equal(Object.isFrozen(CHAIN_REGISTRY), true);

  for (const entry of CHAIN_REGISTRY) {
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.capabilities), true);

    assert.throws(() => {
      entry.status = "implemented";
    }, TypeError);
    assert.throws(() => {
      entry.capabilities.rpc = "implemented";
    }, TypeError);

    assert.equal(entry.status, "planned");
    assert.equal(entry.capabilities.rpc, "not-implemented");
  }
});

test("service lists and resolves every registry entry", () => {
  const service = new ChainRegistryService();
  const entries = service.list();

  assert.equal(entries.length, EXPECTED_NETWORK_IDS.length);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    EXPECTED_NETWORK_IDS,
  );

  for (const id of EXPECTED_NETWORK_IDS) {
    assert.equal(service.get(id).id, id);
    assert.equal(service.has(id), true);
  }
});

test("service rejects unknown or unsafe identifiers", () => {
  const service = new ChainRegistryService();

  for (const id of [
    "unknown",
    "ETHEREUM",
    "",
    "__proto__",
    "constructor",
    "toString",
  ]) {
    assert.equal(service.get(id), undefined);
    assert.equal(service.has(id), false);
  }
});

test("service require returns a known entry and throws the existing not-found error", () => {
  const service = new ChainRegistryService();

  assert.equal(service.require("near").id, "near");

  assert.throws(
    () => service.require("unknown"),
    (error) => {
      assert.equal(error.name, "AppError");
      assert.equal(error.code, "NOT_FOUND");
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, "Chain not found.");
      return true;
    },
  );
});

test("ChainRegistryService is injectable from the application module", async (t) => {
  const app = await createApp({ logger: false, env: {} });

  t.after(async () => {
    await app.close();
  });

  const service = app.get(ChainRegistryService);

  assert.ok(service instanceof ChainRegistryService);
  assert.deepEqual(
    service.list().map((entry) => entry.id),
    EXPECTED_NETWORK_IDS,
  );
});

test("registry stays internal and adds no HTTP endpoint", async (t) => {
  const app = await createApp({ logger: false, env: {} });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/networks`,
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.code, "NOT_FOUND");
});
