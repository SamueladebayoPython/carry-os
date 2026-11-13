import { Inject, Injectable } from "@nestjs/common";
import type { NetworkId } from "@carry-os/shared";

import { validationError } from "../../common/errors/app-error.js";
import type { WalletVerificationAdapter } from "./wallet-verification-adapter.js";

export const WALLET_VERIFICATION_ADAPTERS = Symbol(
  "WALLET_VERIFICATION_ADAPTERS",
);

@Injectable()
export class WalletVerificationAdapterRegistry {
  private readonly adaptersByNetwork: ReadonlyMap<
    NetworkId,
    WalletVerificationAdapter
  >;

  constructor(
    @Inject(WALLET_VERIFICATION_ADAPTERS)
    adapters: readonly WalletVerificationAdapter[],
  ) {
    const adaptersByNetwork = new Map<
      NetworkId,
      WalletVerificationAdapter
    >();

    for (const adapter of adapters) {
      if (adaptersByNetwork.has(adapter.network)) {
        throw new Error(
          `Duplicate wallet verification adapter for ${adapter.network}.`,
        );
      }

      adaptersByNetwork.set(adapter.network, adapter);
    }

    this.adaptersByNetwork = adaptersByNetwork;
  }

  get(network: NetworkId): WalletVerificationAdapter | undefined {
    return this.adaptersByNetwork.get(network);
  }

  require(network: NetworkId): WalletVerificationAdapter {
    const adapter = this.get(network);

    if (adapter === undefined) {
      throw validationError(
        "Wallet verification is not supported for this network.",
      );
    }

    return adapter;
  }
}
