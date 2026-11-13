import { Module } from "@nestjs/common";

import { NearChainController } from "./near-chain.controller.js";
import { NearChainService } from "./near-chain.service.js";

@Module({
  controllers: [NearChainController],
  providers: [NearChainService],
  exports: [NearChainService],
})
export class NearChainModule {}
