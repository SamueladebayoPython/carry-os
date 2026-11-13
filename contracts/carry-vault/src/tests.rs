use super::*;
use near_sdk::{
    PromiseResult,
    test_utils::{VMContextBuilder, testing_env_with_promise_results},
    testing_env,
};
use std::panic::{AssertUnwindSafe, catch_unwind};

fn account(value: &str) -> AccountId {
    value.parse().expect("valid account id")
}

#[test]
fn storage_deposit_registers_the_payer() {
    let owner = account("owner.testnet");
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(owner.clone())
            .signer_account_id(owner.clone())
            .attached_deposit(NearToken::from_near(1))
            .build()
    );

    let mut vault = CarryVault::new(owner.clone());
    let available = vault.storage_deposit();
    assert!(available > 0);
    assert_eq!(vault.storage_balance_of(owner), available);
}

#[test]
fn asset_key_distinguishes_composite_ids() {
    let collection = account("nft.testnet");
    assert_ne!(asset_key(&collection, "a:b"), asset_key(&collection, "a"));
    assert_ne!(
        asset_key(&collection, "token"),
        asset_key(&account("other.testnet"), "token")
    );
}

fn vault_with_record() -> CarryVault {
    let owner = account("owner.testnet");
    let beneficiary = account("beneficiary.testnet");
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(owner.clone())
            .signer_account_id(owner.clone())
            .build()
    );
    let mut vault = CarryVault::new(owner.clone());
    vault
        .storage_balances
        .insert(&owner, &NearToken::from_near(10).as_yoctonear());
    let key = asset_key(&account("collection.testnet"), "token-1");
    vault.custody.insert(
        &key,
        &CustodyRecord {
            collection_id: account("collection.testnet"),
            token_id: "token-1".into(),
            depositor_id: owner,
            beneficiary_id: beneficiary,
            storage_payer_id: account("owner.testnet"),
            storage_cost: 0,
            pending_withdrawal_id: None,
        },
    );
    vault
}

fn set_attempt(attempt_id: u64) -> CarryVault {
    let mut vault = vault_with_record();
    vault.next_withdrawal_id = attempt_id;
    let key = asset_key(&account("collection.testnet"), "token-1");
    let mut record = vault.custody.get(&key).unwrap();
    record.pending_withdrawal_id = Some(attempt_id);
    vault.custody.insert(&key, &record);
    vault
}

fn owner_result(owner_id: &str) -> PromiseResult {
    PromiseResult::Successful(
        near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "token_id": "token-1",
            "owner_id": owner_id,
            "metadata": null,
            "approved_account_ids": null,
        }))
        .unwrap(),
    )
}

#[test]
fn failed_withdrawal_clears_only_its_pending_attempt() {
    let mut vault = set_attempt(7);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, PromiseResult::Failed);

    let _ownership_check =
        vault.resolve_withdrawal(account("collection.testnet"), "token-1".into(), 7);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, owner_result("vault.testnet"));
    assert!(!vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 7));
    assert_eq!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .pending_withdrawal_id,
        None
    );
}

#[test]
fn failed_transfer_result_does_not_override_verified_beneficiary_ownership() {
    let mut vault = set_attempt(8);
    let transfer_ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(transfer_ctx, PromiseResult::Failed);
    let _ownership_check =
        vault.resolve_withdrawal(account("collection.testnet"), "token-1".into(), 8);

    let owner_ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(owner_ctx, owner_result("beneficiary.testnet"));
    assert!(vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 8));
    assert!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .is_none()
    );
}

#[test]
fn stale_withdrawal_callback_does_not_change_custody() {
    let mut vault = set_attempt(8);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, owner_result("beneficiary.testnet"));

    assert!(!vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 7));
    let record = vault
        .get_custody(account("collection.testnet"), "token-1".into())
        .unwrap();
    assert_eq!(record.pending_withdrawal_id, Some(8));
    assert_eq!(record.beneficiary_id, account("beneficiary.testnet"));
}

#[test]
fn successful_withdrawal_removes_record_and_refunds_storage_payer() {
    let mut vault = set_attempt(9);
    let payer = account("owner.testnet");
    let before = vault.storage_balance_of(payer.clone());
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, owner_result("beneficiary.testnet"));

    assert!(vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 9));
    assert!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .is_none()
    );
    assert!(vault.storage_balance_of(payer) > before);
}

#[test]
fn missing_ownership_result_does_not_clear_pending_withdrawal() {
    let mut vault = set_attempt(11);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, PromiseResult::Failed);

    assert!(!vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 11));
    assert_eq!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .pending_withdrawal_id,
        Some(11)
    );
}

