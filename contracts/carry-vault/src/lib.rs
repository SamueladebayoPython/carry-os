use near_contract_standards::non_fungible_token::{
    TokenId,
    core::{NonFungibleTokenCore, NonFungibleTokenReceiver, ext_nft_core},
};
use near_sdk::{
    AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
    assert_one_yocto,
    borsh::BorshSerialize,
    collections::{LookupMap, UnorderedSet},
    env, ext_contract, near, require,
    serde::Deserialize,
};

const GAS_FOR_NFT_TRANSFER: Gas = Gas::from_tgas(20);
const GAS_FOR_NFT_VIEW: Gas = Gas::from_tgas(10);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(25);
const RECOVERY_DEPOSIT: NearToken = NearToken::from_yoctonear(1);

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
        let registration_cost =
            (env::storage_usage() - before) as u128 * env::storage_byte_cost().as_yoctonear();
        require!(
            attached >= registration_cost,
            "Deposit does not cover storage registration"
        );
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
        require!(
            self.approved_collections.insert(&collection_id),
            "Collection already approved"
        );
        self.charge_storage(
            &env::predecessor_account_id(),
            env::storage_usage() - before,
        );
    }

    pub fn remove_approved_collection(&mut self, collection_id: AccountId) {
        self.assert_owner();
        let before = env::storage_usage();
        require!(
            self.approved_collections.remove(&collection_id),
            "Collection is not approved"
        );
        self.refund_storage(
            &env::predecessor_account_id(),
            before - env::storage_usage(),
        );
    }

    pub fn get_custody(
        &self,
        collection_id: AccountId,
        token_id: TokenId,
    ) -> Option<CustodyRecord> {
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
        require!(
            env::predecessor_account_id() == record.depositor_id,
            "Only the depositor can reassign the beneficiary"
        );
        require!(
            record.pending_withdrawal_id.is_none(),
            "Withdrawal is pending"
        );
        require!(
            beneficiary_id != env::current_account_id(),
            "Vault cannot be its own beneficiary"
        );
        require!(
            beneficiary_id != record.beneficiary_id,
            "Beneficiary is unchanged"
        );

        let before = env::storage_usage();
        record.beneficiary_id = beneficiary_id;
        self.custody.insert(&key, &record);
        let after = env::storage_usage();
        if after > before {
            let cost = (after - before) as u128 * env::storage_byte_cost().as_yoctonear();
            self.charge_storage(&record.storage_payer_id, after - before);
            record.storage_cost = record
                .storage_cost
                .checked_add(cost)
                .expect("Storage cost overflow");
            self.custody.insert(&key, &record);
        } else if before > after {
            let bytes = before - after;
            let credit = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
            record.storage_cost = record
                .storage_cost
                .checked_sub(credit)
                .expect("Storage refund overflow");
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
        require!(
            env::predecessor_account_id() == record.beneficiary_id,
            "Only the current beneficiary can withdraw"
        );
        require!(
            record.pending_withdrawal_id.is_none(),
            "Withdrawal is already pending"
        );

        self.next_withdrawal_id = self
            .next_withdrawal_id
            .checked_add(1)
            .expect("Withdrawal id overflow");
        let attempt_id = self.next_withdrawal_id;
        record.pending_withdrawal_id = Some(attempt_id);
        let beneficiary_id = record.beneficiary_id.clone();
        self.custody.insert(&key, &record);

        ext_nft_core::ext(collection_id.clone())
            .with_attached_deposit(RECOVERY_DEPOSIT)
            .with_static_gas(GAS_FOR_NFT_TRANSFER)
            .nft_transfer(
                beneficiary_id,
                token_id.clone(),
                None,
                Some("Carry custody withdrawal".to_owned()),
            )
            .then(
                ext_vault::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .resolve_withdrawal(collection_id, token_id, attempt_id),
            )
    }

    /// Reconcile a withdrawal that is still pending. Recovery always targets
    /// the recorded beneficiary. Ownership is checked before custody changes;
    /// when the vault still owns the NFT, recovery retries that same transfer.
    #[payable]
    pub fn recover_withdrawal(&mut self, collection_id: AccountId, token_id: TokenId) -> Promise {
        assert_one_yocto();
        let key = asset_key(&collection_id, &token_id);
        let mut record = self.custody.get(&key).expect("NFT is not in Carry custody");
        require!(
            record.pending_withdrawal_id.is_some(),
            "No withdrawal is pending"
        );

        self.next_withdrawal_id = self
            .next_withdrawal_id
            .checked_add(1)
            .expect("Withdrawal id overflow");
        let recovery_id = self.next_withdrawal_id;
        record.pending_withdrawal_id = Some(recovery_id);
        let beneficiary_id = record.beneficiary_id.clone();
        self.custody.insert(&key, &record);

        ext_nft_core::ext(collection_id.clone())
            .with_static_gas(GAS_FOR_NFT_VIEW)
            .nft_token(token_id.clone())
            .then(
                ext_vault::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .continue_recovery(
                        collection_id,
                        token_id,
                        recovery_id,
                        beneficiary_id,
                        env::predecessor_account_id(),
                    ),
            )
    }

    pub fn is_approved_collection(&self, collection_id: AccountId) -> bool {
        self.approved_collections.contains(&collection_id)
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the vault owner can manage collections"
        );
    }

    fn charge_storage(&mut self, payer: &AccountId, bytes: u64) {
        let current = self
            .storage_balances
            .get(payer)
            .expect("Storage payer must register and fund storage");
        let cost = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        require!(current >= cost, "Insufficient prepaid storage balance");
        self.storage_balances.insert(payer, &(current - cost));
    }

    fn refund_storage(&mut self, payer: &AccountId, bytes: u64) {
        let current = self
            .storage_balances
            .get(payer)
            .expect("Storage payer must be registered");
        let credit = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        self.storage_balances.insert(
            payer,
            &current
                .checked_add(credit)
                .expect("Storage balance overflow"),
        );
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
        require!(
            self.approved_collections.contains(&collection_id),
            "NFT collection is not approved"
        );
        // NEP-171 also lets an approved account call nft_transfer_call. Such an
        // operator is not the owner and must not choose a beneficiary for the
        // owner's asset under this MVP's direct-owner authorization model.
        require!(
            sender_id == previous_owner_id,
            "Only the NFT owner can deposit into Carry"
        );
        require!(
            !token_id.is_empty() && token_id.len() <= 256,
            "Invalid token id"
        );
        let beneficiary_id = if msg.is_empty() {
            previous_owner_id.clone()
        } else {
            let message: DepositMessage =
                near_sdk::serde_json::from_str(&msg).expect("Invalid deposit message");
            message.beneficiary_id
        };
        require!(
            beneficiary_id != env::current_account_id(),
            "Vault cannot be its own beneficiary"
        );
        let key = asset_key(&collection_id, &token_id);
        require!(
            self.custody.get(&key).is_none(),
            "NFT is already in custody"
        );
        require!(
            self.storage_balances.get(&previous_owner_id).is_some(),
            "Depositor must fund vault storage before depositing"
        );

        let before = env::storage_usage();
        let mut record = CustodyRecord {
            collection_id,
            token_id,
            depositor_id: previous_owner_id,
            beneficiary_id,
            storage_payer_id: previous_owner_id.clone(),
            storage_cost: 0,
            pending_withdrawal_id: None,
        };
        self.custody.insert(&key, &record);
        let bytes = env::storage_usage() - before;
        self.charge_storage(&previous_owner_id, bytes);
        record.storage_cost = (bytes as u128) * env::storage_byte_cost().as_yoctonear();
        self.custody.insert(&key, &record);

        PromiseOrValue::Value(false)
    }
}

