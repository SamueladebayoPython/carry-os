//! Carry OS NFT custody vault (NEP-171).
//!
//! The vault accepts NFTs through `nft_transfer_call`, records the original
//! owner as the default beneficiary, and lets the current beneficiary either
//! assign a new beneficiary or withdraw the NFT.
//!
//! Security invariants:
//! * Only owner-approved collections can create custody records.
//! * A custody record is created only from `nft_on_transfer`, i.e. after the NFT
//!   collection has already moved the token to this contract.
//! * The collection account is always `env::predecessor_account_id()` inside
//!   `nft_on_transfer`; the untrusted `msg` payload is never used for identity.
//! * Every custody key is unique, so the same NFT cannot be recorded twice.
//! * Only the currently stored beneficiary can change the beneficiary or
//!   withdraw.
//! * Record storage is prepaid by the depositor's registered storage balance.
//! * A withdrawal is marked pending before the cross-contract call, and the
//!   record is deleted only after the transfer callback reports success or an
//!   asynchronous ownership check proves the token has left the vault.

mod beneficiary;
mod deposit;
mod storage;
mod types;
mod withdraw;

#[cfg(test)]
mod tests;

use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::collections::LookupMap;
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

use crate::types::{CustodyKey, CustodyRecord, StorageKey};

/// Hard cap on a token ID. Token IDs are used inside a persistent storage key,
/// so an unbounded string would allow a depositor to inflate vault storage.
pub(crate) const MAX_TOKEN_ID_LEN: usize = 1_024;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Account allowed to approve and revoke NFT collections. Set to the
    /// deployer/predecessor during initialization.
    pub(crate) owner: AccountId,
    pub(crate) custody: LookupMap<CustodyKey, CustodyRecord>,
    /// Collections that are allowed to create custody records.
    pub(crate) approved_collections: LookupMap<AccountId, ()>,
    /// Free, prepaid storage balance per account. Custody records are charged
    /// against this balance and refunded into it when they are removed.
    pub(crate) storage_balances: LookupMap<AccountId, near_sdk::NearToken>,
}

#[near]
impl Contract {
    /// Create an empty vault. The deployer becomes the owner. The method is
    /// payable so the deployer can fund the contract's own state storage.
    #[init]
    #[payable]
    pub fn new() -> Self {
        Self {
            owner: env::predecessor_account_id(),
            custody: LookupMap::new(StorageKey::Custody),
            approved_collections: LookupMap::new(StorageKey::ApprovedCollections),
            storage_balances: LookupMap::new(StorageKey::StorageBalances),
        }
    }

    /// Return the vault owner.
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    /// Return whether a collection is currently allowed to create records.
    pub fn is_collection_approved(&self, collection: AccountId) -> bool {
        self.approved_collections.contains_key(&collection)
    }

    /// Allow a collection to create custody records. Owner-only.
    pub fn approve_collection(&mut self, collection: AccountId) {
        self.assert_owner();
        require!(
            collection != env::current_account_id(),
            "The vault cannot approve itself as a collection"
        );
        self.approved_collections.insert(&collection, &());
    }

    /// Stop a collection from creating new custody records. Owner-only.
    ///
    /// Existing records remain withdrawable and recoverable: the owner cannot
    /// use revocation to freeze or discard already-custodied NFTs.
    pub fn revoke_collection(&mut self, collection: AccountId) {
        self.assert_owner();
        self.approved_collections.remove(&collection);
    }

    /// Return the custody record for a collection/token pair, if any.
    ///
    /// A missing record means the vault does not claim custody of that token.
    pub fn get_custody(&self, collection: AccountId, token_id: TokenId) -> Option<CustodyRecord> {
        self.custody.get(&CustodyKey {
            collection,
            token_id,
        })
    }

    pub(crate) fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the vault owner can perform this action"
        );
    }
}
