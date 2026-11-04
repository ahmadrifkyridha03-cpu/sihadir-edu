import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const PARENT_SESSION_COOKIE_NAME = 'sihadir_parent_session';
export const ACTIVE_STUDENT_COOKIE_NAME = 'sihadir_active_student';

export interface ParentSessionPayload {
  userId: string;
  parentId: string;
  phoneWa: string;
  fullName: string;
  role: 'PARENT';
  iat: number;
  exp: number; // Unix timestamp in seconds
}

const DEFAULT_AUTH_SECRET = 'sihadir-parent-auth-secret-key-32chars-2026';
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.QR_SIGNING_SECRET || DEFAULT_AUTH_SECRET;
}

/**
 * Creates an HMAC-SHA256 signed session token.
 * Format: `<base64Payload>.<signatureHex>`
 */
export function createParentSessionToken(
  payload: Omit<ParentSessionPayload, 'iat' | 'exp'>
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: ParentSessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadStr = JSON.stringify(fullPayload);
  const base64Payload = Buffer.from(payloadStr, 'utf-8').toString('base64url');

  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(base64Payload);
  const signature = hmac.digest('hex');

  return `${base64Payload}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session token.
 * Returns null if token is malformed, signature is invalid, or session is expired.
 */
export function verifyParentSessionToken(token: string): ParentSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [base64Payload, providedSignature] = parts;

  // Recompute HMAC signature
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(base64Payload);
  const expectedSignature = hmac.digest('hex');

  const providedBuf = Buffer.from(providedSignature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as ParentSessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Expired
    }

    if (payload.role !== 'PARENT') {
      return null; // Unauthorized role
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves and verifies the parent session from current request cookies.
 */
export async function getParentSession(): Promise<ParentSessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(PARENT_SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  return verifyParentSessionToken(sessionCookie.value);
}

/**
 * Sets the parent session HTTP-only cookie.
 */
export async function setParentSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PARENT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears the parent session cookie (logout).
 */
export async function clearParentSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PARENT_SESSION_COOKIE_NAME);
  cookieStore.delete(ACTIVE_STUDENT_COOKIE_NAME);
}

/**
 * Sets active student cookie for tab/session continuity.
 */
export async function setActiveStudentCookie(studentId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STUDENT_COOKIE_NAME, studentId, {
    httpOnly: false, // Accessible to client scripts if needed
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Gets active student ID from cookie.
 */
export async function getActiveStudentIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_STUDENT_COOKIE_NAME)?.value || null;
}
