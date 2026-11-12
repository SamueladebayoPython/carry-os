use near_contract_standards::non_fungible_token::{
    core::{ext_nft_core, NonFungibleTokenCore},
    receiver::NonFungibleTokenReceiver,
    TokenId,
};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas,
    NearToken, PanicOnDefault, Promise, PromiseOrValue,
    borsh::BorshSerialize,
    collections::{LookupMap, UnorderedSet},
    serde::{Deserialize, Serialize},
};

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Eq)]
pub struct CustodyRecord {
    pub collection_id: AccountId,
    pub token_id: TokenId,
    pub depositor_id: AccountId,
    pub beneficiary_id: AccountId,
    pub storage_payer_id: AccountId,
    pub storage_cost: u128,
    pub pending_withdrawal_id: Option<u64>,
}

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Collections,
    Custody,
    StorageBalances,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CarryVault {
    owner_id: AccountId,
    approved_collections: UnorderedSet<AccountId>,
    custody: LookupMap<String, CustodyRecord>,
    storage_balances: LookupMap<AccountId, u128>,
    next_withdrawal_id: u64,
}

#[near]
impl CarryVault {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            approved_collections: UnorderedSet::new(StorageKey::Collections),
            custody: LookupMap::new(StorageKey::Custody),
            storage_balances: LookupMap::new(StorageKey::StorageBalances),
            next_withdrawal_id: 0,
        }
    }

    /// Fund storage for custody records and collection allowlist updates.
    #[payable]
    pub fn storage_deposit(&mut self) -> u128 {
        let payer = env::predecessor_account_id();
        let attached = env::attached_deposit().as_yoctonear();
        let before = env::storage_usage();
        let prior = self.storage_balances.get(&payer).unwrap_or(0);
        self.storage_balances.insert(&payer, &prior);
        let registration_cost = (env::storage_usage() - before) as u128
            * env::storage_byte_cost().as_yoctonear();
        require!(attached >= registration_cost, "Deposit does not cover storage registration");
        let balance = prior
            .checked_add(attached - registration_cost)
            .expect("Storage balance overflow");
        self.storage_balances.insert(&payer, &balance);
        balance
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> u128 {
        self.storage_balances.get(&account_id).unwrap_or(0)
    }

    pub fn add_approved_collection(&mut self, collection_id: AccountId) {
        self.assert_owner();
        let before = env::storage_usage();
        require!(self.approved_collections.insert(&collection_id), "Collection already approved");
        self.charge_storage(&env::predecessor_account_id(), env::storage_usage() - before);
    }

    pub fn remove_approved_collection(&mut self, collection_id: AccountId) {
        self.assert_owner();
        let before = env::storage_usage();
        require!(self.approved_collections.remove(&collection_id), "Collection is not approved");
        self.refund_storage(&env::predecessor_account_id(), before - env::storage_usage());
    }

    pub fn get_custody(&self, collection_id: AccountId, token_id: TokenId) -> Option<CustodyRecord> {
        self.custody.get(&asset_key(&collection_id, &token_id))
    }

    /// Only the original NFT owner can change the beneficiary. This is an MVP
    /// wallet-signed flow; authenticated relaying is intentionally not implied.
    pub fn set_beneficiary(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        beneficiary_id: AccountId,
    ) {
        let key = asset_key(&collection_id, &token_id);
        let mut record = self.custody.get(&key).expect("NFT is not in Carry custody");
        require!(env::predecessor_account_id() == record.depositor_id, "Only the depositor can reassign the beneficiary");
        require!(record.pending_withdrawal_id.is_none(), "Withdrawal is pending");
        require!(beneficiary_id != env::current_account_id(), "Vault cannot be its own beneficiary");
        require!(beneficiary_id != record.beneficiary_id, "Beneficiary is unchanged");

        let before = env::storage_usage();
        record.beneficiary_id = beneficiary_id;
        self.custody.insert(&key, &record);
        let after = env::storage_usage();
        if after > before {
            let cost = (after - before) as u128 * env::storage_byte_cost().as_yoctonear();
            self.charge_storage(&record.storage_payer_id, after - before);
            record.storage_cost = record.storage_cost.checked_add(cost).expect("Storage cost overflow");
            self.custody.insert(&key, &record);
        } else if before > after {
            let bytes = before - after;
            let credit = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
            record.storage_cost = record.storage_cost.checked_sub(credit).expect("Storage refund overflow");
            self.refund_storage(&record.storage_payer_id, bytes);
            self.custody.insert(&key, &record);
        }
    }

    /// Attach exactly one yoctoNEAR. The same yocto is forwarded to the NFT
    /// contract to satisfy NEP-171's transfer requirement.
    #[payable]
    pub fn withdraw(&mut self, collection_id: AccountId, token_id: TokenId) -> Promise {
        assert_one_yocto();
        let key = asset_key(&collection_id, &token_id);
        let mut record = self.custody.get(&key).expect("NFT is not in Carry custody");
        require!(env::predecessor_account_id() == record.beneficiary_id, "Only the current beneficiary can withdraw");
        require!(record.pending_withdrawal_id.is_none(), "Withdrawal is already pending");

        self.next_withdrawal_id = self.next_withdrawal_id.checked_add(1).expect("Withdrawal id overflow");
        let attempt_id = self.next_withdrawal_id;
        record.pending_withdrawal_id = Some(attempt_id);
        let beneficiary_id = record.beneficiary_id.clone();
        self.custody.insert(&key, &record);

        ext_nft_core::ext(collection_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(20))
            .nft_transfer(beneficiary_id, token_id.clone(), None, Some("Carry custody withdrawal".to_owned()))
            .then(ext_vault::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(15))
                .resolve_withdrawal(collection_id, token_id, attempt_id))
    }

    pub fn is_approved_collection(&self, collection_id: AccountId) -> bool {
        self.approved_collections.contains(&collection_id)
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the vault owner can manage collections");
    }

    fn charge_storage(&mut self, payer: &AccountId, bytes: u64) {
        let current = self.storage_balances.get(payer).expect("Storage payer must register and fund storage");
        let cost = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        require!(current >= cost, "Insufficient prepaid storage balance");
        self.storage_balances.insert(payer, &(current - cost));
    }

    fn refund_storage(&mut self, payer: &AccountId, bytes: u64) {
        let current = self.storage_balances.get(payer).expect("Storage payer must be registered");
        let credit = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        self.storage_balances.insert(payer, &current.checked_add(credit).expect("Storage balance overflow"));
    }
}

