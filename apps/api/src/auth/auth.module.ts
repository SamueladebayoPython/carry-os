import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { NearJwtVerifier } from "./near-jwt-verifier.js";
import { AuthSessionGuard } from "./auth-session.guard.js";
import { PrismaModule } from "../database/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, NearJwtVerifier, AuthSessionGuard],
  exports: [AuthService, AuthSessionGuard],
})
export class AuthModule {}
