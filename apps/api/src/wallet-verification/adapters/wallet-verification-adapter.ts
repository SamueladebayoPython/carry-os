import type { NetworkId } from "@carry-os/shared";

export interface WalletSignatureVerificationInput {
  readonly address: string;
  readonly message: string;
  readonly signature: string;
  /**
   * Nonce encoded exactly as stored on the challenge. Chain adapters that use
   * a structured signing standard decode it themselves.
   */
  readonly nonce: string;
  /**
   * Public key returned by the wallet. Chains that require proof that the key
   * belongs to the challenged account use this; the stored challenge address
   * always remains authoritative.
   */
  readonly publicKey: string;
}

/**
 * Chain-specific verification boundary.
 *
 * Implementations must normalize addresses and verify cryptographic control of
 * the stored address. They must fail closed for malformed input.
 */
export interface WalletVerificationAdapter {
  readonly network: NetworkId;
  normalizeAddress(address: string): string;
  verifySignature(
    input: WalletSignatureVerificationInput,
  ): Promise<boolean>;
}