#[near]
impl NonFungibleTokenReceiver for CarryVault {
    fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: TokenId,
        msg: String,
    ) -> PromiseOrValue<bool> {
        let collection_id = env::predecessor_account_id();
        require!(self.approved_collections.contains(&collection_id), "NFT collection is not approved");
        require!(!token_id.is_empty() && token_id.len() <= 256, "Invalid token id");
        let beneficiary_id = if msg.is_empty() {
            previous_owner_id.clone()
        } else {
            let message: DepositMessage = near_sdk::serde_json::from_str(&msg).expect("Invalid deposit message");
            message.beneficiary_id
        };
        require!(beneficiary_id != env::current_account_id(), "Vault cannot be its own beneficiary");
        let key = asset_key(&collection_id, &token_id);
        require!(self.custody.get(&key).is_none(), "NFT is already in custody");
        require!(self.storage_balances.get(&sender_id).is_some(), "Depositor must fund vault storage before depositing");

        let before = env::storage_usage();
        let mut record = CustodyRecord {
            collection_id,
            token_id,
            depositor_id: previous_owner_id,
            beneficiary_id,
            storage_payer_id: sender_id.clone(),
            storage_cost: 0,
            pending_withdrawal_id: None,
        };
        self.custody.insert(&key, &record);
        let bytes = env::storage_usage() - before;
        self.charge_storage(&sender_id, bytes);
        record.storage_cost = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        self.custody.insert(&key, &record);

        PromiseOrValue::Value(false)
    }
}

#[near]
impl CarryVault {
    /// Private callback. A failed transfer leaves the custody record intact and
    /// clears only its matching pending attempt. There is no time-based unlock.
    #[private]
    pub fn resolve_withdrawal(&mut self, collection_id: AccountId, token_id: TokenId, attempt_id: u64) -> bool {
        require!(env::promise_results_count() == 1, "Expected one NFT transfer result");
        let key = asset_key(&collection_id, &token_id);
        let Some(mut record) = self.custody.get(&key) else { return false };
        if record.pending_withdrawal_id != Some(attempt_id) {
            return false;
        }

        if matches!(env::promise_result(0), near_sdk::PromiseResult::Successful(_)) {
            let before = env::storage_usage();
            self.custody.remove(&key);
            let bytes = before - env::storage_usage();
            self.refund_storage(&record.storage_payer_id, bytes);
            true
        } else {
            record.pending_withdrawal_id = None;
            self.custody.insert(&key, &record);
            false
        }
    }
}

#[near(serializers = [json])]
#[derive(Deserialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
struct DepositMessage {
    beneficiary_id: AccountId,
}

#[ext_contract(ext_vault)]
trait ExtVault {
    fn resolve_withdrawal(&mut self, collection_id: AccountId, token_id: TokenId, attempt_id: u64) -> bool;
}

fn asset_key(collection_id: &AccountId, token_id: &str) -> String {
    format!("{}:{}:{}", collection_id.as_str().len(), collection_id, token_id)
}

#[cfg(test)]
mod tests;