#[near]
impl CarryVault {
    /// Private callback. It verifies the NFT's current owner before removing
    /// custody or clearing the matching pending attempt.
    #[private]
    pub fn resolve_withdrawal(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        attempt_id: u64,
    ) -> Promise {
        require!(
            env::promise_results_count() == 1,
            "Expected one NFT transfer result"
        );
        ext_nft_core::ext(collection_id.clone())
            .with_static_gas(GAS_FOR_NFT_VIEW)
            .nft_token(token_id.clone())
            .then(
                ext_vault::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .finalize_withdrawal(collection_id, token_id, attempt_id),
            )
    }

    /// Runs after the first ownership check in a recovery attempt.
    #[private]
    pub fn continue_recovery(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
        beneficiary_id: AccountId,
        requester_id: AccountId,
    ) -> Promise {
        require!(
            env::promise_results_count() == 1,
            "Expected one recovery ownership result"
        );
        let key = asset_key(&collection_id, &token_id);
        let Some(record) = self.custody.get(&key) else {
            return refund_recovery_deposit(requester_id);
        };
        if record.pending_withdrawal_id != Some(recovery_id)
            || record.beneficiary_id != beneficiary_id
        {
            return refund_recovery_deposit(requester_id);
        }

        let Some(owner_id) = promised_nft_owner() else {
            return refund_recovery_deposit(requester_id);
        };
        if owner_id == beneficiary_id {
            self.remove_custody(&key, &record);
            return refund_recovery_deposit(requester_id);
        }
        if owner_id != env::current_account_id() {
            return refund_recovery_deposit(requester_id);
        }

        ext_nft_core::ext(collection_id.clone())
            .with_attached_deposit(RECOVERY_DEPOSIT)
            .with_static_gas(GAS_FOR_NFT_TRANSFER)
            .nft_transfer(
                beneficiary_id,
                token_id.clone(),
                None,
                Some("Carry withdrawal recovery".to_owned()),
            )
            .then(
                ext_vault::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .verify_recovery_transfer(collection_id, token_id, recovery_id),
            )
    }

