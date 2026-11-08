import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AuthService } from "./auth.service.js";

const verifyBodySchema = z.object({ token: z.string().min(1).max(7_168) }).strict();
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
  @ApiBody({
    schema: {
      type: "object",
      required: ["token"],
      properties: { token: { type: "string", maxLength: 7168 } },
    },
  })
  @ApiOkResponse({ description: "A Carry session cookie was issued." })
  async verify(
    @Body() body: unknown,
    @Headers("origin") origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const parsed = verifyBodySchema.safeParse(body);
    if (!parsed.success) throw new UnauthorizedException("Invalid identity token.");
    const result = await this.auth.exchangeToken(parsed.data.token, origin);
    response.cookie(this.auth.cookieName, result.cookie, {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: "lax",
      path: "/api/auth",
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
  getSession(@Req() request: RequestWithHeaders) {
    const session = this.auth.resolveSession(this.readCookie(request.headers.cookie));
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
  logout(
    @Req() request: RequestWithHeaders,
    @Headers("x-csrf-token") csrfToken: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): void {
    this.auth.logout(this.readCookie(request.headers.cookie), csrfToken, origin);
    response.clearCookie(this.auth.cookieName, {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: "lax",
      path: "/api/auth",
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
