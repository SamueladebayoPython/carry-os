import { actionCreators, setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";

const RPC_URL = resolveRpcUrl(process.env.NEXT_PUBLIC_NEAR_RPC_URL);
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const VAULT_ID = process.env.NEXT_PUBLIC_NEAR_VAULT_ID ?? "";
const COLLECTION_ID = process.env.NEXT_PUBLIC_NEAR_DEMO_NFT_ID ?? "";
const GAS = "100000000000000";
const ONE_NEAR = "1000000000000000000000000";

function resolveRpcUrl(value: string | undefined): string {
  const candidate = value?.trim() || "https://rpc.testnet.near.org";
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("NEXT_PUBLIC_NEAR_RPC_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_NEAR_RPC_URL must use HTTPS and contain no credentials.");
  }
  return url.toString();
}

export interface NearNft {
  collectionId: string;
  tokenId: string;
  title: string;
  media: string | null;
  ownerId: string;
  beneficiaryId: string | null;
  depositorId: string | null;
  secured: boolean;
  pendingWithdrawal: boolean;
  custodyStatus: "not_secured" | "secured" | "withdrawal_pending" | "inconsistent";
}

let selectorPromise: Promise<WalletSelector> | undefined;

export function getWalletSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = setupWalletSelector({
      network: "testnet",
      modules: [setupMeteorWallet(), setupMyNearWallet()],
    });
  }
  return selectorPromise;
}

export async function openWalletSelector(): Promise<void> {
  const selector = await getWalletSelector();
  setupModal(selector, { contractId: VAULT_ID || undefined }).show();
}

export async function connectNearWallet(): Promise<string> {
  const selector = await getWalletSelector();
  const connected = selector.store.getState().accounts.find((account) => account.active)?.accountId;
  if (connected) return connected;
  return new Promise((resolve, reject) => {
    const subscription = selector.store.observable.subscribe((state) => {
      const accountId = state.accounts.find((account) => account.active)?.accountId;
      if (accountId) {
        subscription.unsubscribe();
        clearTimeout(timeout);
        resolve(accountId);
      }
    });
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error("Wallet connection timed out. Reopen the NEAR wallet selector to try again."));
    }, 180_000);
    setupModal(selector, { contractId: VAULT_ID || undefined }).show();
  });
}

export async function disconnectNearWallet(): Promise<void> {
  const selector = await getWalletSelector();
  const wallet = await selector.wallet();
  await wallet.signOut();
}

export async function getConnectedAccount(): Promise<string | null> {
  const selector = await getWalletSelector();
  return selector.store.getState().accounts.find((account) => account.active)?.accountId ?? null;
}

function assertConfigured(): void {
  if (!VAULT_ID || !COLLECTION_ID) {
    throw new Error("Set NEXT_PUBLIC_NEAR_VAULT_ID and NEXT_PUBLIC_NEAR_DEMO_NFT_ID after deploying the testnet contracts.");
  }
}

async function view<T>(contractId: string, methodName: string, args: object): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "carry-os",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`NEAR RPC returned HTTP ${response.status}.`);
  const payload = await response.json() as { result?: { result?: number[] }; error?: { message?: string } };
  if (payload.error || !payload.result?.result) throw new Error(payload.error?.message ?? "NEAR view call failed.");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(payload.result.result))) as T;
}

async function send(contractId: string, methodName: string, args: object, deposit = "0"): Promise<void> {
  const selector = await getWalletSelector();
  const account = selector.store.getState().accounts.find((item) => item.active)?.accountId;
  if (!account) throw new Error("Connect a NEAR wallet before signing this transaction.");
  const wallet = await selector.wallet();
  const outcome = await wallet.signAndSendTransaction({
    signerId: account,
    receiverId: contractId,
    actions: [actionCreators.functionCall(methodName, args, BigInt(GAS), BigInt(deposit))],
  });
  const status = (outcome as { status?: Record<string, unknown> } | null)?.status;
  if (status && "Failure" in status) {
    const failure = status.Failure;
    throw new Error(typeof failure === "string" ? failure : JSON.stringify(failure));
  }
}

export async function discoverNfts(accountId: string): Promise<NearNft[]> {
  assertConfigured();
  const response = await fetch(`${API_URL}/near/nfts?owner_id=${encodeURIComponent(accountId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? `Carry API could not read NEAR custody state (HTTP ${response.status}).`);
  }
  return await response.json() as NearNft[];
}

export async function depositNft(tokenId: string, beneficiaryId: string): Promise<void> {
  assertConfigured();
  const accountId = await getConnectedAccount();
  if (!accountId) throw new Error("Connect the original depositor wallet before depositing.");
  const balance = await view<string | null>(VAULT_ID, "storage_balance_of", { account_id: accountId });
  if (!balance || BigInt(balance) === 0n) await send(VAULT_ID, "storage_deposit", {}, ONE_NEAR);
  await send(COLLECTION_ID, "nft_transfer_call", {
    receiver_id: VAULT_ID,
    token_id: tokenId,
    msg: JSON.stringify({ beneficiary_id: beneficiaryId }),
  }, "1");
}

export async function reassignBeneficiary(tokenId: string, beneficiaryId: string): Promise<void> {
  assertConfigured();
  await send(VAULT_ID, "set_beneficiary", { collection_id: COLLECTION_ID, token_id: tokenId, beneficiary_id: beneficiaryId });
}

export async function withdrawNft(tokenId: string): Promise<void> {
  assertConfigured();
  await send(VAULT_ID, "withdraw", { collection_id: COLLECTION_ID, token_id: tokenId }, "1");
}
