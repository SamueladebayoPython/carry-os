import { Module } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "./prisma.service.js";

@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): PrismaService | null =>
        config.databaseUrl ? new PrismaService(config.databaseUrl) : null,
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
