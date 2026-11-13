declare module "@near-wallet-selector/core" {
  export interface WalletSelectorAccount {
    accountId: string;
    active: boolean;
  }
  export interface WalletSelector {
    store: {
      getState(): { accounts: WalletSelectorAccount[] };
      observable: {
        subscribe(listener: (state: { accounts: WalletSelectorAccount[] }) => void): { unsubscribe(): void };
      };
    };
    wallet(): Promise<{
      signOut(): Promise<void>;
      signAndSendTransaction(transaction: {
        signerId: string;
        receiverId: string;
        actions: unknown[];
      }): Promise<unknown>;
    }>;
  }
  export const actionCreators: {
    functionCall(methodName: string, args: object, gas: bigint, deposit: bigint): unknown;
  };
  export function setupWalletSelector(options: {
    network: "testnet" | "mainnet";
    modules: unknown[];
  }): Promise<WalletSelector>;
}

declare module "@near-wallet-selector/modal-ui" {
  import type { WalletSelector } from "@near-wallet-selector/core";
  export function setupModal(selector: WalletSelector, options?: { contractId?: string }): { show(): void };
}

declare module "@near-wallet-selector/meteor-wallet" {
  export function setupMeteorWallet(): unknown;
}

declare module "@near-wallet-selector/my-near-wallet" {
  export function setupMyNearWallet(): unknown;
}
