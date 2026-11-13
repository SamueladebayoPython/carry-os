use crate::storage::storage_cost;
use crate::types::CustodyKey;
use crate::Contract;
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::{env, log, near, require, AccountId, NearToken};

#[near]
impl Contract {
    /// Assign a new beneficiary for a deposited NFT.
    ///
    /// Only the currently stored beneficiary may call this method. Because every
    /// later action reads the stored beneficiary, the previous beneficiary loses
    /// authorization as soon as this write is committed.
    pub fn set_beneficiary(
        &mut self,
        collection: AccountId,
        token_id: TokenId,
        new_beneficiary: AccountId,
    ) {
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
            "Only the current beneficiary can change the beneficiary"
        );
        require!(
            !record.withdrawal_pending,
            "Cannot change beneficiary while a withdrawal is pending"
        );
        require!(
            new_beneficiary != env::current_account_id(),
            "The vault cannot be the beneficiary"
        );
        require!(
            new_beneficiary != record.beneficiary,
            "New beneficiary must differ from the current beneficiary"
        );

        let previous_beneficiary = record.beneficiary.clone();
        let old_charged = record.storage_charged;
        record.beneficiary = new_beneficiary.clone();

        // Account IDs have variable length, so reassignment can grow or shrink
        // the record. Keep the depositor's prepaid storage in sync instead of
        // making the vault pay for a larger beneficiary.
        let before = env::storage_usage();
        self.custody.insert(&key, &record);
        let after = env::storage_usage();

        if after > before {
            let extra = storage_cost(after - before);
            self.debit_storage(&record.depositor, extra);
            record.storage_charged = NearToken::from_yoctonear(
                old_charged
                    .as_yoctonear()
                    .checked_add(extra.as_yoctonear())
                    .unwrap_or_else(|| env::panic_str("Storage charge overflow")),
            );
            // `storage_charged` is fixed-size, so this does not change usage.
            self.custody.insert(&key, &record);
        } else if before > after {
            let refund = storage_cost(before - after);
            record.storage_charged = NearToken::from_yoctonear(
                old_charged
                    .as_yoctonear()
                    .saturating_sub(refund.as_yoctonear()),
            );
            self.custody.insert(&key, &record);
            self.credit_storage(&record.depositor, refund);
        }

        log!(
            "Beneficiary for {}#{} changed from {} to {}",
            collection,
            token_id,
            previous_beneficiary,
            new_beneficiary
        );
    }
}
