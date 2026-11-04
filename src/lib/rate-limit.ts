/**
 * In-Memory Rate Limiting for Authentication Attempts
 * Enforces: 5 failed attempts -> 15-minute lockout per phone number.
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const memoryStore = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export interface RateLimitCheckResult {
  isAllowed: boolean;
  remainingAttempts: number;
  lockoutRemainingMinutes?: number;
}

export function checkPinRateLimit(phone: string): RateLimitCheckResult {
  const now = Date.now();
  const record = memoryStore.get(phone);

  if (!record) {
    return { isAllowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Active lockout check
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMs = record.lockedUntil - now;
    return {
      isAllowed: false,
      remainingAttempts: 0,
      lockoutRemainingMinutes: Math.max(1, Math.ceil(remainingMs / (60 * 1000))),
    };
  }

  // If lockout expired or window elapsed, reset
  if (
    (record.lockedUntil && now >= record.lockedUntil) ||
    now - record.firstAttemptAt > WINDOW_MS
  ) {
    memoryStore.delete(phone);
    return { isAllowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return {
    isAllowed: remaining > 0,
    remainingAttempts: remaining,
  };
}

export function recordFailedPinAttempt(phone: string): {
  remainingAttempts: number;
  isLocked: boolean;
  lockoutRemainingMinutes?: number;
} {
  const now = Date.now();
  let record = memoryStore.get(phone);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    record = {
      attempts: 0,
      firstAttemptAt: now,
      lockedUntil: null,
    };
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    memoryStore.set(phone, record);
    return {
      remainingAttempts: 0,
      isLocked: true,
      lockoutRemainingMinutes: 15,
    };
  }

  memoryStore.set(phone, record);
  return {
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
    isLocked: false,
  };
}

export function resetPinRateLimit(phone: string): void {
  memoryStore.delete(phone);
}
