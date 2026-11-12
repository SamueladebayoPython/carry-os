use super::*;
use near_sdk::{test_utils::VMContextBuilder, testing_env};

fn account(value: &str) -> AccountId {
    value.parse().expect("valid account id")
}

#[test]
fn owner_can_mint_and_owner_can_query_the_demo_token() {
    let owner = account("owner.testnet");
    let alice = account("alice.testnet");
    testing_env!(VMContextBuilder::new()
        .current_account_id(account("collection.testnet"))
        .predecessor_account_id(owner.clone())
        .signer_account_id(owner.clone())
        .attached_deposit(NearToken::from_near(1))
        .build());

    let mut collection = DemoNft::new(owner.clone(), "Carry Demo".into(), "CARRY".into());
    let token = collection.nft_mint(
        "demo-1".into(),
        alice.clone(),
        TokenMetadata {
            title: Some("Demo NFT".into()),
            description: Some("Testnet custody demonstration".into()),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: None,
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        },
    );
    assert_eq!(token.owner_id, alice);
    assert_eq!(collection.nft_token("demo-1".into()).unwrap().token_id, "demo-1");
    assert_eq!(collection.nft_metadata().name, "Carry Demo");
}
