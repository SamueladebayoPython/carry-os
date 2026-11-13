#![allow(deprecated)]

use std::str::FromStr;

use near_contract_standards::non_fungible_token::core::NonFungibleTokenReceiver;
use near_sdk::test_utils::{testing_env_with_promise_results, VMContextBuilder};
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseOrValue, PromiseResult, VMContext};

use crate::types::CustodyRecord;
use crate::Contract;

fn account(id: &str) -> AccountId {
    AccountId::from_str(id).expect("valid test account")
}

fn vault() -> AccountId {
    account("vault.testnet")
}

fn collection() -> AccountId {
    account("nft.testnet")
}

fn alice() -> AccountId {
    account("alice.testnet")
}

fn bob() -> AccountId {
    account("bob.testnet")
}

fn carol() -> AccountId {
    account("carol.testnet")
}

fn context(caller: &AccountId) -> VMContext {
    VMContextBuilder::new()
        .current_account_id(vault())
        .signer_account_id(caller.clone())
        .predecessor_account_id(caller.clone())
        .attached_deposit(NearToken::from_yoctonear(0))
        .prepaid_gas(Gas::from_tgas(300))
        .build()
}

fn new_contract() -> Contract {
    testing_env!(context(&alice()));
    Contract::new()
}

fn assert_kept(outcome: PromiseOrValue<bool>) {
    match outcome {
        PromiseOrValue::Value(kept) => assert!(!kept, "the vault should keep the NFT"),
        PromiseOrValue::Promise(_) => panic!("expected an immediate receiver result"),
    }
}

fn deposit(contract: &mut Contract, depositor: &AccountId, token_id: &str) {
    // In a real deposit the collection contract is the predecessor.
    testing_env!(context(&collection()));
    let outcome = contract.nft_on_transfer(
        depositor.clone(),
        depositor.clone(),
        token_id.to_string(),
        String::new(),
    );
    assert_kept(outcome);
}

fn custody(contract: &Contract, token_id: &str) -> Option<CustodyRecord> {
    contract.get_custody(collection(), token_id.to_string())
}

#[test]
fn deposit_records_original_owner_as_beneficiary() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-1");

    let record = custody(&contract, "token-1").expect("custody record");
    assert_eq!(record.depositor, alice());
    assert_eq!(record.beneficiary, alice());
    assert!(!record.withdrawal_pending);
}

#[test]
fn duplicate_deposit_is_refused_and_preserves_the_first_record() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-2");

    testing_env!(context(&collection()));
    let outcome = contract.nft_on_transfer(bob(), bob(), "token-2".to_string(), String::new());

    match outcome {
        PromiseOrValue::Value(return_to_sender) => {
            assert!(
                return_to_sender,
                "a duplicate deposit must be returned to the sender"
            )
        }
        PromiseOrValue::Promise(_) => panic!("expected an immediate receiver result"),
    }

    let record = custody(&contract, "token-2").expect("original record remains");
    assert_eq!(record.depositor, alice());
    assert_eq!(record.beneficiary, alice());
}

#[test]
fn beneficiary_can_assign_a_new_beneficiary() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-3");

    testing_env!(context(&alice()));
    contract.set_beneficiary(collection(), "token-3".to_string(), bob());

    let record = custody(&contract, "token-3").expect("custody record");
    assert_eq!(record.depositor, alice());
    assert_eq!(record.beneficiary, bob());
}

#[test]
#[should_panic(expected = "Only the current beneficiary can change the beneficiary")]
fn non_beneficiary_cannot_change_the_beneficiary() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-4");

    testing_env!(context(&bob()));
    contract.set_beneficiary(collection(), "token-4".to_string(), carol());
}

#[test]
#[should_panic(expected = "Only the current beneficiary can change the beneficiary")]
fn previous_beneficiary_loses_authorization_immediately() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-5");

    testing_env!(context(&alice()));
    contract.set_beneficiary(collection(), "token-5".to_string(), bob());

    // Alice remains the depositor, but she is no longer the beneficiary.
    contract.set_beneficiary(collection(), "token-5".to_string(), carol());
}

