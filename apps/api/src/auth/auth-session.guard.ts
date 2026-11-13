import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedIdentity } from "./auth.types.js";

export interface AuthenticatedRequest {
  method?: string;
  headers: { cookie?: string; [key: string]: string | undefined };
  authIdentity?: AuthenticatedIdentity;
}

@Injectable()
export class AuthSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = this.readCookie(request.headers.cookie);
    request.authIdentity = (await this.auth.resolveSession(cookie)).identity;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method ?? "")) {
      await this.auth.assertCsrfToken(cookie, request.headers["x-csrf-token"]);
    }
    return true;
  }

  private readCookie(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const prefix = `${this.auth.cookieName}=`;
    for (const part of header.split(";")) {
      const value = part.trim();
      if (value.startsWith(prefix)) return value.slice(prefix.length);
    }
    return undefined;
  }
}
