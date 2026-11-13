import assert from "node:assert/strict";
import test from "node:test";

import { AppConfigService } from "../dist/config/app-config.service.js";
import { loadAppConfig } from "../dist/config/app-config.js";
import { NearChainService } from "../dist/near-chain/near-chain.service.js";

function rpcResponse(value) {
  return new Response(JSON.stringify({
    result: { result: [...Buffer.from(JSON.stringify(value), "utf8")] },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("NearChainService reads NFT ownership and custody from configured NEAR contracts", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request.params);
    if (request.method === "block") {
      return new Response(JSON.stringify({ result: { header: { height: 123 } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const { method_name: method, args_base64: encoded } = request.params;
    const args = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (method === "nft_tokens_for_owner") {
      return rpcResponse([{ token_id: "token-2", owner_id: "alice.testnet", metadata: { title: "Wallet NFT" } }]);
    }
    if (method === "nft_tokens") {
      return rpcResponse([
        { token_id: "token-1", owner_id: "carry-vault.testnet", metadata: { title: "Secured NFT" } },
        { token_id: "token-2", owner_id: "alice.testnet", metadata: { title: "Wallet NFT" } },
      ]);
    }
    if (method === "get_custody") {
      return rpcResponse(args.token_id === "token-1" ? {
        collection_id: "carry-demo-nft.testnet",
        token_id: "token-1",
        depositor_id: "alice.testnet",
        beneficiary_id: "beneficiary.testnet",
        pending_withdrawal_id: null,
      } : null);
    }
    throw new Error(`Unexpected NEAR view method: ${method}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const config = loadAppConfig({
    NEAR_VAULT_ACCOUNT_ID: "carry-vault.testnet",
    NEAR_DEMO_NFT_ACCOUNT_ID: "carry-demo-nft.testnet",
  });
  const service = new NearChainService(new AppConfigService(config));
  const results = await service.listDemoNfts("alice.testnet");

  assert.deepEqual(results.map(({ tokenId, secured }) => ({ tokenId, secured })), [
    { tokenId: "token-2", secured: false },
    { tokenId: "token-1", secured: true },
  ]);
  assert.equal(results[1].ownerId, "carry-vault.testnet");
  assert.equal(results[1].depositorId, "alice.testnet");
  assert.equal(results[1].beneficiaryId, "beneficiary.testnet");
  assert.equal(results[1].custodyStatus, "secured");
  assert.equal(results[1].secured, true);
  assert.equal(results[0].custodyStatus, "not_secured");
  const viewRequests = requests.filter((request) => request.request_type === "call_function");
  assert.ok(viewRequests.every((request) => ["carry-demo-nft.testnet", "carry-vault.testnet"].includes(request.account_id)));
  assert.ok(viewRequests.every((request) => request.block_id === 123));
  assert.equal(requests[0].finality, "final");
});

test("stale custody record is inconsistent when NFT ownership is outside the vault", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === "block") {
      return new Response(JSON.stringify({ result: { header: { height: 456 } } }), { status: 200 });
    }
    const { method_name: method, args_base64: encoded } = request.params;
    const args = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (method === "nft_tokens_for_owner") return rpcResponse([]);
    if (method === "nft_tokens") return rpcResponse([
      { token_id: "stale-1", owner_id: "beneficiary.testnet", metadata: { title: "Stale record" } },
      { token_id: "pending-1", owner_id: "beneficiary.testnet", metadata: { title: "Pending release" } },
      { token_id: "mismatch-1", owner_id: "other.testnet", metadata: { title: "Ownership mismatch" } },
      { token_id: "orphan-1", owner_id: "carry-vault.testnet", metadata: { title: "Unrecorded vault NFT" } },
    ]);
    if (method === "get_custody") {
      const records = {
        "stale-1": { depositor_id: "alice.testnet", beneficiary_id: "beneficiary.testnet", pending_withdrawal_id: null },
        "pending-1": { depositor_id: "alice.testnet", beneficiary_id: "beneficiary.testnet", pending_withdrawal_id: 4 },
        "mismatch-1": { depositor_id: "alice.testnet", beneficiary_id: "beneficiary.testnet", pending_withdrawal_id: null },
      };
      const record = records[args.token_id];
      return rpcResponse(record ? { collection_id: "carry-demo-nft.testnet", token_id: args.token_id, ...record } : null);
    }
    throw new Error(`Unexpected method ${method}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const config = loadAppConfig({
    NEAR_VAULT_ACCOUNT_ID: "carry-vault.testnet",
    NEAR_DEMO_NFT_ACCOUNT_ID: "carry-demo-nft.testnet",
  });
  const service = new NearChainService(new AppConfigService(config));
  const results = await service.listDemoNfts("alice.testnet");
  const byToken = new Map(results.map((item) => [item.tokenId, item]));

  assert.equal(byToken.get("stale-1").custodyStatus, "inconsistent");
  assert.equal(byToken.get("stale-1").secured, false);
  assert.equal(byToken.get("stale-1").ownerId, "beneficiary.testnet");
  assert.equal(byToken.get("pending-1").custodyStatus, "withdrawal_pending");
  assert.equal(byToken.get("pending-1").secured, false);
  assert.equal(byToken.get("mismatch-1").custodyStatus, "inconsistent");
  assert.equal(byToken.get("mismatch-1").ownerId, "other.testnet");
  assert.equal(byToken.get("orphan-1").custodyStatus, "inconsistent");
  assert.equal(byToken.get("orphan-1").ownerId, "carry-vault.testnet");
});

test("custody RPC fan-out is bounded per discovery request", async (t) => {
  const originalFetch = globalThis.fetch;
  let activeCustodyReads = 0;
  let maxCustodyReads = 0;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === "block") {
      return new Response(JSON.stringify({ result: { header: { height: 789 } } }), { status: 200 });
    }
    const { method_name: method } = request.params;
    if (method === "nft_tokens_for_owner") return rpcResponse([]);
    if (method === "nft_tokens") return rpcResponse(Array.from({ length: 24 }, (_, index) => ({
      token_id: `token-${index}`,
      owner_id: "carry-vault.testnet",
    })));
    if (method === "get_custody") {
      activeCustodyReads += 1;
      maxCustodyReads = Math.max(maxCustodyReads, activeCustodyReads);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeCustodyReads -= 1;
      return rpcResponse(null);
    }
    throw new Error(`Unexpected method ${method}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const config = loadAppConfig({
    NEAR_VAULT_ACCOUNT_ID: "carry-vault.testnet",
    NEAR_DEMO_NFT_ACCOUNT_ID: "carry-demo-nft.testnet",
  });
  const service = new NearChainService(new AppConfigService(config));
  await service.listDemoNfts("alice.testnet");
  assert.ok(maxCustodyReads <= 8);
  assert.ok(maxCustodyReads > 1);
});
