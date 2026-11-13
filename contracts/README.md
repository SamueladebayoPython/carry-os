# NEAR testnet MVP contracts

This workspace contains the first NEAR-only custody demo slice:

- `carry-vault`: receives NEP-171 NFTs from owner-approved collections, records
  the original depositor and beneficiary, allows the original depositor to
  reassign the beneficiary, and allows only the current beneficiary to withdraw.
- `demo-nft`: a small NEP-171 collection for minting test NFTs.

The deposit callback rejects collections outside the owner-controlled allowlist.
Only the NFT owner may call the vault through `nft_transfer_call`; approved
operators are rejected so they cannot choose an initial beneficiary for someone
else's NFT. The owner must pre-fund vault storage with `storage_deposit` before
depositing.
The beneficiary defaults to the original owner, or can be specified in the
NEP-171 `nft_transfer_call` message as `{"beneficiary_id":"alice.testnet"}`.

Beneficiary reassignment is signed directly by the original depositor in this
MVP. NEAR Auth login does not authorize on-chain actions, and there is no
backend relayer or delegated authorization yet. The previous beneficiary loses
withdrawal rights as soon as reassignment succeeds. A withdrawal callback
checks `nft_token` ownership before it removes custody or clears a pending
attempt. If ownership cannot be read or does not match the expected vault or
beneficiary, it leaves the custody record pending.

If a callback is missing or fails, the contract exposes permissionless
`recover_withdrawal(collection_id, token_id)` for records with a pending attempt.
Call it with exactly 1 yoctoNEAR. It advances the attempt ID and queries
`nft_token` from the collection. If the NFT is already owned by the recorded
beneficiary, it removes the custody record and refunds storage. If the vault
still owns the NFT, it retries the transfer only to that recorded beneficiary,
then queries ownership again before changing custody. It never clears pending
state merely because time passed or because an earlier promise reported
failure. If ownership cannot be established, or the NFT is owned by a third
party, custody remains pending for investigation. This depends on the
allowlisted collection implementing the NEP-171 `nft_token` and `nft_transfer`
methods correctly.

## Build and test

Use Rust 1.86 or newer and the pinned NEAR SDK crates in the workspace:

```powershell
cargo test --workspace --locked
cargo near build non-reproducible-wasm
```

Run the build command from each contract directory to build both Wasm files.
Wasm targets and a working `cargo-near` installation are required. Build
artifacts are written under each crate's `target` directory.

## Testnet preparation and deployment

