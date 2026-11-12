use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    metadata::{
        NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata,
        NFT_METADATA_SPEC,
    },
    NonFungibleToken, Token, TokenId,
};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue,
    borsh::BorshSerialize,
};

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    TokenOwners,
    TokenMetadata,
    Enumeration,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DemoNft {
    tokens: NonFungibleToken,
    metadata: NFTContractMetadata,
}

#[near]
impl DemoNft {
    #[init]
    pub fn new(owner_id: AccountId, name: String, symbol: String) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_owned(),
            name,
            symbol,
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        };
        metadata.assert_valid();
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::TokenOwners,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                None::<StorageKey>,
            ),
            metadata,
        }
    }

    /// Owner-only mint for the testnet demonstration. Attached NEAR covers the
    /// token's actual storage; the standard helper refunds any excess.
    #[payable]
    pub fn nft_mint(&mut self, token_id: TokenId, token_owner_id: AccountId, token_metadata: TokenMetadata) -> Token {
        require!(env::predecessor_account_id() == self.tokens.owner_id, "Only the collection owner can mint");
        require!(env::attached_deposit() >= NearToken::from_yoctonear(1), "Attach storage funding");
        token_metadata.assert_valid();
        let token = self.tokens.internal_mint_with_refund(
            token_id,
            token_owner_id,
            Some(token_metadata),
            Some(env::predecessor_account_id()),
        );
        near_contract_standards::non_fungible_token::events::NftMint {
            owner_id: &token.owner_id,
            token_ids: &[&token.token_id],
            memo: None,
        }
        .emit();
        token
    }
}

#[near]
impl NonFungibleTokenCore for DemoNft {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenEnumeration for DemoNft {
    fn nft_total_supply(&self) -> near_sdk::json_types::U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<near_sdk::json_types::U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> near_sdk::json_types::U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<near_sdk::json_types::U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for DemoNft {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }
}

#[near]
impl NonFungibleTokenResolver for DemoNft {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[cfg(test)]
mod tests;