    /// The retry transfer's result is not itself trusted as proof of ownership;
    /// fetch the NFT owner again before deciding whether custody can be removed.
    #[private]
    pub fn verify_recovery_transfer(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
    ) -> Promise {
        require!(
            env::promise_results_count() == 1,
            "Expected one recovery transfer result"
        );
        ext_nft_core::ext(collection_id.clone())
            .with_static_gas(GAS_FOR_NFT_VIEW)
            .nft_token(token_id.clone())
            .then(
                ext_vault::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .finalize_recovery(collection_id, token_id, recovery_id),
            )
    }

    #[private]
    pub fn finalize_withdrawal(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        attempt_id: u64,
    ) -> bool {
        require!(
            env::promise_results_count() == 1,
            "Expected one NFT ownership result"
        );
        let key = asset_key(&collection_id, &token_id);
        let Some(mut record) = self.custody.get(&key) else {
            return false;
        };
        if record.pending_withdrawal_id != Some(attempt_id) {
            return false;
        }
        let Some(owner_id) = promised_nft_owner() else {
            return false;
        };
        if owner_id == record.beneficiary_id {
            self.remove_custody(&key, &record);
            true
        } else if owner_id == env::current_account_id() {
            record.pending_withdrawal_id = None;
            self.custody.insert(&key, &record);
            false
        } else {
            false
        }
    }

    #[private]
    pub fn finalize_recovery(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
    ) -> bool {
        require!(
            env::promise_results_count() == 1,
            "Expected one recovered NFT ownership result"
        );
        let key = asset_key(&collection_id, &token_id);
        let Some(record) = self.custody.get(&key) else {
            return false;
        };
        if record.pending_withdrawal_id != Some(recovery_id) {
            return false;
        }
        if promised_nft_owner().as_ref() == Some(&record.beneficiary_id) {
            self.remove_custody(&key, &record);
            true
        } else {
            // In particular, observing the vault as owner during recovery does
            // not prove an older transfer receipt cannot still execute.
            false
        }
    }

    fn remove_custody(&mut self, key: &str, record: &CustodyRecord) {
        let before = env::storage_usage();
        self.custody.remove(&key.to_owned());
        let bytes = before - env::storage_usage();
        self.refund_storage(&record.storage_payer_id, bytes);
    }
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct NftOwner {
    owner_id: AccountId,
}

fn promised_nft_owner() -> Option<AccountId> {
    match env::promise_result(0) {
        near_sdk::PromiseResult::Successful(bytes) => {
            near_sdk::serde_json::from_slice::<Option<NftOwner>>(&bytes)
                .ok()
                .flatten()
                .map(|token| token.owner_id)
        }
        near_sdk::PromiseResult::Failed => None,
    }
}

fn refund_recovery_deposit(requester_id: AccountId) -> Promise {
    Promise::new(requester_id).transfer(RECOVERY_DEPOSIT)
}

#[near(serializers = [json])]
struct DepositMessage {
    beneficiary_id: AccountId,
}

#[ext_contract(ext_vault)]
trait ExtVault {
    fn resolve_withdrawal(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        attempt_id: u64,
    ) -> Promise;
    fn continue_recovery(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
        beneficiary_id: AccountId,
        requester_id: AccountId,
    ) -> Promise;
    fn verify_recovery_transfer(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
    ) -> Promise;
    fn finalize_withdrawal(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        attempt_id: u64,
    ) -> bool;
    fn finalize_recovery(
        &mut self,
        collection_id: AccountId,
        token_id: TokenId,
        recovery_id: u64,
    ) -> bool;
}

fn asset_key(collection_id: &AccountId, token_id: &str) -> String {
    format!(
        "{}:{}:{}",
        collection_id.as_str().len(),
        collection_id,
        token_id
    )
}

#[cfg(test)]
mod tests;
