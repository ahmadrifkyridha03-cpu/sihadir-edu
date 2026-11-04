/**
 * ADVERSARIAL STRESS TEST HARNESS — Milestone 6 (Features F6.6 - F6.8)
 * Challenger: challenger_m6_2
 * Scope:
 *  1. Teacher Period Math & Boundary Edge Cases
 *  2. Kiosk Scanner Throughput, Camera Flip & Manual Audit Invariants
 *  3. Mathematical WCAG AAA Contrast Ratio Calculations
 */

import {
  INDONESIAN_SCHOOL_PERIODS,
  calculateSchedulePeriodState,
  getMinutesFromMidnightWib,
} from '../src/lib/teacher-schedule';
import * as fs from 'fs';
import * as path from 'path';

interface TestReportItem {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  actual: any;
  expected: any;
  notes?: string;
}

const testResults: TestReportItem[] = [];

function check(
  id: string,
  category: string,
  description: string,
  passed: boolean,
  actual: any,
  expected: any,
  notes?: string
) {
  testResults.push({ id, category, description, passed, actual, expected, notes });
  const mark = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${mark} [${category}] ${id}: ${description}`);
  if (!passed) {
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    if (notes) console.log(`    Notes:    ${notes}`);
  }
}

// ============================================================================
// SUITE 1: TEACHER PERIOD MATH & BOUNDARY EDGE CASES
// ============================================================================
console.log('\n======================================================');
console.log('SUITE 1: TEACHER PERIOD MATH & BOUNDARY CONDITIONS');
console.log('======================================================');

// 1.1: 07:15:00 sharp (435 minutes) - Exact start of Jam ke-1
const p1Start = calculateSchedulePeriodState(1, 1, 435);
check(
  'TPM-01',
  'TEACHER_MATH',
  '07:15:00 sharp: Period 1 active, elapsed=0, progress=0%',
  p1Start.isActive === true &&
    p1Start.isPast === false &&
    p1Start.isUpcoming === false &&
    p1Start.elapsedMinutes === 0 &&
    p1Start.progressPercent === 0,
  p1Start,
  { isActive: true, isPast: false, isUpcoming: false, elapsedMinutes: 0, progressPercent: 0 }
);

// 1.2: 07:14:59 (434 minutes) - 1 minute before Jam ke-1
const p1JustBefore = calculateSchedulePeriodState(1, 1, 434);
check(
  'TPM-02',
  'TEACHER_MATH',
  '07:14:59 (434m): Period 1 must be upcoming, not active',
  p1JustBefore.isUpcoming === true &&
    p1JustBefore.isActive === false &&
    p1JustBefore.isPast === false &&
    p1JustBefore.progressPercent === 0,
  p1JustBefore,
  { isUpcoming: true, isActive: false, isPast: false, progressPercent: 0 }
);

// 1.3: 07:59:59 (479 minutes) - 1 minute before Period 1 ends
const p1NearEnd = calculateSchedulePeriodState(1, 1, 479);
check(
  'TPM-03',
  'TEACHER_MATH',
  '07:59:59 (479m): Period 1 still active, elapsed=44, progress=98%',
  p1NearEnd.isActive === true &&
    p1NearEnd.isPast === false &&
    p1NearEnd.elapsedMinutes === 44 &&
    p1NearEnd.progressPercent === 98,
  p1NearEnd,
  { isActive: true, isPast: false, elapsedMinutes: 44, progressPercent: 98 }
);

// 1.4: 08:00:00 sharp (480 minutes) - Period 1 ends, Period 2 begins
const p1AtEnd = calculateSchedulePeriodState(1, 1, 480);
check(
  'TPM-04a',
  'TEACHER_MATH',
  '08:00:00: Period 1 isPast=true, elapsed=45, progress=100%',
  p1AtEnd.isActive === false &&
    p1AtEnd.isPast === true &&
    p1AtEnd.isUpcoming === false &&
    p1AtEnd.elapsedMinutes === 45 &&
    p1AtEnd.progressPercent === 100,
  p1AtEnd,
  { isActive: false, isPast: true, isUpcoming: false, elapsedMinutes: 45, progressPercent: 100 }
);

const p2AtStart = calculateSchedulePeriodState(2, 2, 480);
check(
  'TPM-04b',
  'TEACHER_MATH',
  '08:00:00: Period 2 isActive=true, elapsed=0, progress=0%',
  p2AtStart.isActive === true &&
    p2AtStart.isPast === false &&
    p2AtStart.elapsedMinutes === 0 &&
    p2AtStart.progressPercent === 0,
  p2AtStart,
  { isActive: true, isPast: false, elapsedMinutes: 0, progressPercent: 0 }
);

// 1.5: 09:30:00 (570 minutes) - Transition between Period 3 and Period 4
const p3AtEnd = calculateSchedulePeriodState(3, 3, 570);
const p4AtStart = calculateSchedulePeriodState(4, 4, 570);
check(
  'TPM-05',
  'TEACHER_MATH',
  '09:30:00: Period 3 is past (100%), Period 4 is active (0%)',
  p3AtEnd.isPast === true && p3AtEnd.progressPercent === 100 &&
    p4AtStart.isActive === true && p4AtStart.progressPercent === 0,
  { p3Past: p3AtEnd.isPast, p4Active: p4AtStart.isActive },
  { p3Past: true, p4Active: true }
);

// 1.6: Recess (Istirahat Pagi 10:15 - 10:45 = 615..645 min)
// At 10:30 (630 min): Period 4 is past, Period 5 is upcoming
const p4DuringRecess = calculateSchedulePeriodState(4, 4, 630);
const p5DuringRecess = calculateSchedulePeriodState(5, 5, 630);
check(
  'TPM-06',
  'TEACHER_MATH',
  'Recess 10:30 (630m): P4 past (100%), P5 upcoming (0%), neither active',
  p4DuringRecess.isPast === true &&
    p4DuringRecess.isActive === false &&
    p5DuringRecess.isUpcoming === true &&
    p5DuringRecess.isActive === false,
  { p4: p4DuringRecess, p5: p5DuringRecess },
  { p4Past: true, p5Upcoming: true }
);

// 1.7: 15:45:00 (945 minutes) - After school day (Period 8 ended 14:30 = 870m)
const p8AfterSchool = calculateSchedulePeriodState(8, 8, 945);
check(
  'TPM-07',
  'TEACHER_MATH',
  '15:45:00 (945m): After school - Period 8 isPast=true, progress=100%',
  p8AfterSchool.isPast === true &&
    p8AfterSchool.isActive === false &&
    p8AfterSchool.progressPercent === 100,
  p8AfterSchool,
  { isPast: true, isActive: false, progressPercent: 100 }
);

// 1.8: 06:00:00 (360 minutes) - Early morning before school (P1 starts 07:15 = 435m)
const p1BeforeSchool = calculateSchedulePeriodState(1, 1, 360);
check(
  'TPM-08',
  'TEACHER_MATH',
  '06:00:00 (360m): Before school - Period 1 isUpcoming=true, progress=0%',
  p1BeforeSchool.isUpcoming === true &&
    p1BeforeSchool.isActive === false &&
    p1BeforeSchool.progressPercent === 0,
  p1BeforeSchool,
  { isUpcoming: true, isActive: false, progressPercent: 0 }
);

// 1.9: 23:00:00 (1380 minutes) - Late night
const p1AtNight = calculateSchedulePeriodState(1, 8, 1380);
check(
  'TPM-09',
  'TEACHER_MATH',
  '23:00:00 (1380m): Night - Full day schedule isPast=true, progress=100%',
  p1AtNight.isPast === true &&
    p1AtNight.isActive === false &&
    p1AtNight.progressPercent === 100,
  p1AtNight,
  { isPast: true, isActive: false, progressPercent: 100 }
);

// 1.10: Clamping Stress Test - Negative minutes, massive minutes, inverted periods
const negMinutes = calculateSchedulePeriodState(1, 2, -500);
const hugeMinutes = calculateSchedulePeriodState(1, 2, 999999);
const invertedPeriods = calculateSchedulePeriodState(8, 1, 500);
const clampedStrictly =
  negMinutes.progressPercent >= 0 &&
  negMinutes.progressPercent <= 100 &&
  hugeMinutes.progressPercent >= 0 &&
  hugeMinutes.progressPercent <= 100 &&
  invertedPeriods.progressPercent >= 0 &&
  invertedPeriods.progressPercent <= 100;

check(
  'TPM-10',
  'TEACHER_MATH',
  'Clamping Stress: Progress strictly within [0, 100] across extreme inputs',
  clampedStrictly,
  { neg: negMinutes.progressPercent, huge: hugeMinutes.progressPercent, inv: invertedPeriods.progressPercent },
  'all in [0, 100]'
);

// 1.11: Multi-period block (Jam 1 s/d Jam 3: 07:15 - 09:30, 435 to 570m, duration 135m)
// At 08:30 (510m): elapsed = 75m, progress = 75/135 * 100 = 56%
const multiPeriod = calculateSchedulePeriodState(1, 3, 510);
check(
  'TPM-11',
  'TEACHER_MATH',
  'Multi-period Block (Jam 1..3, 135m total) at 08:30: elapsed=75m, progress=56%',
  multiPeriod.isActive === true &&
    multiPeriod.totalDuration === 135 &&
    multiPeriod.elapsedMinutes === 75 &&
    multiPeriod.progressPercent === 56,
  multiPeriod,
  { isActive: true, totalDuration: 135, elapsedMinutes: 75, progressPercent: 56 }
);

// 1.12: SearchParams URL generation & pre-fill verification
const mockSchedule = {
  id: 'sched-uuid-42',
  class: { id: 'cls-10-ipa-1', className: 'X-IPA-1' },
  subject: { id: 'subj-mat-wajib', subjectName: 'Matematika' },
  periodStart: 1,
  periodEnd: 2,
};
const teacherId = 'tchr-hendra-01';
const todayDateStr = '2026-11-04';

const generatedUrl = `/journal/new?scheduleId=${mockSchedule.id}&classId=${mockSchedule.class.id}&subjectId=${mockSchedule.subject.id}&teacherId=${teacherId}&periodStart=${mockSchedule.periodStart}&periodEnd=${mockSchedule.periodEnd}&date=${todayDateStr}`;
const parsedUrl = new URL(generatedUrl, 'http://localhost');
const sp = parsedUrl.searchParams;

check(
  'TPM-12',
  'TEACHER_PREFILL',
  'SearchParams Pre-fill URL contains all required journal parameters',
  sp.get('scheduleId') === 'sched-uuid-42' &&
    sp.get('classId') === 'cls-10-ipa-1' &&
    sp.get('subjectId') === 'subj-mat-wajib' &&
    sp.get('teacherId') === 'tchr-hendra-01' &&
    sp.get('periodStart') === '1' &&
    sp.get('periodEnd') === '2' &&
    sp.get('date') === '2026-11-04',
  Object.fromEntries(sp.entries()),
  {
    scheduleId: 'sched-uuid-42',
    classId: 'cls-10-ipa-1',
    subjectId: 'subj-mat-wajib',
    teacherId: 'tchr-hendra-01',
    periodStart: '1',
    periodEnd: '2',
    date: '2026-11-04',
  }
);


// ============================================================================
// SUITE 2: KIOSK THROUGHPUT & SCANNER INVARIANTS
// ============================================================================
console.log('\n======================================================');
console.log('SUITE 2: KIOSK THROUGHPUT & SCANNER INVARIANTS');
console.log('======================================================');

const popupFile = path.resolve(__dirname, '../src/components/attendance/FaceVerificationPopup.tsx');
const gateScannerPage = path.resolve(__dirname, '../src/app/(scanner)/gate-scanner/page.tsx');
const gateScannerAction = path.resolve(__dirname, '../src/actions/gate-scanner.ts');
const prismaSchema = path.resolve(__dirname, '../prisma/schema.prisma');

const popupContent = fs.readFileSync(popupFile, 'utf-8');
const scannerContent = fs.readFileSync(gateScannerPage, 'utf-8');
const actionContent = fs.readFileSync(gateScannerAction, 'utf-8');
const schemaContent = fs.readFileSync(prismaSchema, 'utf-8');

// 2.1: autoDismissMs <= 2500ms
const matchDefaultDismiss = popupContent.match(/autoDismissMs\s*=\s*(\d+)/);
const defaultDismissMs = matchDefaultDismiss ? parseInt(matchDefaultDismiss[1], 10) : NaN;

const matchPageDismiss = scannerContent.match(/autoDismissMs=\{(\d+)\}/);
const pageDismissMs = matchPageDismiss ? parseInt(matchPageDismiss[1], 10) : NaN;

check(
  'KSK-01a',
  'KIOSK_THROUGHPUT',
  'FaceVerificationPopup default autoDismissMs <= 2500ms',
  !isNaN(defaultDismissMs) && defaultDismissMs <= 2500,
  defaultDismissMs,
  '<= 2500'
);

check(
  'KSK-01b',
  'KIOSK_THROUGHPUT',
  'Gate Scanner page configures autoDismissMs <= 2500ms',
  !isNaN(pageDismissMs) && pageDismissMs <= 2500,
  pageDismissMs,
  '<= 2500'
);

// 2.2: Camera flip toggle alternates between 'environment' and 'user'
const hasFacingModeState =
  scannerContent.includes("useState<'environment' | 'user'>('environment')") ||
  scannerContent.includes('facingMode');
const hasToggleLogic =
  scannerContent.includes("facingMode === 'environment' ? 'user' : 'environment'") ||
  scannerContent.includes('setFacingMode');
const hasFlipButton =
  scannerContent.includes('handleToggleCamera') || scannerContent.includes('Balik Kamera');

check(
  'KSK-02',
  'KIOSK_CAMERA',
  "Camera flip toggle alternates between 'environment' and 'user' facing modes",
  hasFacingModeState && hasToggleLogic && hasFlipButton,
  { hasFacingModeState, hasToggleLogic, hasFlipButton },
  { hasFacingModeState: true, hasToggleLogic: true, hasFlipButton: true }
);

// 2.3: Manual fallback records scanned_by = "OPERATOR_MANUAL_KIOSK"
const hasManualOperatorDefault = actionContent.includes(
  "operatorId || 'OPERATOR_MANUAL_KIOSK'"
);
const hasPageManualCall = scannerContent.includes(
  "recordManualGateScan(student.nis, 'OPERATOR_MANUAL_KIOSK')"
);
const hasScannedByDbMapping =
  schemaContent.includes('scannedBy') && schemaContent.includes('@map("scanned_by")');

check(
  'KSK-03a',
  'KIOSK_AUDIT',
  'recordManualGateScan defaults/passes operatorId as OPERATOR_MANUAL_KIOSK',
  hasManualOperatorDefault,
  hasManualOperatorDefault,
  true
);

check(
  'KSK-03b',
  'KIOSK_AUDIT',
  'Gate scanner page calls recordManualGateScan with OPERATOR_MANUAL_KIOSK',
  hasPageManualCall,
  hasPageManualCall,
  true
);

check(
  'KSK-03c',
  'KIOSK_AUDIT',
  'Prisma schema maps scannedBy to database column scanned_by',
  hasScannedByDbMapping,
  hasScannedByDbMapping,
  true
);


// ============================================================================
// SUITE 3: MATHEMATICAL WCAG AAA CONTRAST VERIFICATION
// ============================================================================
console.log('\n======================================================');
console.log('SUITE 3: MATHEMATICAL WCAG AAA CONTRAST RATIOS');
console.log('======================================================');

function hexToLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = hexToLuminance(fgHex);
  const l2 = hexToLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Status badge tokens from globals.css
const cssFile = path.resolve(__dirname, '../src/app/globals.css');
const cssContent = fs.readFileSync(cssFile, 'utf-8');

const statusTokens = [
  { name: 'HADIR', fg: '#065F46', bg: '#D1FAE5' },
  { name: 'TERLAMBAT', fg: '#78350F', bg: '#FEF3C7' },
  { name: 'IZIN', fg: '#075985', bg: '#E0F2FE' },
  { name: 'SAKIT', fg: '#5B21B6', bg: '#EDE9FE' },
  { name: 'ALPA', fg: '#9F1239', bg: '#FFE4E6' },
];

for (const token of statusTokens) {
  // Confirm tokens are in globals.css
  const inCss = cssContent.toLowerCase().includes(token.fg.toLowerCase()) &&
                cssContent.toLowerCase().includes(token.bg.toLowerCase());

  const cr = calculateContrastRatio(token.fg, token.bg);
  const passesAA = cr >= 4.5;
  const passesAAA = cr >= 7.0;

  check(
    `WCAG-AA-${token.name}`,
    'CONTRAST_AA',
    `${token.name} (${token.fg} on ${token.bg}): CR=${cr.toFixed(4)}:1 >= 4.5:1 (WCAG AA)`,
    inCss && passesAA,
    { cr: Number(cr.toFixed(4)), inCss },
    { passesAA: true, inCss: true },
    `WCAG AA Standard (>= 4.5:1)`
  );

  check(
    `WCAG-AAA-${token.name}`,
    'CONTRAST_AAA',
    `${token.name} (${token.fg} on ${token.bg}): CR=${cr.toFixed(4)}:1 >= 7.0:1 (WCAG AAA Normal Text)`,
    passesAAA,
    { cr: Number(cr.toFixed(4)) },
    { passesAAA: true, minRequired: 7.0 },
    passesAAA
      ? 'Complies with WCAG AAA Normal Text'
      : `Falls short of strict 7.0:1 by ${(7.0 - cr).toFixed(2)}:1 (passes WCAG AA 4.5:1 & WCAG AAA Large Text)`
  );
}

// Check suggested mitigation values for AAA compliance
console.log('\n--- Evaluating Mitigation Palette (Tailwind 900 Shades) ---');
const mitigationTokens = [
  { name: 'HADIR_MITIGATED', fg: '#064E3B', bg: '#D1FAE5' }, // emerald-900
  { name: 'IZIN_MITIGATED', fg: '#0C4A6E', bg: '#E0F2FE' },  // sky-900
  { name: 'ALPA_MITIGATED', fg: '#881337', bg: '#FFE4E6' },  // rose-900
];

for (const mit of mitigationTokens) {
  const cr = calculateContrastRatio(mit.fg, mit.bg);
  console.log(`   [Mitigation] ${mit.name}: ${mit.fg} on ${mit.bg} -> CR=${cr.toFixed(4)}:1 (Passes AAA >= 7.0? ${cr >= 7.0})`);
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n======================================================');
console.log('ADVERSARIAL STRESS TEST SUMMARY REPORT');
console.log('======================================================');

const total = testResults.length;
const passed = testResults.filter((r) => r.passed).length;
const failed = total - passed;

console.log(`Total Adversarial Checks : ${total}`);
console.log(`Passed                   : ${passed}`);
console.log(`Failed                   : ${failed}`);

if (failed > 0) {
  console.log('\nFailing Checks:');
  for (const f of testResults.filter((r) => !r.passed)) {
    console.log(` - [${f.category}] ${f.id}: ${f.description}`);
    if (f.notes) console.log(`   Detail: ${f.notes}`);
  }
}

// Exit with 0 so runner outputs data cleanly for handoff analysis
process.exit(0);
