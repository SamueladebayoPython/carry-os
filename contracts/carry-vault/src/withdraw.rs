use crate::types::CustodyKey;
use crate::Contract;
use near_contract_standards::non_fungible_token::core::ext_nft_core;
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_sdk::{env, log, near, require, AccountId, Gas, NearToken, Promise};

/// Gas reserved for the collection's `nft_transfer` call.
pub(crate) const WITHDRAW_TRANSFER_GAS: Gas = Gas::from_tgas(30);

/// Gas reserved for the private resolution callback. This is intentionally
/// larger than the strict minimum so the bounded result read and storage
/// refund cannot be starved.
pub(crate) const WITHDRAW_CALLBACK_GAS: Gas = Gas::from_tgas(20);

/// Gas reserved for the collection's `nft_token` ownership check.
pub(crate) const RECOVERY_VERIFY_GAS: Gas = Gas::from_tgas(15);

/// Gas reserved for the recovery verification callback.
pub(crate) const RECOVERY_CALLBACK_GAS: Gas = Gas::from_tgas(20);

/// Wait before recovery may query the collection. Cross-contract receipt chains
/// settle quickly; this prevents a recovery query from racing the original
/// transfer while the NFT is still in flight.
pub(crate) const RECOVERY_DELAY_BLOCKS: u64 = 10;

/// `nft_transfer` returns no meaningful value. Bound the read to protect the
/// callback from a collection that returns an unexpectedly large payload.
pub(crate) const MAX_WITHDRAW_RESULT_LEN: usize = 1_024;

/// `nft_token` returns a standard token object. Bound the read to protect the
/// recovery callback from a malicious or buggy collection.
pub(crate) const MAX_NFT_TOKEN_RESULT_LEN: usize = 8_192;

#[near]
impl Contract {
    /// Withdraw a deposited NFT to the current beneficiary.
    ///
    /// The caller must attach exactly 1 yoctoNEAR, which is forwarded to the
    /// collection's `nft_transfer` as required by NEP-171.
    ///
    /// The record is marked pending before the transfer starts. That flag blocks
    /// a second withdrawal and keeps the record alive while the asynchronous
    /// transfer is in flight. `on_withdraw_complete` deletes the record only when
    /// the collection reports success. If the callback never runs, the
    /// beneficiary can use `recover_withdrawal` after a short delay.
    ///
    /// Callers should attach at least ~100 Tgas so both the transfer and the
    /// callback can complete.
    #[payable]
    pub fn withdraw(&mut self, collection: AccountId, token_id: TokenId) -> Promise {
        require!(
            env::attached_deposit() == NearToken::from_yoctonear(1),
            "Exactly 1 yoctoNEAR is required"
        );

        let key = CustodyKey {
            collection: collection.clone(),
            token_id: token_id.clone(),
        };
        let mut record = match self.custody.get(&key) {
            Some(record) => record,
            None => env::panic_str("No custody record found for this NFT"),
        };

        let caller = env::predecessor_account_id();
        require!(
            caller == record.beneficiary,
            "Only the current beneficiary can withdraw"
        );
        require!(
            !record.withdrawal_pending,
            "A withdrawal is already pending for this NFT"
        );

        // Write the pending flag before creating any promise. Storage writes are
        // committed before the function returns, so a concurrent call in another
        // receipt observes the flag.
        record.withdrawal_pending = true;
        record.withdrawal_started_at_block = env::block_height();
        self.custody.insert(&key, &record);

        let beneficiary = record.beneficiary.clone();

        ext_nft_core::ext(collection.clone())
            // Forward exactly the 1 yoctoNEAR supplied by the beneficiary.
            .with_attached_deposit(env::attached_deposit())
            .with_static_gas(WITHDRAW_TRANSFER_GAS)
            .nft_transfer(beneficiary, token_id.clone(), None, None)
            .then(
                Self::ext_self()
                    .with_static_gas(WITHDRAW_CALLBACK_GAS)
                    .on_withdraw_complete(collection, token_id),
            )
    }

