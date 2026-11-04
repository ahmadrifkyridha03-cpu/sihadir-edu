/**
 * Standalone TypeScript Runner for Milestone 5 Core Algorithmic Logic.
 * Run directly via: npx tsx tests/test_milestone_5_runner.ts
 */

import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  resolveSpintax,
  interpolateVariables,
  formatWaMessage,
  calculateRandomJitterMs,
  getPriorityWeight,
  MockGatewayClient,
  TEMPLATE_GATE_LATE,
  TEMPLATE_ABSENT_BOLOS,
} from '../src/lib/whatsapp';
import {
  isSchoolDay,
  isNationalHoliday,
  calculateEffectiveSchoolDays,
} from '../src/lib/analytics/holidays';
import { generateSignedQrToken, verifySignedQrToken } from '../src/lib/qr-token';
import { generateFullExcelWorkbook } from '../src/lib/export/excel-export';
import { generateCr80QrCardsPdf } from '../src/lib/export/qr-card-export';
import { generateAttendanceMatrixPdf } from '../src/lib/export/pdf-export';
import { WaNotifType } from '@prisma/client';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runM5LogicTests() {
  console.log('================================================================');
  console.log('RUNNING MILESTONE 5 TSX RUNTIME LOGIC VERIFICATION');
  console.log('================================================================\n');

  // 1. Phone Normalizer Tests
  console.log('--- 1. Testing Indonesian Phone Normalization ---');
  assert(normalizeIndonesianPhone('0812-3456-7890') === '6281234567890', '0812 prefix to 62812');
  assert(normalizeIndonesianPhone('+62 812 3456 7890') === '6281234567890', '+62 prefix to 628');
  assert(normalizeIndonesianPhone('81234567890') === '6281234567890', '8 prefix to 628');
  assert(isValidIndonesianPhone('081234567890') === true, 'Valid Indonesian phone');
  assert(isValidIndonesianPhone('0211234567') === false, 'Invalid landline phone');
  console.log('✅ Phone normalization passed.\n');

  // 2. Spintax & Variable Interpolation Tests
  console.log('--- 2. Testing Spintax & Template Engine ---');
  const spintaxTemplate = '{Assalamu\'alaikum|Selamat Pagi|Halo} Bapak/Ibu {A|{B|C}}';
  const resolvedSample = resolveSpintax(spintaxTemplate, () => 0.0);
  assert(resolvedSample.startsWith("Assalamu'alaikum Bapak/Ibu A"), 'Deterministic innermost spintax');

  const nestedSpintax = '{Salam {hangat|sejahtera}|Selamat {pagi|siang}}';
  const nestedResolved = resolveSpintax(nestedSpintax, () => 0.99);
  assert(nestedResolved === 'Selamat siang', 'Nested Spintax resolves outwards correctly');

  const variables = {
    student_name: 'Budi Santoso',
    class: 'X-IPA-1',
    time: '07:25 WIB',
    late_minutes: 10,
    parent_name: 'Bpk. Hendra',
    school_name: 'SMA Negeri 1 Harapan Bangsa',
    portal_link: 'https://sihadir.sch.id',
  };
  const formattedMsg = formatWaMessage(TEMPLATE_GATE_LATE, variables, () => 0.5);
  assert(formattedMsg.includes('Budi Santoso'), 'Contains interpolated student name');
  assert(formattedMsg.includes('X-IPA-1'), 'Contains interpolated class name');
  assert(formattedMsg.includes('+10 menit'), 'Contains interpolated late minutes');
  console.log('✅ Spintax & template engine passed.\n');

  // 3. Priority Queue & Jitter Tests
  console.log('--- 3. Testing Priority Hierarchy & Jitter ---');
  assert(getPriorityWeight(WaNotifType.GATE_LATE) === 1, 'GATE_LATE is Tier 1 Urgent');
  assert(getPriorityWeight(WaNotifType.ABSENT_ALERT) === 1, 'ABSENT_ALERT is Tier 1 Urgent');
  assert(getPriorityWeight(WaNotifType.GATE_IN) === 2, 'GATE_IN is Tier 2 Normal');
  assert(getPriorityWeight(WaNotifType.DAILY_DIGEST) === 2, 'DAILY_DIGEST is Tier 2 Normal');

  const jitter = calculateRandomJitterMs(4, 10, () => 0.5);
  assert(jitter >= 4000 && jitter <= 10000, `Jitter within bounds: ${jitter}ms`);
  console.log('✅ Priority hierarchy & jitter passed.\n');

  // 4. Mock Gateway Client Tests
  console.log('--- 4. Testing Mock WhatsApp Gateway Client ---');
  MockGatewayClient.clear();
  const mockClient = new MockGatewayClient();
  const sendRes = await mockClient.sendMessage({
    targetPhone: '081234567890',
    message: formattedMsg,
    notifType: WaNotifType.GATE_LATE,
  });
  assert(sendRes.success === true, 'Mock message sent successfully');
  assert(sendRes.provider === 'MOCK', 'Provider is MOCK');
  assert(MockGatewayClient.getSentMessages().length === 1, 'Sent message recorded in ledger');
  assert(MockGatewayClient.getLastMessage()?.targetPhone === '6281234567890', 'Normalized in ledger');
  console.log('✅ Mock gateway client passed.\n');

  // 5. Effective Days & Calendar Logic Tests
  console.log('--- 5. Testing Indonesian School Calendar & Effective Days ---');
  const indepDay = isNationalHoliday('2026-08-17');
  assert(indepDay.isHoliday === true, '2026-08-17 is Independence Day');
  assert(indepDay.description === 'Hari Kemerdekaan Republik Indonesia', 'Accurate holiday description');

  // Sunday is not a school day
  assert(isSchoolDay('2026-11-01', 5) === false, 'Sunday (2026-11-01) is not a school day');
  // Saturday in 5-day week is not a school day
  assert(isSchoolDay('2026-11-07', 5) === false, 'Saturday in 5-day week is not a school day');
  // Saturday in 6-day week is a school day
  assert(isSchoolDay('2026-11-07', 6) === true, 'Saturday in 6-day week is a school day');

  // Elapsed vs Total effective days (Crucial Mid-Month Invariant)
  // November 2026 has 30 days. Let's test evaluating on November 10, 2026.
  const effDays = calculateEffectiveSchoolDays(
    '2026-11-01',
    '2026-11-30',
    '2026-11-10',
    5
  );
  assert(effDays.totalEffectiveDays === 21, `Total effective school days in Nov 2026: ${effDays.totalEffectiveDays}`);
  assert(effDays.elapsedEffectiveDays === 7, `Elapsed effective school days up to Nov 10: ${effDays.elapsedEffectiveDays}`);
  // If student is present all 7 elapsed days, rate must be 100%, not 7/21 = 33.3%
  const studentPresent = 7;
  const attendanceRate = Math.round((studentPresent / effDays.elapsedEffectiveDays) * 1000) / 10;
  assert(attendanceRate === 100.0, 'Attendance rate correctly evaluates to 100% mid-month');
  console.log('✅ Calendar & effective days passed.\n');

  // 6. Cryptographic QR Token Verification
  console.log('--- 6. Testing Cryptographic QR Token Integration ---');
  const studentId = 'std26101';
  const qrToken = generateSignedQrToken(studentId);
  assert(qrToken.startsWith('SHD.std26101.'), `Generated token: ${qrToken}`);
  const verified = verifySignedQrToken(qrToken);
  assert(verified.isValid === true, 'QR Token verifies correctly');
  assert(verified.studentIdentifier === 'std26101', 'Identifier decoded correctly');

  // Tampering detection
  const tampered = qrToken.slice(0, -1) + (qrToken.endsWith('a') ? 'b' : 'a');
  assert(verifySignedQrToken(tampered).isValid === false, 'Tampered token rejected');
  console.log('✅ Cryptographic QR token passed.\n');

  // 7. ExcelJS Multi-Worksheet Export Test
  console.log('--- 7. Testing ExcelJS Workbook Generation ---');
  const mockMatrixResult = {
    classInfo: {
      id: 'class-1',
      className: 'X-IPA-1',
      gradeLevel: 10,
      homeroomTeacher: { id: 't-1', fullName: 'Dra. Hj. Siti Nurhaliza, M.Pd.', nip: '19780512 200312 2 001' },
      academicYear: { id: 'ay-1', yearName: '2026/2027', semester: 1 },
    },
    period: {
      type: 'MONTHLY' as const,
      label: 'Bulan November 2026',
      year: 2026,
      month: 11,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      totalEffectiveDays: 21,
      elapsedEffectiveDays: 21,
    },
    days: [
      { date: '2026-11-02', dayNumber: 2, dayOfWeek: 1, dayName: 'Sen', isEffective: true, isElapsed: true, isHoliday: false },
      { date: '2026-11-03', dayNumber: 3, dayOfWeek: 2, dayName: 'Sel', isEffective: true, isElapsed: true, isHoliday: false },
      { date: '2026-11-04', dayNumber: 4, dayOfWeek: 3, dayName: 'Rab', isEffective: true, isElapsed: true, isHoliday: false },
    ],
    students: [
      {
        studentId: 's-1',
        nis: '26101',
        nisn: '0081234567',
        fullName: 'Budi Santoso',
        gender: 'L' as const,
        classId: 'class-1',
        className: 'X-IPA-1',
        dailyStatuses: { '2026-11-02': 'H' as const, '2026-11-03': 'H' as const, '2026-11-04': 'T' as const },
        summary: {
          hadirCount: 2,
          terlambatCount: 1,
          sakitCount: 0,
          izinCount: 0,
          alpaCount: 0,
          bolosCount: 0,
          totalPresent: 3,
          totalAbsent: 0,
          attendanceRate: 100.0,
          unexcusedRate: 0.0,
        },
      },
    ],
    classStats: {
      totalStudents: 1,
      countLaki: 1,
      countPerempuan: 0,
      averageAttendanceRate: 100.0,
      genderStats: {
        laki: { count: 1, hadir: 2, terlambat: 1, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 100.0 },
        perempuan: { count: 0, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 100.0 },
      },
      dailyClassDistribution: [
        { date: '2026-11-02', dayNumber: 2, isEffective: true, hadir: 1, terlambat: 0, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 100.0 },
      ],
    },
  };

  const excelBuffer = await generateFullExcelWorkbook({
    monthlyMatrix: mockMatrixResult,
  });
  assert(excelBuffer.length > 5000, `Excel buffer size: ${excelBuffer.length} bytes`);
  // Verify PK header (ZIP format of xlsx)
  assert(excelBuffer[0] === 0x50 && excelBuffer[1] === 0x4b, 'Valid PK zip signature for XLSX');
  console.log('✅ ExcelJS workbook passed.\n');

  // 8. PDF Export & CR80 QR Cards Generation
  console.log('--- 8. Testing PDF Recap & CR80 Cards Imposition ---');
  const pdfBuffer = await generateAttendanceMatrixPdf(mockMatrixResult);
  assert(pdfBuffer.length > 1000, `PDF buffer size: ${pdfBuffer.length} bytes`);
  const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
  assert(pdfHeader.startsWith('%PDF-'), `PDF header: ${pdfHeader}`);

  const qrCardsBuffer = await generateCr80QrCardsPdf(
    [
      {
        id: 's-1',
        nis: '26101',
        nisn: '0081234567',
        fullName: 'Budi Santoso',
        className: 'X-IPA-1',
      },
    ],
    { layout: '10_CARDS' }
  );
  assert(qrCardsBuffer.length > 1000, `QR Cards PDF size: ${qrCardsBuffer.length} bytes`);
  assert(qrCardsBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'Valid PDF format for QR cards');
  console.log('✅ PDF recap & CR80 QR cards passed.\n');

  console.log('================================================================');
  console.log('TSX_ALL_M5_CORE_LOGIC_PASSED');
  console.log('================================================================');
}

runM5LogicTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
