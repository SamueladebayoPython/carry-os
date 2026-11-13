export const CLOCK = Symbol("WALLET_VERIFICATION_CLOCK");

/**
 * Injectable time source so expiry and replay tests do not depend on real
 * waiting.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