The commands below are prepared but have **not** been run. They deploy code and
make irreversible testnet transactions, so run them only after explicit
deployment approval. Install Rust 1.86+, the `wasm32-unknown-unknown` target,
`cargo-near`, and [near-cli-rs](https://github.com/near/near-cli-rs). Sign with
accounts already configured in the NEAR CLI keychain; never put private keys in
this repository or `.env` files.

Required accounts: a funded owner account that controls the vault and
collection accounts, a separate NFT depositor account, and a separate new
beneficiary account. The CLI signer must have permission to deploy to both
contract accounts. Example environment values (replace all examples):

```powershell
$env:OWNER_ACCOUNT_ID = "carry-owner.testnet"
$env:VAULT_ACCOUNT_ID = "carry-vault.carry-owner.testnet"
$env:COLLECTION_ACCOUNT_ID = "carry-demo-nft.carry-owner.testnet"
$env:DEPOSITOR_ACCOUNT_ID = "depositor.testnet"
$env:BENEFICIARY_ACCOUNT_ID = "beneficiary.testnet"
```

Build both optimized Wasm artifacts:

```powershell
./contracts/build-testnet.ps1
$nftWasm = (Get-ChildItem contracts/demo-nft/target/near -Filter "*.wasm" | Select-Object -First 1).FullName
$vaultWasm = (Get-ChildItem contracts/carry-vault/target/near -Filter "*.wasm" | Select-Object -First 1).FullName
```

Review the selected artifact paths before deploying. Deploy and initialize the
collection and vault (these `near-cli-rs` commands prompt for wallet/keychain
authorization):

```powershell
near contract deploy $env:COLLECTION_ACCOUNT_ID use-file $nftWasm with-init-call new json-args "{`"owner_id`":`"$env:OWNER_ACCOUNT_ID`",`"name`":`"Carry Demo Collection`",`"symbol`":`"CARRY`"}" prepaid-gas "100 TGas" attached-deposit "0 NEAR" network-config testnet sign-with-keychain send
near contract deploy $env:VAULT_ACCOUNT_ID use-file $vaultWasm with-init-call new json-args "{`"owner_id`":`"$env:OWNER_ACCOUNT_ID`"}" prepaid-gas "100 TGas" attached-deposit "0 NEAR" network-config testnet sign-with-keychain send
```

Prepare vault storage, allowlist the collection, and fund the depositor's
storage. The storage balances pay for custody state growth and refunds:

```powershell
near contract call-function as-transaction $env:VAULT_ACCOUNT_ID storage_deposit json-args "{}" prepaid-gas "30 TGas" attached-deposit "1 NEAR" sign-as $env:OWNER_ACCOUNT_ID network-config testnet sign-with-keychain send
near contract call-function as-transaction $env:VAULT_ACCOUNT_ID add_approved_collection json-args "{`"collection_id`":`"$env:COLLECTION_ACCOUNT_ID`"}" prepaid-gas "30 TGas" attached-deposit "0 NEAR" sign-as $env:OWNER_ACCOUNT_ID network-config testnet sign-with-keychain send
near contract call-function as-transaction $env:VAULT_ACCOUNT_ID storage_deposit json-args "{}" prepaid-gas "30 TGas" attached-deposit "1 NEAR" sign-as $env:DEPOSITOR_ACCOUNT_ID network-config testnet sign-with-keychain send
```

Mint a demo NFT owned by the depositor. The collection owner signs and the
attached amount covers its storage (unused amount is refunded by the contract):

```powershell
near contract call-function as-transaction $env:COLLECTION_ACCOUNT_ID nft_mint json-args "{`"token_id`":`"carry-demo-1`",`"token_owner_id`":`"$env:DEPOSITOR_ACCOUNT_ID`",`"token_metadata`":{`"title`":`"Carry Demo NFT 1`",`"description`":`"NEAR testnet custody demo`",`"media`":null}}" prepaid-gas "100 TGas" attached-deposit "0.1 NEAR" sign-as $env:OWNER_ACCOUNT_ID network-config testnet sign-with-keychain send
```

After reassignment, an explicit old-beneficiary rejection can be checked with
the transaction below. A nonzero CLI result is expected; do not accept a
successful result. Replace the token ID and old account with the values used in
the demo:

```powershell
$env:OLD_BENEFICIARY_ACCOUNT_ID = "old-beneficiary.testnet"
near contract call-function as-transaction $env:VAULT_ACCOUNT_ID withdraw json-args "{`"collection_id`":`"$env:COLLECTION_ACCOUNT_ID`",`"token_id`":`"carry-demo-1`"}" prepaid-gas "50 TGas" attached-deposit "1 yoctoNEAR" sign-as $env:OLD_BENEFICIARY_ACCOUNT_ID network-config testnet sign-with-keychain send
```

If a withdrawal remains pending because a callback did not complete, any
testnet account may submit this recovery call. It only transfers to the
beneficiary already recorded in custody. The 1 yoctoNEAR deposit is forwarded
for a retry transfer when the NFT is still vault-owned; a retry should use at
least 150 TGas for the chained ownership checks:

```powershell
near contract call-function as-transaction $env:VAULT_ACCOUNT_ID recover_withdrawal json-args "{`"collection_id`":`"$env:COLLECTION_ACCOUNT_ID`",`"token_id`":`"carry-demo-1`"}" prepaid-gas "150 TGas" attached-deposit "1 yoctoNEAR" sign-as $env:DEPOSITOR_ACCOUNT_ID network-config testnet sign-with-keychain send
```

Set the same deployed IDs in the API environment (`NEAR_VAULT_ACCOUNT_ID`,
`NEAR_DEMO_NFT_ACCOUNT_ID`) and web environment (`NEXT_PUBLIC_NEAR_VAULT_ID`,
`NEXT_PUBLIC_NEAR_DEMO_NFT_ID`). The frontend API URL must point to the running
API. Use two browser wallet accounts for the beneficiary handoff. The depositor
must reconnect and sign reassignment after disconnecting; the original
depositor's signature is required by contract authorization. Then connect the
old beneficiary to test the direct withdrawal rejection, and the new beneficiary
to withdraw. Verify each receipt and final `get_custody` / `nft_token` state on
testnet before calling the demonstration complete.

No deployment accounts, credentials, RPC transaction evidence, or live
demonstration are included in this repository. These contracts are a testnet
demonstration starting point and have not been audited. The documented
`near-cli-rs` command form follows its official [CLI guide](https://github.com/near/near-cli-rs/blob/main/docs/GUIDE.en.md).
