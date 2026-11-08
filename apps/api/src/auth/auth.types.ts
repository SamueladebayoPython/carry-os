export interface AuthenticatedIdentity {
  userId: string;
  issuer: string;
  subject: string;
}

export interface SessionResponse {
  authenticated: true;
  user: { id: string };
  csrfToken: string;
  expiresAt: string;
}

export interface StoredSession {
  tokenHash: string;
  csrfToken: string;
  identity: AuthenticatedIdentity;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}
