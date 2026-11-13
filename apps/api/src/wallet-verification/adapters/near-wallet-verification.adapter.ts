import {
  KeyType,
  PublicKey,
  type Provider,
} from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import {
  AccessKeyDoesNotExistError,
  AccountDoesNotExistError,
} from "near-api-js/rpc-errors";

import { validationError } from "../../common/errors/app-error.js";
import {
  WALLET_CHALLENGE_MESSAGE_VERSION,
  WALLET_OWNERSHIP_VERIFICATION_PURPOSE,
} from "../wallet-verification.constants.js";
import type {
  WalletSignatureVerificationInput,
  WalletVerificationAdapter,
} from "./wallet-verification-adapter.js";

/**
 * Minimal provider boundary required by the adapter.
 *
 * A `near-api-js` `JsonRpcProvider` satisfies this shape. Keeping the boundary
 * narrow lets tests supply a deterministic in-memory provider.
 */
export interface NearAccessKeyProvider {
  viewAccessKey(params: {
    readonly accountId: string;
    readonly publicKey: PublicKey | string;
  }): Promise<NearAccessKeyView>;
}

export interface NearAccessKeyView {
  readonly permission: unknown;
}

export interface NearWalletVerificationAdapterOptions {
  /** Configured NEAR RPC provider. Never supplied by a wallet. */
  readonly provider: NearAccessKeyProvider;
  /**
   * Server-controlled NEP-413 recipient. It must be the trusted application
   * domain, not a value taken from the verification request.
   */
  readonly trustedDomain: string;
}

const NEAR_ACCOUNT_ID_PATTERN =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const IMPLICIT_ACCOUNT_ID_PATTERN = /^[0-9a-f]{64}$/;
const NEP413_NONCE_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
const FULL_ACCESS_PERMISSION = "FullAccess";

/**
 * NEAR wallet ownership verification using the official NEP-413 flow.
 *
 * The signed challenge must use the exact message stored at issuance, the
 * server-configured recipient, and the original 32-byte nonce. The supplied
 * public key must be an Ed25519 full-access key on the stored challenge
 * account. Signature-only verification is never accepted as a fallback.
 */
export class NearWalletVerificationAdapter
  implements WalletVerificationAdapter
{
  readonly network = "near" as const;

  private readonly provider: NearAccessKeyProvider;
  private readonly recipient: string;

  constructor(options: NearWalletVerificationAdapterOptions) {
    if (
      options === undefined ||
      options.provider === undefined ||
      typeof options.provider.viewAccessKey !== "function"
    ) {
      throw new Error("A NEAR access-key provider is required.");
    }

    if (typeof options.trustedDomain !== "string") {
      throw new Error("A NEAR NEP-413 recipient is required.");
    }

    const recipient = options.trustedDomain.trim();

    if (recipient.length === 0) {
      throw new Error("A NEAR NEP-413 recipient is required.");
    }

    this.provider = options.provider;
    this.recipient = recipient;
  }

  normalizeAddress(address: string): string {
    const normalized = parseAccountId(address);

    if (normalized === null) {
      throw validationError("Invalid NEAR account ID.");
    }

    return normalized;
  }

  async verifySignature(
    input: WalletSignatureVerificationInput,
  ): Promise<boolean> {
    // The stored challenge address is authoritative. Any client-supplied
    // account ID is never read from the verification request.
    const accountId = parseAccountId(input.address);

    if (accountId === null) {
      return false;
    }

    // Defense in depth: the service owns these values, but the adapter must
    // reject any message that is not bound to the stored verification input.
    if (!challengeMessageMatches(input, accountId)) {
      return false;
    }

    const publicKey = parseEd25519PublicKey(input.publicKey);

    if (publicKey === null) {
      return false;
    }

    if (
      IMPLICIT_ACCOUNT_ID_PATTERN.test(accountId) &&
      Buffer.from(publicKey.data).toString("hex") !== accountId
    ) {
      return false;
    }

    const nonce = decodeNonce(input.nonce);

    if (nonce === null) {
      return false;
    }

    const signature = decodeSignature(input.signature);

    if (signature === null) {
      return false;
    }

    // Fetch the key once, then serve the same access key to `verifyMessage`
    // so that the official verifier does not perform a second RPC call.
    let accessKey: NearAccessKeyView;

    try {
      accessKey = await this.provider.viewAccessKey({
        accountId,
        publicKey,
      });
    } catch (error: unknown) {
      if (
        error instanceof AccessKeyDoesNotExistError ||
        error instanceof AccountDoesNotExistError
      ) {
        return false;
      }

      // RPC and provider failures fail closed by propagating. The caller must
      // not downgrade to signature-only verification.
      throw error;
    }

    if (
      accessKey === null ||
      typeof accessKey !== "object" ||
      accessKey.permission !== FULL_ACCESS_PERMISSION
    ) {
      return false;
    }

    const cachedProvider = {
      viewAccessKey: async () => accessKey,
    } as unknown as Provider;

    try {
      await verifyMessage({
        signerAccountId: accountId,
        signerPublicKey: publicKey,
        payload: {
          message: input.message,
          recipient: this.recipient,
          nonce,
        },
        signature,
        provider: cachedProvider,
      });
    } catch {
      // The official verifier throws for signature mismatches. Treat any
      // verification failure as an invalid signature.
      return false;
    }

    return true;
  }
}

