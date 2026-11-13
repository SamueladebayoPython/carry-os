import { validationError } from "../../dist/common/errors/app-error.js";

/**
 * TEST-ONLY fake adapter.
 *
 * It performs no cryptography. It exists so tests can simulate valid and
 * invalid signatures while exercising the chain-agnostic engine.
 */
export class FakeWalletVerificationAdapter {
  constructor({
    network = "ethereum",
    verifyPredicate = () => true,
    normalizeAddress,
  } = {}) {
    this.network = network;
    this.calls = [];
    this.verifyPredicate = verifyPredicate;
    this.normalizeAddress =
      normalizeAddress ??
      ((address) => {
        if (typeof address !== "string") {
          throw validationError("Invalid wallet address.");
        }

        const normalized = address.trim().toLowerCase();

        if (!/^fake_[a-z0-9]+$/.test(normalized)) {
          throw validationError("Invalid wallet address.");
        }

        return normalized;
      });
  }

  async verifySignature(input) {
    this.calls.push(input);
    return this.verifyPredicate(input);
  }
}