#[test]
fn delayed_old_callback_cannot_override_recovery_attempt() {
    let mut vault = set_attempt(12);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("relayer.testnet"))
        .attached_deposit(NearToken::from_yoctonear(1))
        .build();
    testing_env!(ctx);
    let _recovery = vault.recover_withdrawal(account("collection.testnet"), "token-1".into());

    let record = vault
        .get_custody(account("collection.testnet"), "token-1".into())
        .unwrap();
    assert_eq!(record.pending_withdrawal_id, Some(13));

    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx.clone(), owner_result("beneficiary.testnet"));
    assert!(!vault.finalize_withdrawal(account("collection.testnet"), "token-1".into(), 12));
    assert_eq!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .pending_withdrawal_id,
        Some(13)
    );

    testing_env_with_promise_results(ctx, owner_result("beneficiary.testnet"));
    assert!(vault.finalize_recovery(account("collection.testnet"), "token-1".into(), 13));
    assert!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .is_none()
    );
}

#[test]
fn recovery_does_not_clear_custody_while_vault_still_owns_nft() {
    let mut vault = set_attempt(14);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, owner_result("vault.testnet"));

    assert!(!vault.finalize_recovery(account("collection.testnet"), "token-1".into(), 14));
    assert_eq!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .pending_withdrawal_id,
        Some(14)
    );
}

#[test]
fn recovery_retries_transfer_to_the_recorded_beneficiary() {
    let mut vault = set_attempt(15);
    let ctx = VMContextBuilder::new()
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account("vault.testnet"))
        .build();
    testing_env_with_promise_results(ctx, owner_result("vault.testnet"));

    let _retry = vault.continue_recovery(
        account("collection.testnet"),
        "token-1".into(),
        15,
        account("beneficiary.testnet"),
        account("relayer.testnet"),
    );
    let record = vault
        .get_custody(account("collection.testnet"), "token-1".into())
        .unwrap();
    assert_eq!(record.pending_withdrawal_id, Some(15));
    assert_eq!(record.beneficiary_id, account("beneficiary.testnet"));
}

#[test]
fn only_original_depositor_can_reassign_beneficiary() {
    let mut vault = vault_with_record();
    let collection = account("collection.testnet");
    let token = "token-1".to_owned();

    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(account("beneficiary.testnet"))
            .signer_account_id(account("beneficiary.testnet"))
            .build()
    );
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            vault.set_beneficiary(
                collection.clone(),
                token.clone(),
                account("attacker.testnet"),
            );
        }))
        .is_err()
    );

    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(account("owner.testnet"))
            .signer_account_id(account("owner.testnet"))
            .build()
    );
    vault.set_beneficiary(
        collection.clone(),
        token.clone(),
        account("new-beneficiary.testnet"),
    );
    assert_eq!(
        vault.get_custody(collection, token).unwrap().beneficiary_id,
        account("new-beneficiary.testnet")
    );
}

#[test]
fn old_beneficiary_is_denied_after_reassignment() {
    let mut vault = vault_with_record();
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(account("owner.testnet"))
            .signer_account_id(account("owner.testnet"))
            .build()
    );
    vault.set_beneficiary(
        account("collection.testnet"),
        "token-1".into(),
        account("new-beneficiary.testnet"),
    );

    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(account("beneficiary.testnet"))
            .signer_account_id(account("beneficiary.testnet"))
            .attached_deposit(NearToken::from_yoctonear(1))
            .build()
    );
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            vault.withdraw(account("collection.testnet"), "token-1".into());
        }))
        .is_err()
    );
    assert_eq!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .beneficiary_id,
        account("new-beneficiary.testnet")
    );
}

#[test]
fn approved_nft_operator_cannot_deposit_for_another_owner() {
    let owner = account("owner.testnet");
    let collection = account("collection.testnet");
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(owner.clone())
            .signer_account_id(owner.clone())
            .build()
    );
    let mut vault = CarryVault::new(owner.clone());
    vault.storage_balances.insert(&owner, &u128::MAX);
    vault.approved_collections.insert(&collection);
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(collection.clone())
            .signer_account_id(collection)
            .build()
    );

    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            vault.nft_on_transfer(
                account("operator.testnet"),
                owner,
                "token-operator-test".into(),
                r#"{"beneficiary_id":"attacker.testnet"}"#.into(),
            );
        }))
        .is_err()
    );
    assert!(
        vault
            .get_custody(account("collection.testnet"), "token-operator-test".into())
            .is_none()
    );
}

#[test]
fn only_current_beneficiary_can_start_withdrawal() {
    let mut vault = vault_with_record();
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(account("vault.testnet"))
            .predecessor_account_id(account("owner.testnet"))
            .signer_account_id(account("owner.testnet"))
            .attached_deposit(NearToken::from_yoctonear(1))
            .build()
    );
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            vault.withdraw(account("collection.testnet"), "token-1".into());
        }))
        .is_err()
    );
    assert!(
        vault
            .get_custody(account("collection.testnet"), "token-1".into())
            .unwrap()
            .pending_withdrawal_id
            .is_none()
    );
}
