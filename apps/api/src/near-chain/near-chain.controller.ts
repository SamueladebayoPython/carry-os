import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { NearChainService } from "./near-chain.service.js";

const NEAR_ACCOUNT_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

@ApiTags("near-testnet")
@Controller("near")
export class NearChainController {
  constructor(@Inject(NearChainService) private readonly near: NearChainService) {}

  @Get("nfts")
  @ApiOperation({ summary: "Read demo collection ownership and Carry vault state from NEAR testnet" })
  @ApiQuery({ name: "owner_id", required: true, example: "alice.testnet" })
  @ApiOkResponse({ description: "NFT ownership and custody fields read from NEAR contracts." })
  listNfts(@Query("owner_id") ownerId: string | undefined) {
    if (!ownerId || ownerId.length > 64 || !NEAR_ACCOUNT_ID.test(ownerId)) {
      throw new BadRequestException("A valid NEAR owner_id is required.");
    }
    return this.near.listDemoNfts(ownerId);
  }
}
