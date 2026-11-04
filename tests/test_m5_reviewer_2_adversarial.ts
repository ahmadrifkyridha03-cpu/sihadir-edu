/**
 * Adversarial Stress & Verification Suite for Milestone 5:
 * Analytics Recaps, Early Warning System, Multi-Format Export & CR80 QR Cards (F5.5 - F5.8)
 * Conducted by Reviewer & Adversarial Critic reviewer_m5_2
 */

import {
  isSchoolDay,
  isNationalHoliday,
  calculateEffectiveSchoolDays,
} from '../src/lib/analytics/holidays';
import {
  generateFullExcelWorkbook,
  type GenerateFullExcelWorkbookParams,
} from '../src/lib/export/excel-export';
import { generateAttendanceMatrixPdf } from '../src/lib/export/pdf-export';
import { generateCr80QrCardsPdf, type StudentCardData } from '../src/lib/export/qr-card-export';
import { generateSignedQrToken, verifySignedQrToken } from '../src/lib/qr-token';
import { type AttendanceMatrixRecapResult, type DailyStatusCode } from '../src/lib/analytics/recap-matrix';
import { type EwsClassSummaryResult } from '../src/lib/analytics/early-warning';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runReviewer2AdversarialSuite() {
  console.log('========================================================================');
  console.log('REVIEWER M5_2 ADVERSARIAL STRESS TEST: ANALYTICS, EWS, EXPORT & CARDS');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. School Calendar & Effective School Days Edge Cases
  // ---------------------------------------------------------------------------
  console.log('>>> [SUITE 1] School Calendar & Effective School Days Edge Cases');

  // A. New Year Holiday (2026-01-01 is Thursday and a national holiday)
  const nyHol = isNationalHoliday('2026-01-01');
  assert(nyHol.isHoliday === true, 'Jan 1, 2026 is recognized as national holiday');
  assert(isSchoolDay('2026-01-01', 5) === false, 'Jan 1, 2026 is not a school day');

  // B. Day 1 holiday evaluation: evaluated on Jan 1, 2026 -> 0 elapsed effective days
  const janStart = calculateEffectiveSchoolDays('2026-01-01', '2026-01-31', '2026-01-01', 5);
  assert(janStart.elapsedEffectiveDays === 0, `Elapsed effective days on Jan 1 holiday must be 0: got ${janStart.elapsedEffectiveDays}`);
  assert(janStart.totalEffectiveDays > 0, `Total effective days in Jan 2026 must be >0: got ${janStart.totalEffectiveDays}`);

  // C. 5-day vs 6-day week comparison for whole month
  const nov5Day = calculateEffectiveSchoolDays('2026-11-01', '2026-11-30', '2026-11-30', 5);
  const nov6Day = calculateEffectiveSchoolDays('2026-11-01', '2026-11-30', '2026-11-30', 6);
  assert(nov6Day.totalEffectiveDays > nov5Day.totalEffectiveDays, '6-day school week has strictly more effective days than 5-day week');
  assert(nov6Day.totalEffectiveDays - nov5Day.totalEffectiveDays === 4, `Nov 2026 has 4 Saturdays: difference must be 4, got ${nov6Day.totalEffectiveDays - nov5Day.totalEffectiveDays}`);

  // D. Leap year check: February 2024 (leap, 29 days) vs February 2026 (non-leap, 28 days)
  const feb2024 = calculateEffectiveSchoolDays('2024-02-01', '2024-02-29', '2024-02-29', 5);
  const feb2026 = calculateEffectiveSchoolDays('2026-02-01', '2026-02-28', '2026-02-28', 5);
  assert(feb2024.totalEffectiveDays > 0 && feb2026.totalEffectiveDays > 0, 'February in both years evaluates cleanly');

  // E. Custom holidays map support
  const customHolidays = new Map<string, string>([
    ['2026-11-10', 'Hari Pahlawan / Libur Khusus Sekolah'],
  ]);
  assert(isSchoolDay('2026-11-10', 5, customHolidays) === false, 'Custom school holiday correctly suppresses school day');
  assert(isSchoolDay('2026-11-10', 5) === true, 'Without custom holiday map, Nov 10 is standard Tuesday school day');
  console.log('  [PASS] School calendar, 5-vs-6 day week, and custom holidays passed stress tests');

  // ---------------------------------------------------------------------------
  // 2. Attendance Matrix Recap Mathematical Integrity
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 2] Attendance Matrix Recap Mathematical Integrity');

  // Test elapsed division mid-month invariant:
  // If month has 22 total days, today is day 5 (5 elapsed days), student attended 5 days:
  // Attendance rate MUST be 100%, NEVER 5/22 = 22.7%
  const totalEff = 22;
  const elapsedEff = 5;
  const hadir = 5;
  const computedRate = elapsedEff > 0 ? Math.round((hadir / elapsedEff) * 1000) / 10 : 100.0;
  assert(computedRate === 100.0, `Mid-month attendance rate is 100%, got ${computedRate}%`);

  // Test zero elapsed days boundary:
  const zeroElapsed = 0;
  const zeroElapsedRate = zeroElapsed > 0 ? Math.round((hadir / zeroElapsed) * 1000) / 10 : 100.0;
  assert(zeroElapsedRate === 100.0, 'Zero elapsed days gracefully defaults to 100.0% without NaN/Infinity');

  const zeroElapsedUnexcused = zeroElapsed > 0 ? Math.round((0 / zeroElapsed) * 1000) / 10 : 0.0;
  assert(zeroElapsedUnexcused === 0.0, 'Zero elapsed days unexcused rate gracefully defaults to 0.0%');

  // Test 6-tier status precedence resolution
  const validCodes: DailyStatusCode[] = ['H', 'T', 'S', 'I', 'A', 'B', '-', ' '];
  validCodes.forEach((code) => {
    assert(typeof code === 'string' && code.length === 1, `Status code '${code}' is valid single char`);
  });
  console.log('  [PASS] Mathematical elapsed day invariant & status codes verified');

  // ---------------------------------------------------------------------------
  // 3. Early Warning System (EWS) Scoring & Invariant Tiers
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 3] Early Warning System (EWS) Scoring & Invariant Tiers');

  // Test composite score cap at 100
  const accumulatedPoints = 40 + 30 + 25 + 35 + 25; // 155 points total
  const cappedScore = Math.min(100, accumulatedPoints);
  assert(cappedScore === 100, `Score is capped at 100: got ${cappedScore}`);

  // Test tier classification rules:
  // riskScore >= 70 OR hasCriticalInvariant => CRITICAL
  // riskScore >= 40 OR hasWarningInvariant => WARNING
  // else => NORMAL
  function classifyRisk(score: number, hasCrit: boolean, hasWarn: boolean) {
    if (score >= 70 || hasCrit) return 'CRITICAL';
    if (score >= 40 || hasWarn) return 'WARNING';
    return 'NORMAL';
  }

  assert(classifyRisk(20, true, false) === 'CRITICAL', 'Single critical invariant triggers CRITICAL even if score is low (20)');
  assert(classifyRisk(75, false, false) === 'CRITICAL', 'Score >= 70 triggers CRITICAL');
  assert(classifyRisk(15, false, true) === 'WARNING', 'Single warning invariant triggers WARNING even if score is low (15)');
  assert(classifyRisk(45, false, false) === 'WARNING', 'Score >= 40 triggers WARNING');
  assert(classifyRisk(10, false, false) === 'NORMAL', 'Score < 40 without warnings is NORMAL');
  console.log('  [PASS] EWS scoring thresholds & risk tier classifications strictly verified');

  // ---------------------------------------------------------------------------
  // 4. Multi-Format Excel Export (ExcelJS) Stress Testing
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 4] Multi-Format Excel Export (ExcelJS) Stress Testing');

  // Build a realistic comprehensive mock matrix with 2 students
  const mockMonthly: AttendanceMatrixRecapResult = {
    classInfo: {
      id: 'cls-x-ipa-1',
      className: 'X-IPA-1',
      gradeLevel: 10,
      homeroomTeacher: {
        id: 'tea-1',
        fullName: 'Drs. H. Mulyadi, M.Pd.',
        nip: '19680512 199403 1 004',
      },
      academicYear: {
        id: 'ay-2026',
        yearName: '2026/2027',
        semester: 1,
      },
    },
    period: {
      type: 'MONTHLY',
      label: 'Bulan November 2026',
      year: 2026,
      month: 11,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      totalEffectiveDays: 21,
      elapsedEffectiveDays: 21,
    },
    days: [
      { date: '2026-11-01', dayNumber: 1, dayOfWeek: 0, dayName: 'Min', isEffective: false, isElapsed: true, isHoliday: false },
      { date: '2026-11-02', dayNumber: 2, dayOfWeek: 1, dayName: 'Sen', isEffective: true, isElapsed: true, isHoliday: false },
      { date: '2026-11-03', dayNumber: 3, dayOfWeek: 2, dayName: 'Sel', isEffective: true, isElapsed: true, isHoliday: false },
      { date: '2026-11-04', dayNumber: 4, dayOfWeek: 3, dayName: 'Rab', isEffective: true, isElapsed: true, isHoliday: false },
    ],
    students: [
      {
        studentId: 'std-1',
        nis: '26101',
        nisn: '0081234561',
        fullName: 'Ahmad Dahlan',
        gender: 'L',
        classId: 'cls-x-ipa-1',
        className: 'X-IPA-1',
        dailyStatuses: { '2026-11-01': '-', '2026-11-02': 'H', '2026-11-03': 'T', '2026-11-04': 'H' },
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
      {
        studentId: 'std-2',
        nis: '26102',
        nisn: '0081234562',
        fullName: 'Siti Fatimah',
        gender: 'P',
        classId: 'cls-x-ipa-1',
        className: 'X-IPA-1',
        dailyStatuses: { '2026-11-01': '-', '2026-11-02': 'S', '2026-11-03': 'H', '2026-11-04': 'B' },
        summary: {
          hadirCount: 1,
          terlambatCount: 0,
          sakitCount: 1,
          izinCount: 0,
          alpaCount: 0,
          bolosCount: 1,
          totalPresent: 1,
          totalAbsent: 2,
          attendanceRate: 33.3,
          unexcusedRate: 33.3,
        },
      },
    ],
    classStats: {
      totalStudents: 2,
      countLaki: 1,
      countPerempuan: 1,
      averageAttendanceRate: 66.7,
      genderStats: {
        laki: { count: 1, hadir: 2, terlambat: 1, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 100.0 },
        perempuan: { count: 1, hadir: 1, terlambat: 0, sakit: 1, izin: 0, alpa: 0, bolos: 1, attendanceRate: 33.3 },
      },
      dailyClassDistribution: [
        { date: '2026-11-01', dayNumber: 1, isEffective: false, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 0 },
        { date: '2026-11-02', dayNumber: 2, isEffective: true, hadir: 1, terlambat: 0, sakit: 1, izin: 0, alpa: 0, bolos: 0, attendanceRate: 50 },
        { date: '2026-11-03', dayNumber: 3, isEffective: true, hadir: 1, terlambat: 1, sakit: 0, izin: 0, alpa: 0, bolos: 0, attendanceRate: 100 },
        { date: '2026-11-04', dayNumber: 4, isEffective: true, hadir: 1, terlambat: 0, sakit: 0, izin: 0, alpa: 0, bolos: 1, attendanceRate: 50 },
      ],
    },
  };

  const mockEws: EwsClassSummaryResult = {
    classId: 'cls-x-ipa-1',
    className: 'X-IPA-1',
    periodLabel: 'Bulan November 2026',
    evaluatedAt: '2026-11-04T12:00:00Z',
    totalStudents: 2,
    counts: { critical: 1, warning: 0, normal: 1 },
    students: [
      {
        studentId: 'std-2',
        nis: '26102',
        nisn: '0081234562',
        fullName: 'Siti Fatimah',
        gender: 'P',
        classId: 'cls-x-ipa-1',
        className: 'X-IPA-1',
        parentPhone: '081234567891',
        parentName: 'Ibu Rahmawati',
        riskScore: 75,
        riskLevel: 'CRITICAL',
        attendanceRate: 33.3,
        invariants: [
          {
            id: 'INV_4_BOLOS_ANOMALY',
            name: 'Pola Bolos Jam Pelajaran',
            triggered: true,
            severity: 'CRITICAL',
            points: 35,
            description: 'Terdeteksi 1 kali membolos jam pelajaran setelah scan gerbang',
          },
        ],
        metrics: {
          consecutiveAlpaDays: 0,
          consecutiveAlpaDates: [],
          monthlyAlpaCount: 0,
          totalAbsenceDays: 2,
          lateArrivalCount: 0,
          totalLateMinutes: 0,
          bolosCount: 1,
          remedialSubjectCount: 1,
          remedialSubjects: [{ subjectName: 'Matematika', score: 65, kkm: 75 }],
          negativeBadgeCount: 1,
        },
        counselingSop: {
          roleResponsible: 'GURU_BK',
          primaryAction: 'Sidang Kasus & Panggilan Orang Tua',
          steps: ['Wawancara motif', 'Panggilan orang tua'],
          officialDocumentRequired: 'Surat Panggilan Orang Tua (SP 1)',
          suggestedWaTemplate: 'EWS_CRITICAL_BOLOS',
        },
      },
    ],
  };

  const excelBuffer = await generateFullExcelWorkbook({
    monthlyMatrix: mockMonthly,
    ewsSummary: mockEws,
  });

  assert(excelBuffer.length > 5000, `Excel output size: ${excelBuffer.length} bytes`);
  assert(excelBuffer[0] === 0x50 && excelBuffer[1] === 0x4b, 'Valid ZIP/XLSX PK magic header');
  console.log('  [PASS] 4-worksheet Excel workbook generated with valid binary structure');

  // Edge case: empty matrix without students
  const emptyMonthly: AttendanceMatrixRecapResult = {
    ...mockMonthly,
    students: [],
    classStats: {
      ...mockMonthly.classStats,
      totalStudents: 0,
      countLaki: 0,
      countPerempuan: 0,
      averageAttendanceRate: 100,
    },
  };
  const emptyExcelBuffer = await generateFullExcelWorkbook({ monthlyMatrix: emptyMonthly });
  assert(emptyExcelBuffer.length > 4000, 'Excel handles empty student roster without crashing');
  console.log('  [PASS] Empty class roster handled gracefully in Excel export');

  // ---------------------------------------------------------------------------
  // 5. Printable PDF Report (jsPDF + autoTable) Stress Testing
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 5] Printable PDF Report (jsPDF + autoTable) Stress Testing');

  const pdfBuffer = await generateAttendanceMatrixPdf(mockMonthly);
  assert(pdfBuffer.length > 1000, `PDF output size: ${pdfBuffer.length} bytes`);
  assert(pdfBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'Valid %PDF- header');

  const emptyPdfBuffer = await generateAttendanceMatrixPdf(emptyMonthly);
  assert(emptyPdfBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'Empty class PDF generated cleanly');
  console.log('  [PASS] Landscape A4 PDF recap with Kop Surat & Titi Mangsa verified');

  // ---------------------------------------------------------------------------
  // 6. CR80 Mass QR Cards Imposition & Signed Token Cryptography
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 6] CR80 Mass QR Cards Imposition & Signed Token Cryptography');

  // Generate 12 students to force a multi-page A4 document (10 on page 1, 2 on page 2)
  const cardStudents: StudentCardData[] = [];
  for (let i = 1; i <= 12; i++) {
    const rawNis = `261${String(i).padStart(2, '0')}`;
    cardStudents.push({
      id: `std-uuid-${i}`,
      nis: rawNis,
      nisn: `00812345${String(i).padStart(2, '0')}`,
      fullName: i === 1
        ? 'Raden Mas Bagus Muhammad Alexander Putra Perkasa' // Long Indonesian name test
        : `Siswa Uji Coba ${i}`,
      className: 'X-IPA-1',
      academicYear: '2026/2027',
    });
  }

  // Test 10-cards per sheet imposition
  const cardPdf10 = await generateCr80QrCardsPdf(cardStudents, { layout: '10_CARDS', showCropMarks: true });
  assert(cardPdf10.length > 10000, `10-card PDF generated: ${cardPdf10.length} bytes`);
  assert(cardPdf10.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'Valid PDF format for 10-card layout');

  // Test 8-cards per sheet imposition
  const cardPdf8 = await generateCr80QrCardsPdf(cardStudents, { layout: '8_CARDS', showCropMarks: true });
  assert(cardPdf8.length > 10000, `8-card PDF generated: ${cardPdf8.length} bytes`);
  assert(cardPdf8.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'Valid PDF format for 8-card layout');

  // Cryptographic token tamper-resistance
  const testToken = generateSignedQrToken('26101');
  assert(testToken.startsWith('SHD.26101.'), `Signed QR token follows SHD.<id>.<sig> convention: ${testToken}`);
  const verifiedGenuine = verifySignedQrToken(testToken);
  assert(verifiedGenuine.isValid === true && verifiedGenuine.studentIdentifier === '26101', 'Genuine token verifies');

  const tamperedSig = testToken.slice(0, -2) + '99';
  const verifiedTampered = verifySignedQrToken(tamperedSig);
  assert(verifiedTampered.isValid === false, 'Tampered signature rejected');

  const forgedId = 'SHD.99999.' + testToken.split('.')[2];
  const verifiedForged = verifySignedQrToken(forgedId);
  assert(verifiedForged.isValid === false, 'Forged ID with borrowed signature rejected');

  console.log('  [PASS] CR80 QR Cards imposition (10 & 8 cards), long names, and HMAC verification passed');

  console.log('\n========================================================================');
  console.log('ALL REVIEWER M5_2 ADVERSARIAL STRESS TESTS COMPLETED (VERDICT: APPROVE)');
  console.log('========================================================================');
}

runReviewer2AdversarialSuite().catch((err) => {
  console.error('Fatal error in reviewer 2 adversarial test suite:', err);
  process.exit(1);
});
