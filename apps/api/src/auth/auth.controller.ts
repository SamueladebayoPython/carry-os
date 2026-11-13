import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService } from "./auth.service.js";

const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

interface RequestWithHeaders {
  headers: { cookie?: string };
}

interface CookieResponse {
  cookie(name: string, value: string, options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  }): void;
  clearCookie(name: string, options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
  }): void;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("near/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Exchange a NEAR Auth identity JWT for a Carry session" })
  @ApiHeader({
    name: "Authorization",
    description: "Bearer <NEAR Auth identity JWT>",
    required: true,
  })
  @ApiOkResponse({ description: "A Carry session cookie was issued." })
  async verify(
    @Headers("authorization") authorization: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const match = authorization?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/i);
    const token = match?.[1];
    if (!token || token.length > 7_168) throw new UnauthorizedException("Invalid identity token.");
    const result = await this.auth.exchangeToken(token, origin);
    response.cookie(this.auth.cookieName, result.cookie, {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: "lax",
      path: "/api",
      maxAge: COOKIE_MAX_AGE_MS,
    });
    return {
      authenticated: true,
      user: result.response.user,
      csrfToken: result.response.csrfToken,
      expiresAt: result.response.expiresAt,
    };
  }

  @Get("session")
  @ApiOperation({ summary: "Read the current Carry session" })
  @ApiOkResponse({ description: "Current Carry identity and session CSRF token." })
  async getSession(@Req() request: RequestWithHeaders) {
    const session = await this.auth.resolveSession(this.readCookie(request.headers.cookie));
    return {
      authenticated: true,
      user: { id: session.identity.userId },
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke the current Carry session" })
  async logout(
    @Req() request: RequestWithHeaders,
    @Headers("x-csrf-token") csrfToken: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.logout(this.readCookie(request.headers.cookie), csrfToken, origin);
    response.clearCookie(this.auth.cookieName, {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: "lax",
      path: "/api",
    });
  }

  private readCookie(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const prefix = `${this.auth.cookieName}=`;
    for (const part of header.split(";")) {
      const cookie = part.trim();
      if (cookie.startsWith(prefix)) return cookie.slice(prefix.length);
    }
    return undefined;
  }
}