function challengeMessageMatches(
  input: WalletSignatureVerificationInput,
  accountId: string,
): boolean {
  let payload: unknown;

  try {
    payload = JSON.parse(input.message);
  } catch {
    return false;
  }

  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return false;
  }

  const message = payload as Record<string, unknown>;

  return (
    message.version === WALLET_CHALLENGE_MESSAGE_VERSION &&
    message.purpose === WALLET_OWNERSHIP_VERIFICATION_PURPOSE &&
    message.address === accountId &&
    message.nonce === input.nonce
  );
}

function parseAccountId(address: unknown): string | null {
  if (typeof address !== "string") {
    return null;
  }

  const normalized = address.trim();

  if (
    normalized.length < 2 ||
    normalized.length > 64 ||
    !NEAR_ACCOUNT_ID_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function parseEd25519PublicKey(value: unknown): PublicKey | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  let publicKey: PublicKey;

  try {
    publicKey = PublicKey.fromString(value);
  } catch {
    return null;
  }

  if (
    publicKey.keyType !== KeyType.ED25519 ||
    publicKey.data.length !== 32
  ) {
    return null;
  }

  return publicKey;
}

/**
 * The challenge nonce is stored as canonical unpadded base64url and must
 * decode to exactly 32 bytes.
 */
function decodeNonce(nonce: unknown): Uint8Array | null {
  if (typeof nonce !== "string") {
    return null;
  }

  const compact = nonce.replace(/=+$/, "");

  if (compact.length === 0 || !/^[A-Za-z0-9_-]+$/.test(compact)) {
    return null;
  }

  const decoded = Buffer.from(compact, "base64url");

  if (
    decoded.length !== NEP413_NONCE_BYTES ||
    decoded.toString("base64url") !== compact
  ) {
    return null;
  }

  return new Uint8Array(decoded);
}

/**
 * NEP-413 returns the signature as base64. Base64url is accepted as a
 * transport-equivalent form, but the encoding must be canonical and decode to
 * exactly 64 bytes.
 */
function decodeSignature(signature: unknown): Uint8Array | null {
  if (typeof signature !== "string") {
    return null;
  }

  const compact = signature.replace(/=+$/, "");

  if (compact.length === 0 || !/^[A-Za-z0-9+/_-]+$/.test(compact)) {
    return null;
  }

  const usesUrlSafe = /[-_]/.test(compact);
  const usesStandard = /[+/]/.test(compact);

  if (usesUrlSafe && usesStandard) {
    return null;
  }

  const encoding = usesUrlSafe ? "base64url" : "base64";
  const decoded = Buffer.from(compact, encoding);

  if (
    decoded.length !== ED25519_SIGNATURE_BYTES ||
    decoded.toString(encoding).replace(/=+$/, "") !== compact
  ) {
    return null;
  }

  return new Uint8Array(decoded);
}
