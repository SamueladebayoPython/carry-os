import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
  AuthSessionGuard,
  type AuthenticatedRequest,
} from "../auth/auth-session.guard.js";
import { ValidateRequest } from "../common/validation/request-validation.decorator.js";
import { WalletVerificationService } from "../wallet-verification/wallet-verification.service.js";
import {
  WALLET_VERIFICATION_CONFIG,
  type WalletVerificationConfig,
} from "../wallet-verification/wallet-verification.config.js";
import { WalletLinkingService } from "./wallet-linking.service.js";

const issueChallengeSchema = z.object({
  address: z.string().trim().min(2).max(64),
}).strict();

const linkWalletSchema = z.object({
  challengeId: z.string().uuid(),
  signature: z.string().min(1).max(256),
  publicKey: z.string().min(1).max(128),
}).strict();

type IssueChallengeBody = z.infer<typeof issueChallengeSchema>;
type LinkWalletBody = z.infer<typeof linkWalletSchema>;

@ApiTags("wallets")
@Controller("wallets/near")
@UseGuards(AuthSessionGuard)
export class WalletLinkingController {
  constructor(
    @Inject(WalletVerificationService)
    private readonly verification: WalletVerificationService,
    @Inject(WalletLinkingService)
    private readonly linking: WalletLinkingService,
    @Inject(WALLET_VERIFICATION_CONFIG)
    private readonly verificationConfig: WalletVerificationConfig,
  ) {}

  @Post("challenge")
  @HttpCode(200)
  @ValidateRequest({ body: issueChallengeSchema })
  @ApiOperation({ summary: "Issue a Carry-account-bound NEAR wallet challenge" })
  @ApiOkResponse({ description: "A single-use NEP-413 challenge to sign." })
  async issueChallenge(
    @Body() body: IssueChallengeBody,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.authIdentity?.userId;
    if (!userId) throw new UnauthorizedException();

    const challenge = await this.verification.issueChallenge({
      network: "near",
      address: body.address,
      subject: userId,
    });

    return {
      challengeId: challenge.id,
      network: challenge.network,
      address: challenge.address,
      message: challenge.message,
      nonce: challenge.nonce,
      recipient: this.verificationConfig.trustedDomain,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  @Post("link")
  @HttpCode(200)
  @ValidateRequest({ body: linkWalletSchema })
  @ApiOperation({ summary: "Link a NEAR wallet after its challenge is signed" })
  @ApiOkResponse({ description: "The verified wallet linked to this account." })
  async linkWallet(
    @Body() body: LinkWalletBody,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.authIdentity?.userId;
    if (!userId) throw new UnauthorizedException();

    const wallet = await this.linking.linkWallet({
      authenticatedUserId: userId,
      challengeId: body.challengeId,
      signature: body.signature,
      publicKey: body.publicKey,
    });

    return {
      network: wallet.network,
      address: wallet.address,
      verifiedAt: wallet.verifiedAt.toISOString(),
    };
  }
}
