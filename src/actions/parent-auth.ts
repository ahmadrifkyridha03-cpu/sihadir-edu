'use server';

import db from '@/lib/db';
import { normalizeIndoPhone, isValidIndoPhone } from '@/lib/phone';
import { verifyPin } from '@/lib/auth-crypto';
import {
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
} from '@/lib/rate-limit';
import {
  createParentSessionToken,
  setParentSessionCookie,
  clearParentSessionCookie,
  setActiveStudentCookie,
  getParentSession,
  ParentSessionPayload,
} from '@/lib/session';

export interface ParentLoginResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockoutRemainingMinutes?: number;
  redirectUrl?: string;
}

/**
 * Server Action for Parent WhatsApp Phone + 6-digit PIN login.
 */
export async function parentLoginAction(
  phone: string,
  pin: string
): Promise<ParentLoginResult> {
  const normalizedPhone = normalizeIndoPhone(phone);

  if (!normalizedPhone || !isValidIndoPhone(normalizedPhone)) {
    return {
      success: false,
      error: 'Nomor WhatsApp tidak valid. Format harus nomor Indonesia (contoh: 081290000001).',
    };
  }

  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin || cleanPin.length < 6) {
    return {
      success: false,
      error: 'PIN harus terdiri dari minimal 6 digit.',
    };
  }

  // 1. Rate limit check
  const rateLimitStatus = checkPinRateLimit(normalizedPhone);
  if (!rateLimitStatus.isAllowed) {
    return {
      success: false,
      error: `Akun terkunci sementara karena terlalu banyak percobaan salah. Coba lagi dalam ${rateLimitStatus.lockoutRemainingMinutes || 15} menit.`,
      remainingAttempts: 0,
      lockoutRemainingMinutes: rateLimitStatus.lockoutRemainingMinutes || 15,
    };
  }

  // 2. Query parent by phone_wa
  const parent = await db.parent.findUnique({
    where: { phoneWa: normalizedPhone },
    include: {
      user: true,
      studentLinks: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!parent || !parent.user || !parent.user.isActive) {
    const failure = recordFailedPinAttempt(normalizedPhone);
    if (failure.isLocked) {
      return {
        success: false,
        error:
          'Nomor atau PIN tidak sesuai. Akun terkunci sementara selama 15 menit.',
        remainingAttempts: 0,
        lockoutRemainingMinutes: 15,
      };
    }
    return {
      success: false,
      error: `Nomor atau PIN salah. Sisa percobaan: ${failure.remainingAttempts} kali.`,
      remainingAttempts: failure.remainingAttempts,
    };
  }

  // 3. Verify PIN against user passwordHash
  const isPinValid = verifyPin(cleanPin, parent.user.passwordHash);
  if (!isPinValid) {
    const failure = recordFailedPinAttempt(normalizedPhone);
    if (failure.isLocked) {
      return {
        success: false,
        error:
          'PIN salah 5 kali berturut-turut. Akun terkunci sementara selama 15 menit untuk keamanan.',
        remainingAttempts: 0,
        lockoutRemainingMinutes: 15,
      };
    }
    return {
      success: false,
      error: `PIN tidak sesuai. Sisa percobaan: ${failure.remainingAttempts} kali sebelum akun terkunci 15 menit.`,
      remainingAttempts: failure.remainingAttempts,
    };
  }

  // 4. Success: Reset rate limit
  resetPinRateLimit(normalizedPhone);

  // 5. Create HMAC signed session token and set cookie
  const sessionToken = createParentSessionToken({
    userId: parent.userId,
    parentId: parent.id,
    phoneWa: parent.phoneWa,
    fullName: parent.fullName,
    role: 'PARENT',
  });

  await setParentSessionCookie(sessionToken);

  // 6. Set active student cookie to the first linked active student
  const activeStudent = parent.studentLinks.find(
    (l) => l.student.status === 'ACTIVE'
  );
  if (activeStudent) {
    await setActiveStudentCookie(activeStudent.studentId);
  }

  return {
    success: true,
    redirectUrl: '/parent-dashboard',
  };
}

/**
 * Server Action for Parent Logout.
 */
export async function parentLogoutAction(): Promise<{ success: boolean; redirectUrl: string }> {
  await clearParentSessionCookie();
  return {
    success: true,
    redirectUrl: '/login',
  };
}

/**
 * Server Action for setting active student context.
 * Strictly verifies that the student is linked to the authenticated parent.
 */
export async function setActiveStudentCookieAction(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getParentSession();
  if (!session) {
    return { success: false, error: 'Sesi orang tua telah berakhir. Silakan login kembali.' };
  }

  const link = await db.parentStudentLink.findFirst({
    where: {
      parentId: session.parentId,
      studentId: studentId,
    },
  });

  if (!link) {
    return { success: false, error: 'Siswa tidak terdaftar dalam akun orang tua ini.' };
  }

  await setActiveStudentCookie(studentId);
  return { success: true };
}

/**
 * Retrieves the current verified parent session.
 */
export async function getParentSessionAction(): Promise<ParentSessionPayload | null> {
  return getParentSession();
}
