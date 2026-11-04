import * as crypto from 'node:crypto';

export interface TokenValidationSuccess {
  isValid: true;
  studentIdentifier: string;
  token: string;
}

export interface TokenValidationFailure {
  isValid: false;
  error:
    | 'EMPTY_TOKEN'
    | 'INVALID_FORMAT'
    | 'INVALID_IDENTIFIER'
    | 'INVALID_SIGNATURE'
    | 'SIGNATURE_MISMATCH'
    | 'MISSING_SECRET';
  message: string;
}

export type TokenValidationResult = TokenValidationSuccess | TokenValidationFailure;

export const DEFAULT_QR_SIGNING_SECRET =
  'kunci-rahasia-penandatangan-kartu-qr-siswa-2026';

export const SCAN_COOLDOWN_SECONDS = 300;

/**
 * Generates an HMAC-SHA256 signed QR token for a student identifier:
 * Format: `SHD.<studentIdentifier>.<signature_8char>`
 *
 * @param studentIdentifier - Student short ID, NIS, or slug (e.g. "std26101" or "26101")
 * @param secret - Cryptographic secret key
 */
export function generateSignedQrToken(
  studentIdentifier: string,
  secret: string = process.env.QR_SIGNING_SECRET || DEFAULT_QR_SIGNING_SECRET
): string {
  if (!studentIdentifier || typeof studentIdentifier !== 'string') {
    throw new Error('studentIdentifier must be a non-empty string');
  }
  const cleanId = studentIdentifier.trim();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(cleanId);
  const signature = hmac.digest('hex').substring(0, 8);
  return `SHD.${cleanId}.${signature}`;
}

/**
 * Validates a signed QR token using constant-time HMAC comparison.
 * Zero database queries are executed for forged or malformed tokens.
 *
 * @param rawToken - Raw scanned string (e.g. from camera or barcode scanner)
 * @param secret - Cryptographic secret key
 */
export function verifySignedQrToken(
  rawToken: string,
  secret: string = process.env.QR_SIGNING_SECRET || DEFAULT_QR_SIGNING_SECRET
): TokenValidationResult {
  if (!rawToken || typeof rawToken !== 'string') {
    return {
      isValid: false,
      error: 'EMPTY_TOKEN',
      message: 'Token QR tidak boleh kosong',
    };
  }

  const token = rawToken.trim();
  const parts = token.split('.');

  // Format check: Exactly 3 segments: SHD.<identifier>.<signature>
  if (parts.length !== 3 || parts[0] !== 'SHD') {
    return {
      isValid: false,
      error: 'INVALID_FORMAT',
      message: 'Format QR Code tidak valid (wajib format: SHD.<id>.<signature>)',
    };
  }

  const [, studentIdentifier, receivedSignature] = parts;

  // Student identifier validation (alphanumeric and dashes, min length 3)
  if (!studentIdentifier || !/^[a-zA-Z0-9-]+$/.test(studentIdentifier) || studentIdentifier.length < 3) {
    return {
      isValid: false,
      error: 'INVALID_IDENTIFIER',
      message: 'ID Siswa pada token QR tidak valid',
    };
  }

  // Signature check: must be exactly 8 hex characters
  if (!/^[0-9a-fA-F]{8}$/.test(receivedSignature)) {
    return {
      isValid: false,
      error: 'INVALID_SIGNATURE',
      message: 'Format tanda tangan digital tidak valid (wajib 8 digit heksadesimal)',
    };
  }

  // Compute expected HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(studentIdentifier);
  const expectedSignature = hmac.digest('hex').substring(0, 8);

  // Constant-time comparison to prevent side-channel timing attacks
  const receivedBuf = Buffer.from(receivedSignature.toLowerCase(), 'utf-8');
  const expectedBuf = Buffer.from(expectedSignature.toLowerCase(), 'utf-8');

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    return {
      isValid: false,
      error: 'SIGNATURE_MISMATCH',
      message:
        'Tanda tangan digital kartu tidak cocok! Kartu QR diduga palsu atau telah dimodifikasi.',
    };
  }

  return {
    isValid: true,
    studentIdentifier,
    token,
  };
}
