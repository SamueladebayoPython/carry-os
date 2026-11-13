use crate::types::{CustodyKey, CustodyRecord};
use crate::Contract;
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds};
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

/// Convert a storage byte count into the corresponding NEAR amount using the
/// protocol's current storage price.
pub(crate) fn storage_cost(bytes: u64) -> NearToken {
    let per_byte = env::storage_byte_cost().as_yoctonear();
    let total = per_byte
        .checked_mul(bytes as u128)
        .unwrap_or_else(|| env::panic_str("Storage cost overflow"));
    NearToken::from_yoctonear(total)
}

#[near]
impl Contract {
    /// Add to an account's prepaid storage balance.
    ///
    /// The first deposit for an account also pays for the balance-map entry
    /// itself; only the remainder becomes withdrawable. Subsequent deposits are
    /// credited in full.
    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>) -> StorageBalance {
        let target = account_id.unwrap_or_else(|| env::predecessor_account_id());
        let attached = env::attached_deposit();
        require!(
            attached.as_yoctonear() > 0,
            "Storage deposit must be greater than zero"
        );

        let available = match self.storage_balances.get(&target) {
            Some(balance) => {
                let updated = NearToken::from_yoctonear(
                    balance
                        .as_yoctonear()
                        .checked_add(attached.as_yoctonear())
                        .unwrap_or_else(|| env::panic_str("Storage balance overflow")),
                );
                self.storage_balances.insert(&target, &updated);
                updated
            }
            None => {
                // Measure the map entry so the depositor, not the vault, pays
                // for the new balance record.
                let before = env::storage_usage();
                self.storage_balances.insert(&target, &NearToken::ZERO);
                let after = env::storage_usage();
                let registration_cost = storage_cost(after.saturating_sub(before));
                require!(
                    attached.as_yoctonear() >= registration_cost.as_yoctonear(),
                    "Storage deposit does not cover the registration cost"
                );
                let available = NearToken::from_yoctonear(
                    attached.as_yoctonear() - registration_cost.as_yoctonear(),
                );
                self.storage_balances.insert(&target, &available);
                available
            }
        };

        StorageBalance {
            total: available,
            available,
        }
    }

    /// Withdraw free storage balance to the predecessor.
    ///
    /// Follows the NEP-145 convention of requiring exactly 1 yoctoNEAR. The
    /// request can never exceed the account's recorded free balance, so funds
    /// reserved for existing custody records cannot be withdrawn.
    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        require!(
            env::attached_deposit() == NearToken::from_yoctonear(1),
            "Exactly 1 yoctoNEAR is required"
        );

        let caller = env::predecessor_account_id();
        let balance = self
            .storage_balances
            .get(&caller)
            .unwrap_or_else(|| env::panic_str("Storage balance is not registered"));

        let requested = amount.unwrap_or(balance);
        require!(
            requested.as_yoctonear() <= balance.as_yoctonear(),
            "Storage withdrawal exceeds the recorded balance"
        );

        let remaining = NearToken::from_yoctonear(
            balance.as_yoctonear() - requested.as_yoctonear(),
        );
        self.storage_balances.insert(&caller, &remaining);

        if requested.as_yoctonear() > 0 {
            Promise::new(caller).transfer(requested);
        }

        StorageBalance {
            total: remaining,
            available: remaining,
        }
    }

    /// Return an account's prepaid storage balance, if registered.
    ///
    /// The entire tracked amount is available: storage for existing custody
    /// records was already deducted when those records were created.
    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.storage_balances
            .get(&account_id)
            .map(|available| StorageBalance {
                total: available,
                available,
            })
    }

    /// Minimum recommended storage deposit. The actual registration charge is
    /// measured from the account ID, so this is a lower bound rather than a
    /// protocol-enforced constant.
    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds {
            min: NearToken::from_millinear(1),
            max: None,
        }
    }

    pub(crate) fn require_storage_registered(&self, account_id: &AccountId) {
        require!(
            self.storage_balances.contains_key(account_id),
            "Storage balance is not registered for this account"
        );
    }

    pub(crate) fn debit_storage(&mut self, account_id: &AccountId, amount: NearToken) {
        let balance = self
            .storage_balances
            .get(account_id)
            .unwrap_or_else(|| env::panic_str("Storage balance is not registered"));
        require!(
            balance.as_yoctonear() >= amount.as_yoctonear(),
            "Insufficient storage balance for this operation"
        );
        let remaining =
            NearToken::from_yoctonear(balance.as_yoctonear() - amount.as_yoctonear());
        self.storage_balances.insert(account_id, &remaining);
    }

    pub(crate) fn credit_storage(&mut self, account_id: &AccountId, amount: NearToken) {
        let balance = self
            .storage_balances
            .get(account_id)
            .unwrap_or(NearToken::ZERO);
        let updated = NearToken::from_yoctonear(
            balance
                .as_yoctonear()
                .saturating_add(amount.as_yoctonear()),
        );
        self.storage_balances.insert(account_id, &updated);
    }

    /// Insert a brand new custody record and charge its measured storage cost
    /// to the depositor. If the depositor cannot pay, the panic rolls back the
    /// insert and the collection's resolver returns the NFT.
    pub(crate) fn insert_new_record(&mut self, key: &CustodyKey, record: &mut CustodyRecord) {
        self.require_storage_registered(&record.depositor);

        let before = env::storage_usage();
        self.custody.insert(key, record);
        let after = env::storage_usage();

        let cost = storage_cost(after.saturating_sub(before));
        record.storage_charged = cost;
        // `storage_charged` is a fixed-size u128 in Borsh, so this update does
        // not change the amount of storage that was just measured.
        self.custody.insert(key, record);
        self.debit_storage(&record.depositor, cost);
    }

    /// Return the storage prepaid for a record to its depositor.
    pub(crate) fn refund_record_storage(&mut self, record: &CustodyRecord) {
        self.credit_storage(&record.depositor, record.storage_charged);
    }
}
