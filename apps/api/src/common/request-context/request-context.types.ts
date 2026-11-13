import type { IncomingHttpHeaders } from "node:http";

export interface RequestContext {
  readonly requestId: string;
}

export interface RequestWithRequestId {
  method?: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  requestId?: string;
}

export interface ResponseWithRequestId {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: "finish", listener: () => void): void;
}
