import { Module } from "@nestjs/common";

import { ChainRegistryService } from "./chain-registry.service.js";

@Module({
  providers: [ChainRegistryService],
  exports: [ChainRegistryService],
})
export class ChainRegistryModule {}
