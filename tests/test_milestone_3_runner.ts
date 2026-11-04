import { generateSignedQrToken, verifySignedQrToken, SCAN_COOLDOWN_SECONDS } from '../src/lib/qr-token';
import { getWibNow, normalizeDateOnly, getDayDateRangeUTC, formatWibTime, formatIndoDate } from '../src/lib/timezone';
import { resolveSpintax } from '../src/lib/notification-hooks';
import { getSchoolDaysInRange } from '../src/lib/leave';

// 1. QR Token Verification
const secret = 'kunci-rahasia-penandatangan-kartu-qr-siswa-2026';
const token = generateSignedQrToken('std26101', secret);
const validRes = verifySignedQrToken(token, secret);
if (!validRes.isValid || validRes.studentIdentifier !== 'std26101') {
  throw new Error(`Token validation failed: ${JSON.stringify(validRes)}`);
}

// Tampered token test
const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
const tamperedRes = verifySignedQrToken(tampered, secret);
if (tamperedRes.isValid || tamperedRes.error !== 'SIGNATURE_MISMATCH') {
  throw new Error(`Tampered token was not rejected: ${JSON.stringify(tamperedRes)}`);
}

// Malformed token test
const malformedRes = verifySignedQrToken('INVALID_TOKEN_STRING', secret);
if (malformedRes.isValid || malformedRes.error !== 'INVALID_FORMAT') {
  throw new Error(`Malformed token was not rejected: ${JSON.stringify(malformedRes)}`);
}

// Cooldown constant check
if (SCAN_COOLDOWN_SECONDS !== 300) {
  throw new Error(`SCAN_COOLDOWN_SECONDS expected 300, got ${SCAN_COOLDOWN_SECONDS}`);
}

// 2. Timezone & Temporal Accuracy
const wibNow = getWibNow(new Date('2026-11-04T00:30:00Z')); // 07:30 WIB
if (wibNow.hours !== 7 || wibNow.minutes !== 30 || wibNow.minutesFromMidnight !== 450) {
  throw new Error(`WIB calculation mismatch: ${JSON.stringify(wibNow)}`);
}

const normDate = normalizeDateOnly('2026-11-04');
if (normDate.toISOString() !== '2026-11-04T00:00:00.000Z') {
  throw new Error(`Normalized date expected 2026-11-04T00:00:00.000Z, got ${normDate.toISOString()}`);
}

// 3. School Days Range (Sunday Exclusion)
// 2026-11-06 (Fri) to 2026-11-09 (Mon) -> Fri, Sat, Mon (skip Sun 2026-11-08)
const fri = new Date(Date.UTC(2026, 10, 6));
const mon = new Date(Date.UTC(2026, 10, 9));
const schoolDays = getSchoolDaysInRange(fri, mon);
if (schoolDays.length !== 3) {
  throw new Error(`Expected 3 school days (excluding Sunday), got ${schoolDays.length}`);
}

// 4. Spintax Resolution
const template = "{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu";
const resolved = resolveSpintax(template);
const validGreetings = ["Assalamu'alaikum Bapak/Ibu", "Selamat Pagi Bapak/Ibu", "Halo Bapak/Ibu"];
if (!validGreetings.includes(resolved)) {
  throw new Error(`Spintax failed: got '${resolved}'`);
}

console.log('TSX_ALL_CORE_LOGIC_PASSED');