#[test]
#[should_panic(expected = "Cannot change beneficiary while a withdrawal is pending")]
fn beneficiary_cannot_change_while_a_withdrawal_is_pending() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-6");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-6".to_string());
    contract.set_beneficiary(collection(), "token-6".to_string(), bob());
}

#[test]
#[should_panic(expected = "Only the current beneficiary can withdraw")]
fn non_beneficiary_cannot_withdraw() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-7");

    testing_env!(context(&bob()));
    let _ = contract.withdraw(collection(), "token-7".to_string());
}

#[test]
fn withdraw_marks_the_record_pending() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-8");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-8".to_string());

    // The record must survive while the asynchronous transfer is in flight.
    let record = custody(&contract, "token-8").expect("record remains during withdrawal");
    assert!(record.withdrawal_pending);
}

#[test]
#[should_panic(expected = "A withdrawal is already pending for this NFT")]
fn concurrent_withdrawal_is_blocked() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-9");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-9".to_string());
    let _ = contract.withdraw(collection(), "token-9".to_string());
}

#[test]
fn successful_transfer_callback_removes_the_record() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-10");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-10".to_string());
    assert!(custody(&contract, "token-10").is_some());

    // Only the contract itself may resolve a withdrawal.
    testing_env_with_promise_results(context(&vault()), PromiseResult::Successful(vec![]));
    contract.on_withdraw_complete(collection(), "token-10".to_string());

    assert!(custody(&contract, "token-10").is_none());
}

#[test]
fn failed_transfer_callback_keeps_the_record_and_clears_pending() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-11");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-11".to_string());

    testing_env_with_promise_results(context(&vault()), PromiseResult::Failed);
    contract.on_withdraw_complete(collection(), "token-11".to_string());

    let record = custody(&contract, "token-11").expect("record retained after failure");
    assert!(!record.withdrawal_pending);
    assert_eq!(record.beneficiary, alice());

    // The beneficiary can retry after a failed transfer.
    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-11".to_string());
    assert!(
        custody(&contract, "token-11")
            .expect("record")
            .withdrawal_pending
    );
}

#[test]
#[should_panic(expected = "Only the vault can resolve withdrawals")]
fn withdrawal_callback_rejects_external_callers() {
    let mut contract = new_contract();
    deposit(&mut contract, &alice(), "token-12");

    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "token-12".to_string());

    testing_env_with_promise_results(context(&bob()), PromiseResult::Successful(vec![]));
    contract.on_withdraw_complete(collection(), "token-12".to_string());
}

#[test]
#[should_panic(expected = "Token ID must not be empty")]
fn empty_token_id_is_rejected() {
    let mut contract = new_contract();
    testing_env!(context(&collection()));
    let _ = contract.nft_on_transfer(alice(), alice(), String::new(), String::new());
}

#[test]
#[should_panic(expected = "Token ID is too long")]
fn oversized_token_id_is_rejected() {
    let mut contract = new_contract();
    testing_env!(context(&collection()));
    let oversized = "a".repeat(crate::MAX_TOKEN_ID_LEN + 1);
    let _ = contract.nft_on_transfer(alice(), alice(), oversized, String::new());
}

#[test]
#[should_panic(expected = "The vault cannot deposit its own token")]
fn the_vault_cannot_deposit_its_own_token() {
    let mut contract = new_contract();
    testing_env!(context(&collection()));
    let _ = contract.nft_on_transfer(vault(), vault(), "token-13".to_string(), String::new());
}

#[test]
fn get_custody_returns_none_for_unknown_tokens() {
    let contract = new_contract();
    assert!(custody(&contract, "missing").is_none());
}

#[test]
// `env::panic_str` panics without a payload on non-wasm builds, so the message
// itself cannot be asserted here. `require!`-based checks are asserted by name.
#[should_panic]
fn withdraw_without_custody_is_rejected() {
    let mut contract = new_contract();
    testing_env!(context(&alice()));
    let _ = contract.withdraw(collection(), "missing".to_string());
}

#[test]
fn callback_for_an_unknown_record_is_ignored() {
    let mut contract = new_contract();
    testing_env_with_promise_results(context(&vault()), PromiseResult::Successful(vec![]));

    // No record exists, so the callback must not create or delete anything.
    contract.on_withdraw_complete(collection(), "missing".to_string());
    assert!(custody(&contract, "missing").is_none());
}
