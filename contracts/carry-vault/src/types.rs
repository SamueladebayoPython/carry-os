use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::{near, AccountId, BorshStorageKey, NearToken};

/// A single NFT held in custody.
///
/// `depositor` is the account that owned the token immediately before it was
/// deposited. It is intentionally separate from `beneficiary`: a caller can use
/// NEP-171 approval management to deposit someone else's token, in which case
/// `sender_id` is an operator but the original owner is still the depositor.
///
/// `storage_charged` is the amount of storage cost that was debited from the
/// depositor's storage balance when this record was allocated (plus any later
/// beneficiary-size adjustments). It is refunded to the depositor when the
/// record is removed.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CustodyRecord {
    pub depositor: AccountId,
    pub beneficiary: AccountId,
    pub deposited_at_block: u64,
    pub withdrawal_pending: bool,
    /// Block at which the in-flight withdrawal started. Recovery uses this to
    /// make sure the original receipt chain has had time to finish before it
    /// asks the collection who owns the token.
    pub withdrawal_started_at_block: u64,
    pub storage_charged: NearToken,
}

/// Composite storage key. Using both the collection and token ID prevents
/// collisions between tokens that share a token ID on different collections.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct CustodyKey {
    pub collection: AccountId,
    pub token_id: TokenId,
}

/// Unique prefixes for persistent collections. Keep these stable after deploy.
#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
pub(crate) enum StorageKey {
    Custody,
    ApprovedCollections,
    StorageBalances,
}
