# NEAR testnet MVP contracts

This workspace contains the first NEAR-only custody demo slice:

- `carry-vault`: receives NEP-171 NFTs from owner-approved collections, records
  the original depositor and beneficiary, allows the original depositor to
  reassign the beneficiary, and allows only the current beneficiary to withdraw.
- `demo-nft`: a small NEP-171 collection for minting test NFTs.

The deposit callback rejects collections outside the owner-controlled allowlist.
Wallets must pre-fund vault storage with `storage_deposit` before depositing.
The beneficiary defaults to the original owner, or can be specified in the
NEP-171 `nft_transfer_call` message as `{"beneficiary_id":"alice.testnet"}`.

Beneficiary reassignment is signed directly by the original depositor in this
MVP. NEAR Auth login does not authorize on-chain actions, and there is no
backend relayer or delegated authorization yet. The previous beneficiary loses
withdrawal rights as soon as reassignment succeeds. A failed NFT transfer keeps
the custody record and clears only the matching pending withdrawal attempt; the
contract has no timeout-based recovery.

## Build and test

Use Rust 1.86 or newer and the pinned NEAR SDK crates in the workspace:

```powershell
cargo test --workspace --locked
cargo near build non-reproducible-wasm
```

Run the build command from each contract directory to build both Wasm files.
Wasm targets and a working `cargo-near` installation are required. Build
artifacts are written under each crate's `target` directory.

## Testnet sequence

1. Create and fund separate testnet accounts for the vault and collection.
2. Deploy and initialize `carry-demo-nft` with collection owner, name, and
   symbol.
3. Deploy and initialize `carry-vault` with its owner account.
4. Register the vault owner and NFT depositor with `storage_deposit`.
5. Add the demo collection account to the vault allowlist.
6. Mint an NFT to the depositor, paying the collection storage deposit.
7. Deposit with `nft_transfer_call` and verify `get_custody`.
8. Reassign to a second testnet account using the original depositor.
9. Confirm the old beneficiary cannot withdraw; withdraw as the new beneficiary.
10. Verify `nft_token`, `get_custody`, and transaction outcomes on testnet.

No deployment accounts, credentials, RPC transaction evidence, or frontend
contract calls are included in this repository. These contracts are a testnet
demonstration starting point and have not been audited.