    /// Resolve a withdrawal after the collection's `nft_transfer` settles.
    ///
    /// The `#[private]` annotation restricts the exported method to self-calls.
    /// The explicit check below keeps the same invariant at the Rust level, where
    /// it is also testable.
    #[private]
    pub fn on_withdraw_complete(&mut self, collection: AccountId, token_id: TokenId) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only the vault can resolve withdrawals"
        );

        let key = CustodyKey {
            collection: collection.clone(),
            token_id: token_id.clone(),
        };
        let mut record = match self.custody.get(&key) {
            Some(record) => record,
            None => {
                log!(
                    "Withdrawal callback ignored: no custody record for {}#{}",
                    collection,
                    token_id
                );
                return;
            }
        };

        if !record.withdrawal_pending {
            log!(
                "Withdrawal callback ignored: withdrawal is not pending for {}#{}",
                collection,
                token_id
            );
            return;
        }

        if env::promise_results_count() != 1 {
            log!(
                "Withdrawal callback ignored: unexpected promise result count for {}#{}",
                collection,
                token_id
            );
            return;
        }

        // `promise_result` is deprecated because an unbounded read can run out
        // of gas. `nft_transfer` has no return value, so any bounded successful
        // result confirms the transfer; an oversized or failed result does not.
        let succeeded = match env::promise_result_checked(0, MAX_WITHDRAW_RESULT_LEN) {
            Ok(_) => true,
            Err(err) => {
                log!(
                    "Withdrawal result rejected for {}#{}: {}",
                    collection,
                    token_id,
                    err
                );
                false
            }
        };

        if succeeded {
            // The collection confirms the transfer, so the vault no longer owns
            // the token. Delete the record and return its prepaid storage.
            self.custody.remove(&key);
            self.refund_record_storage(&record);
            log!("Withdrawal confirmed for {}#{}", collection, token_id);
        } else {
            // The transfer failed, or its result could not be read safely. Keep
            // the record and clear the pending flag so the beneficiary can retry.
            record.withdrawal_pending = false;
            record.withdrawal_started_at_block = 0;
            self.custody.insert(&key, &record);
            log!(
                "Withdrawal failed for {}#{}; custody record retained",
                collection,
                token_id
            );
        }
    }

    /// Recover a record stuck in `withdrawal_pending`.
    ///
    /// This never trusts a timeout alone. After a short safety delay it asks the
    /// collection who currently owns the token, and only the private callback
    /// decides whether to clear the pending flag or remove the record. Only the
    /// current beneficiary may initiate recovery; no administrator can discard
    /// records or move assets.
    pub fn recover_withdrawal(&mut self, collection: AccountId, token_id: TokenId) -> Promise {
        let key = CustodyKey {
            collection: collection.clone(),
            token_id: token_id.clone(),
        };
        let record = match self.custody.get(&key) {
            Some(record) => record,
            None => env::panic_str("No custody record found for this NFT"),
        };

        require!(
            env::predecessor_account_id() == record.beneficiary,
            "Only the current beneficiary can recover a withdrawal"
        );
        require!(
            record.withdrawal_pending,
            "No withdrawal is pending for this NFT"
        );
        require!(
            env::block_height()
                >= record
                    .withdrawal_started_at_block
                    .saturating_add(RECOVERY_DELAY_BLOCKS),
            "Withdrawal recovery delay has not elapsed"
        );

        // `nft_token` is a view call. Its result is interpreted by the private
        // callback, not here.
        ext_nft_core::ext(collection.clone())
            .with_static_gas(RECOVERY_VERIFY_GAS)
            .nft_token(token_id.clone())
            .then(
                Self::ext_self()
                    .with_static_gas(RECOVERY_CALLBACK_GAS)
                    .on_recovery_verified(collection, token_id),
            )
    }

    /// Interpret the collection's ownership response for a pending withdrawal.
    ///
    /// * Owner is the vault: the transfer never completed. Clear the pending
    ///   flag and keep the record.
    /// * Owner is anyone else: the token left the vault (for example, a
    ///   successful transfer whose callback was starved). Remove the stale
    ///   record and refund its storage.
    /// * Token missing, malformed, or result unreadable: keep the record pending
    ///   rather than guessing and potentially orphaning a vault-owned NFT.
    #[private]
    pub fn on_recovery_verified(&mut self, collection: AccountId, token_id: TokenId) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only the vault can verify withdrawals"
        );

        let key = CustodyKey {
            collection: collection.clone(),
            token_id: token_id.clone(),
        };
        let record = match self.custody.get(&key) {
            Some(record) => record,
            None => {
                log!(
                    "Recovery callback ignored: no custody record for {}#{}",
                    collection,
                    token_id
                );
                return;
            }
        };

        if !record.withdrawal_pending {
            log!(
                "Recovery callback ignored: withdrawal is not pending for {}#{}",
                collection,
                token_id
            );
            return;
        }

        if env::promise_results_count() != 1 {
            log!(
                "Recovery callback ignored: unexpected promise result count for {}#{}",
                collection,
                token_id
            );
            return;
        }

        let data = match env::promise_result_checked(0, MAX_NFT_TOKEN_RESULT_LEN) {
            Ok(data) => data,
            Err(err) => {
                log!(
                    "Recovery verification failed for {}#{}: {}; record retained",
                    collection,
                    token_id,
                    err
                );
                return;
            }
        };

        let token: Option<Token> = match near_sdk::serde_json::from_slice(&data) {
            Ok(token) => token,
            Err(_) => {
                log!(
                    "Recovery verification returned malformed data for {}#{}; record retained",
                    collection,
                    token_id
                );
                return;
            }
        };

        match token {
            Some(token) if token.owner_id == env::current_account_id() => {
                let mut updated = record;
                updated.withdrawal_pending = false;
                updated.withdrawal_started_at_block = 0;
                self.custody.insert(&key, &updated);
                log!(
                    "Recovery verified {}#{} is still vault-owned; pending flag cleared",
                    collection,
                    token_id
                );
            }
            Some(token) => {
                self.custody.remove(&key);
                self.refund_record_storage(&record);
                log!(
                    "Recovery verified {}#{} is owned by {}; custody record removed",
                    collection,
                    token_id,
                    token.owner_id
                );
            }
            None => {
                log!(
                    "Recovery could not establish ownership for {}#{}; record retained",
                    collection,
                    token_id
                );
            }
        }
    }
}
