use crate::types::{CustodyKey, CustodyRecord};
use crate::{Contract, MAX_TOKEN_ID_LEN};
use near_contract_standards::non_fungible_token::core::NonFungibleTokenReceiver;
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::{env, log, near, require, AccountId, NearToken, PromiseOrValue};

#[near]
impl NonFungibleTokenReceiver for Contract {
    /// NEP-171 receiver invoked by the NFT collection after `nft_transfer_call`.
    ///
    /// Returning `false` keeps the token in the vault (the deposit is accepted).
    /// Returning `true` tells the collection to return the token to `sender_id`
    /// (the deposit is refused).
    ///
    /// `msg` is deliberately ignored: it is caller-controlled data and must never
    /// be treated as the collection identity or as proof of ownership.
    fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: TokenId,
        msg: String,
    ) -> PromiseOrValue<bool> {
        let collection = env::predecessor_account_id();
        let vault = env::current_account_id();

        // `sender_id` can be an approved operator. The authoritative depositor is
        // the account that owned the token before the transfer.
        let _ = sender_id;
        let _ = msg;

        require!(
            self.approved_collections.contains_key(&collection),
            "Collection is not approved"
        );
        require!(!token_id.is_empty(), "Token ID must not be empty");
        require!(token_id.len() <= MAX_TOKEN_ID_LEN, "Token ID is too long");
        require!(
            previous_owner_id != vault,
            "The vault cannot deposit its own token"
        );

        let key = CustodyKey {
            collection: collection.clone(),
            token_id: token_id.clone(),
        };

        // Reject duplicates instead of overwriting an existing record. If the
        // collection still sent the token, `true` makes NEP-171 return it.
        if self.custody.get(&key).is_some() {
            log!("Duplicate deposit refused for {}#{}", collection, token_id);
            return PromiseOrValue::Value(true);
        }

        // The receiver only runs after the collection has moved the token to this
        // contract, so recording custody here does not claim a token we do not
        // control. If the cross-contract call later fails, NEP-171 resolves the
        // transfer back to the original owner and no record is kept.
        let mut record = CustodyRecord {
            depositor: previous_owner_id.clone(),
            beneficiary: previous_owner_id.clone(),
            deposited_at_block: env::block_height(),
            withdrawal_pending: false,
            withdrawal_started_at_block: 0,
            storage_charged: NearToken::ZERO,
        };

        // This checks that the depositor has registered a storage balance and
        // debits the measured record cost. A panic leaves no record behind.
        self.insert_new_record(&key, &mut record);
        log!(
            "Deposited {}#{} for {} (storage charged: {})",
            collection,
            token_id,
            previous_owner_id,
            record.storage_charged
        );

        PromiseOrValue::Value(false)
    }
}
