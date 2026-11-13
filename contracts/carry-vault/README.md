# carry-vault

A focused NEAR custody vault for [NEP-171](https://nomicon.io/Standards/NonFungibleToken/Core)
NFTs.

The vault accepts an NFT through `nft_transfer_call`, records who deposited it
and who may currently control it, and lets that beneficiary either hand control
to another account or withdraw the NFT. It deliberately does **not** implement
marketplace, sale, multichain, API, or database features.

## Custody model

Every deposited token is identified by a composite key:

```rust
struct CustodyKey {
    collection: AccountId, // NFT contract that called nft_on_transfer
    token_id: String,      // NEP-171 token ID
}

struct CustodyRecord {
    depositor: AccountId,      // owner immediately before the deposit
    beneficiary: AccountId,    // account allowed to reassign / withdraw
    deposited_at_block: u64,
    withdrawal_pending: bool,  // true while nft_transfer is in flight
}
```

Records live in a `LookupMap<CustodyKey, CustodyRecord>` under a dedicated
storage prefix (`StorageKey::Custody`). The key includes the collection, so two
collections that happen to use the same token ID never collide.

`depositor` and `beneficiary` are separate on purpose. A deposit can be made by
an approved operator through `nft_transfer_call`; in that case `sender_id` is
the operator, while `previous_owner_id` is the real owner. The vault records
`previous_owner_id` as the depositor and defaults the beneficiary to it.

## Methods

### `new() -> Contract` (`#[init]`, payable)

Creates the empty vault. The attached deposit becomes the vault balance used to
pay for storage growth and for the `1 yoctoNEAR` required by `nft_transfer`
during withdrawals.

### `nft_on_transfer(sender_id, previous_owner_id, token_id, msg) -> PromiseOrValue<bool>`

NEP-171 receiver, called by the NFT collection after it has moved the token to
the vault. It implements
`near_contract_standards::non_fungible_token::core::NonFungibleTokenReceiver`.

- `collection` is taken from `env::predecessor_account_id()`, never from `msg`.
- `msg` is ignored; it is caller-controlled data and is not proof of anything.
- The record is created with `depositor = beneficiary = previous_owner_id`.
- Returns `false`: keep the NFT in the vault (deposit accepted).
- Returns `true`: return the NFT to `sender_id` (deposit refused).

The deposit is refused (returns `true`) when a record for the same
`(collection, token_id)` already exists. Empty or oversized token IDs and a
deposit whose `previous_owner_id` is the vault itself are rejected with a panic.

### `set_beneficiary(collection, token_id, new_beneficiary)`

Reassigns custody authority. Only the **currently stored** beneficiary may call
it, so the previous beneficiary loses authorization as soon as the new record is
committed. Reassignment is blocked while a withdrawal is pending.

### `withdraw(collection, token_id) -> Promise`

Withdraws the NFT to the current beneficiary. The flow is:

1. Load the record and require `predecessor == record.beneficiary`.
2. Require that no withdrawal is already pending.
3. Set `withdrawal_pending = true` and persist the record.
4. Call `nft_transfer` on the collection with `1 yoctoNEAR` attached.
5. Chain the private `on_withdraw_complete` callback.

The record is **not** deleted before the transfer settles. The `pending` flag
blocks a concurrent withdrawal and keeps the record authoritative while the
asynchronous call is in flight. Callers should attach roughly 60 Tgas or more so
both the transfer (30 Tgas) and the callback (15 Tgas) can complete.

### `on_withdraw_complete(collection, token_id)` (`#[private]`)

Resolution callback for a withdrawal.

- `#[private]` restricts the exported method to self-calls.
- An explicit `predecessor == current_account_id` check repeats the invariant in
  Rust so it is covered by unit tests.
- `PromiseResult::Successful` means the collection confirmed the transfer, so the
  custody record is deleted.
- `PromiseResult::Failed` keeps the record, clears `withdrawal_pending`, and lets
  the beneficiary retry.

If the callback cannot run (for example, it is starved of gas), the record stays
pending. Fund withdrawals with enough gas.

### `get_custody(collection, token_id) -> Option<CustodyRecord>`

View method. A missing record means the vault does not claim custody of that
token.

## Deposit example

Deposits must use `nft_transfer_call` so the vault receives `nft_on_transfer`.
The `msg` argument is unused and can be an empty string.

```bash
near call <nft-contract> nft_transfer_call \
  '{"receiver_id":"<vault>","token_id":"42","msg":""}' \
  --accountId <owner> --depositYocto 1 --gas 100000000000000
```

The collection then calls:

```text
<vault>.nft_on_transfer(sender_id, previous_owner_id, "42", "")
```

## Security properties

- **Collection identity is not attacker supplied.** `nft_on_transfer` trusts
  `predecessor_account_id`, so a caller can only create records keyed by its own
  account, never by another collection's account.
- **Custody follows ownership.** A record is created only inside
  `nft_on_transfer`, which NEP-171 invokes after the collection has transferred
  the token to the vault. If the receiver panics, the collection's resolver
  returns the token to its previous owner.
- **Original owner, not operator.** `previous_owner_id` is recorded, so approval
  operators cannot become the beneficiary of someone else's token.
- **Authority is always re-read from storage.** `set_beneficiary` and `withdraw`
  compare the caller against the stored beneficiary, so reassignment revokes the
  old beneficiary immediately.
- **No duplicate records.** An existing `(collection, token_id)` key is never
  overwritten; the deposit is returned instead.
- **No premature deletion.** Withdrawal state is removed only after the
  collection's transfer reports success.
- **No concurrent withdrawals.** `withdrawal_pending` is written before the
  cross-contract call.
- **Account IDs are typed.** Public methods accept `AccountId`, so malformed
  account IDs are rejected during argument deserialization.
- **Initialization is guarded.** The state uses `PanicOnDefault` and `new` is
  `#[init]`, so an uninitialized contract cannot be used as if it were empty.
- **Bounded token IDs.** Token IDs are capped at 1 KiB to limit storage abuse.

## Trust assumptions and limitations

- There is no collection allowlist. Any contract can call `nft_on_transfer` and
  create records under **its own** account ID, which costs the vault storage but
  cannot affect records of real collections or move real NFTs. A production
  deployment that needs spam resistance should add an owner-managed allowlist of
  trusted collections.
- The vault pays storage costs for new records. Keep it funded; there is no
  per-deposit storage refund in this focused version.
- Failed withdrawals can be retried, but a callback that never executes leaves
  the record pending.
- There is no admin, upgrade, pause, or fee logic.
- The vault does not interpret NFT metadata and does not inspect approvals after
  a transfer; the collection owns that behavior.

## Layout

```text
src/lib.rs          contract state, initialization, get_custody
src/types.rs        CustodyRecord, CustodyKey, storage prefixes
src/deposit.rs      NEP-171 receiver and deposit validation
src/beneficiary.rs  beneficiary reassignment
src/withdraw.rs     asynchronous withdrawal and private callback
src/tests.rs        unit tests for deposits, authorization, withdrawals
```

## Build and test

```bash
cd contracts/carry-vault
cargo test
cargo build --target wasm32-unknown-unknown --release
```

`near-sdk` and `near-contract-standards` are pinned to `5.30.1`. The mocked
blockchain used by the unit tests comes from the `unit-testing` feature, which
is declared as a dev-dependency so it is not compiled into the wasm artifact.
