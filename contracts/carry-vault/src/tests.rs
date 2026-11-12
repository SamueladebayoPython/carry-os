use super::*;
use near_sdk::{test_utils::VMContextBuilder, testing_env};

fn account(value: &str) -> AccountId {
    value.parse().expect("valid account id")
}

#[test]
fn storage_deposit_registers_the_payer() {
    let owner = account("owner.testnet");
    testing_env!(VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(owner.clone())
        .signer_account_id(owner.clone())
        .attached_deposit(NearToken::from_near(1))
        .build());

    let mut vault = CarryVault::new(owner.clone());
    let available = vault.storage_deposit();
    assert!(available > 0);
    assert_eq!(vault.storage_balance_of(owner), available);
}

#[test]
fn asset_key_distinguishes_composite_ids() {
    let collection = account("nft.testnet");
    assert_ne!(asset_key(&collection, "a:b"), asset_key(&collection, "a"));
    assert_ne!(asset_key(&collection, "token"), asset_key(&account("other.testnet"), "token"));
}
