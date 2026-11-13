import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";

interface NftToken {
  token_id: string;
  owner_id: string;
  metadata?: { title?: string | null; media?: string | null } | null;
}

interface CustodyRecord {
  collection_id: string;
  token_id: string;
  depositor_id: string;
  beneficiary_id: string;
  pending_withdrawal_id: number | null;
}

export interface NearNftState {
  collectionId: string;
  tokenId: string;
  title: string;
  media: string | null;
  ownerId: string;
  depositorId: string | null;
  beneficiaryId: string | null;
  secured: boolean;
  pendingWithdrawal: boolean;
  custodyStatus: "not_secured" | "secured" | "withdrawal_pending" | "inconsistent";
}

const MAX_TOKENS_PER_DISCOVERY = 100;
const MAX_CUSTODY_RPC_CONCURRENCY = 8;

@Injectable()
export class NearChainService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async listDemoNfts(accountId: string): Promise<NearNftState[]> {
    const collectionId = this.config.nearDemoNftAccountId;
    const vaultId = this.config.nearVaultAccountId;
    if (!collectionId || !vaultId) {
      throw new ServiceUnavailableException("NEAR demo contract account IDs are not configured.");
    }

    const blockHeight = await this.finalizedBlockHeight();
    const [owned, all] = await Promise.all([
      this.view<NftToken[]>(collectionId, "nft_tokens_for_owner", {
        account_id: accountId,
        from_index: "0",
        limit: MAX_TOKENS_PER_DISCOVERY,
      }, blockHeight),
      this.view<NftToken[]>(collectionId, "nft_tokens", {
        from_index: "0",
        limit: MAX_TOKENS_PER_DISCOVERY,
      }, blockHeight),
    ]);
    const custody = await mapWithConcurrency(all, MAX_CUSTODY_RPC_CONCURRENCY, (token) =>
      this.view<CustodyRecord | null>(vaultId, "get_custody", {
        collection_id: collectionId,
        token_id: token.token_id,
      }, blockHeight),
    );

    const results = new Map<string, NearNftState>();
    for (const token of owned) {
      results.set(token.token_id, this.toState(collectionId, token, null, accountId, vaultId));
    }
    all.forEach((token, index) => {
      const record = custody[index];
      const linkedToAccount = record
        ? record.depositor_id === accountId || record.beneficiary_id === accountId
        : token.owner_id === vaultId;
      if (linkedToAccount) {
        results.set(token.token_id, this.toState(collectionId, token, record ?? null, accountId, vaultId));
      }
    });
    return [...results.values()];
  }

  private toState(
    collectionId: string,
    token: NftToken,
    record: CustodyRecord | null,
    accountId: string,
    vaultId: string,
  ): NearNftState {
    const actualOwnerIsVault = token.owner_id === vaultId;
    const pendingWithdrawal = record?.pending_withdrawal_id !== null
      && record?.pending_withdrawal_id !== undefined;
    let custodyStatus: NearNftState["custodyStatus"];
    if (!record) {
      custodyStatus = actualOwnerIsVault ? "inconsistent" : "not_secured";
    } else if (pendingWithdrawal && (actualOwnerIsVault || token.owner_id === record.beneficiary_id)) {
      custodyStatus = "withdrawal_pending";
    } else if (actualOwnerIsVault) {
      custodyStatus = "secured";
    } else {
      custodyStatus = "inconsistent";
    }
    const secured = record !== null && actualOwnerIsVault;
    return {
      collectionId,
      tokenId: token.token_id,
      title: token.metadata?.title || token.token_id,
      media: token.metadata?.media ?? null,
      ownerId: token.owner_id,
      depositorId: record?.depositor_id ?? null,
      beneficiaryId: record?.beneficiary_id ?? null,
      secured,
      pendingWithdrawal,
      custodyStatus,
    };
  }

  private async finalizedBlockHeight(): Promise<number> {
    let response: Response;
    try {
      response = await fetch(this.config.nearTestnetRpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "carry-os-api",
          method: "block",
          params: { finality: "final" },
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ServiceUnavailableException("NEAR testnet RPC is unavailable.");
    }
    if (!response.ok) throw new ServiceUnavailableException("NEAR testnet RPC is unavailable.");

    try {
      const payload = await response.json() as {
        result?: { header?: { height?: number } };
        error?: unknown;
      };
      const height = payload.result?.header?.height;
      if (payload.error || !Number.isSafeInteger(height) || !height) throw new Error("RPC finalized block query failed");
      return height;
    } catch {
      throw new ServiceUnavailableException("NEAR testnet finalized block query failed.");
    }
  }

  private async view<T>(accountId: string, methodName: string, args: object, blockHeight: number): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.config.nearTestnetRpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "carry-os-api",
          method: "query",
          params: {
            request_type: "call_function",
            block_id: blockHeight,
            account_id: accountId,
            method_name: methodName,
            args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
          },
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ServiceUnavailableException("NEAR testnet RPC is unavailable.");
    }
    if (!response.ok) throw new ServiceUnavailableException("NEAR testnet RPC is unavailable.");

    try {
      const payload = await response.json() as {
        result?: { result?: number[] };
        error?: unknown;
      };
      if (payload.error || !payload.result?.result) throw new Error("RPC view call failed");
      return JSON.parse(Buffer.from(payload.result.result).toString("utf8")) as T;
    } catch {
      throw new ServiceUnavailableException("NEAR testnet contract view failed.");
    }
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]!);
    }
  }));
  return results;
}
