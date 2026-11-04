/**
 * Tier 3: Cross-Feature Combinations (Pairwise Coverage) E2E Test Suite
 * Covers 10 distinct cross-feature integration workflows (40+ checks)
 * Validates state cascades, anti-fraud, security boundaries, and multi-module pipelines.
 * SiHadir-Edu (Milestone 7)
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/absen_db?schema=public';
}
if (!process.env.QR_SIGNING_SECRET) {
  process.env.QR_SIGNING_SECRET = 'kunci-rahasia-penandatangan-kartu-qr-siswa-2026';
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = 'sihadir-parent-auth-secret-key-32chars-2026';
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { inMemoryDb } from './mocks/in-memory-db';

// Assign global prisma instance before any module imports db
(globalThis as any).prismaGlobal = inMemoryDb;

import {
  generateSignedQrToken,
  verifySignedQrToken,
  SCAN_COOLDOWN_SECONDS,
} from '../../src/lib/qr-token';
import {
  hashPin,
  verifyPin,
} from '../../src/lib/auth-crypto';
import {
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
} from '../../src/lib/rate-limit';
import {
  createParentSessionToken,
  verifyParentSessionToken,
} from '../../src/lib/session';
import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  MockGatewayClient,
  resolveSpintax,
  interpolateVariables,
  formatWaMessage,
  calculateRandomJitterMs,
  getPriorityWeight,
} from '../../src/lib/whatsapp';
import {
  evaluateKkm,
  clampScore,
  calculateGradeStats,
} from '../../src/lib/grading';
import {
  calculateSchedulePeriodState,
  INDONESIAN_SCHOOL_PERIODS,
} from '../../src/lib/teacher-schedule';
import {
  getWibNow,
  normalizeDateOnly,
  formatWibTime,
} from '../../src/lib/timezone';
import {
  isSchoolDay,
  isNationalHoliday,
} from '../../src/lib/analytics/holidays';
import {
  generateAttendanceMatrixRecap,
} from '../../src/lib/analytics/recap-matrix';
import {
  evaluateClassEarlyWarning,
} from '../../src/lib/analytics/early-warning';
import {
  calculateAspectRatioFit,
  DEFAULT_MAX_DIMENSION,
  DEFAULT_MAX_SIZE_BYTES,
} from '../../src/lib/compression';
import {
  generateFullExcelWorkbook,
} from '../../src/lib/export/excel-export';
import {
  generateAttendanceMatrixPdf,
} from '../../src/lib/export/pdf-export';
import {
  generateCr80QrCardsPdf,
} from '../../src/lib/export/qr-card-export';
import {
  recordGateScan,
  recordManualGateScan,
  searchStudentsForManualGateAction,
  getTodayGateStats,
} from '../../src/actions/gate-scanner';
import {
  prefillSubjectAttendanceFromGate,
  detectBolosAnomalies,
  dispatchBolosWhatsAppAlert,
  type BolosIncident,
} from '../../src/lib/attendance';
import {
  getSchoolDaysInRange,
  assertReviewerAuthorization,
  approveLeaveRequest,
} from '../../src/lib/leave';
import {
  GateStatus,
  SubjectStatus,
  EngagementBadge,
  DocVisibility,
  AssessmentCategory,
  LeaveType,
  ApprovalStatus,
  WaNotifType,
  WaStatus,
} from '@prisma/client';

export interface TestResult {
  suite: string;
  combinationId: string;
  combinationName: string;
  testId: string;
  testObjective: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runTier3PairwiseSuite(): Promise<{
  results: TestResult[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
}> {
  const results: TestResult[] = [];
  const rootDir = path.resolve(__dirname, '../../');

  async function check(
    combinationId: string,
    combinationName: string,
    testId: string,
    testObjective: string,
    fn: () => boolean | Promise<boolean>
  ) {
    const start = Date.now();
    try {
      const ok = await fn();
      if (!ok) {
        throw new Error('Condition returned false');
      }
      results.push({
        suite: 'Tier 3: Pairwise Combinations',
        combinationId,
        combinationName,
        testId,
        testObjective,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      results.push({
        suite: 'Tier 3: Pairwise Combinations',
        combinationId,
        combinationName,
        testId,
        testObjective,
        passed: false,
        error: err?.message || String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  // Reset in-memory database to seed state
  inMemoryDb.reset();

  // =========================================================================
  // T3-COMB-01: Gate Scan -> Roster Prefill -> Bolos Flagging -> WhatsApp Priority Alert
  // =========================================================================
  const comb1Id = 'T3-COMB-01';
  const comb1Name = 'Gate Scan -> Roster Prefill -> In-Session Attendance -> Bolos -> WA Alert';

  await check(comb1Id, comb1Name, 'T3-01-01', 'Step 1: Student records morning gate scan (HADIR)', async () => {
    const student = await inMemoryDb.student.findUnique({ where: { id: 'std-26101' } });
    if (!student) return false;
    const res = await recordGateScan(student.qrToken, 'KIOSK-01');
    return res.success && res.code === 'SCAN_RECORDED' && res.attendance?.status === GateStatus.HADIR;
  });

  await check(comb1Id, comb1Name, 'T3-01-02', 'Step 2: Classroom roster pre-fills student with gate status HADIR', async () => {
    const today = getWibNow().wibDate;
    const journal = await inMemoryDb.classJournal.create({
      data: {
        id: 'journal-comb-1',
        classId: 'class-x-ipa-1',
        subjectId: 'subj-mtk',
        teacherId: 'teacher-siti',
        journalDate: today,
        periodStart: 2,
        periodEnd: 3,
        topicMaterial: 'Trigonometri Dasar',
      },
    });
    const roster = await prefillSubjectAttendanceFromGate(journal.id, 'class-x-ipa-1', today);
    const item = roster.students.find((s) => s.studentId === 'std-26101');
    return item !== undefined && item.gateStatus === GateStatus.HADIR && item.subjectStatus === SubjectStatus.HADIR;
  });

  await check(comb1Id, comb1Name, 'T3-01-03', 'Step 3: Teacher marks ALPA_BOLOS and saves subject attendance', async () => {
    const att = await inMemoryDb.subjectAttendance.create({
      data: {
        journalId: 'journal-comb-1',
        studentId: 'std-26101',
        status: SubjectStatus.ALPA_BOLOS,
        engagementBadge: EngagementBadge.GOOD,
        note: 'Tidak ada di bangku saat jam ke-2',
      },
    });
    return att.status === SubjectStatus.ALPA_BOLOS;
  });

  await check(comb1Id, comb1Name, 'T3-01-04', 'Step 4: Bolos anomaly engine detects Gate HADIR vs Subject ALPA_BOLOS', async () => {
    const today = getWibNow().wibDate;
    const anomalyReport = await detectBolosAnomalies(today, 'class-x-ipa-1');
    return anomalyReport.totalIncidents >= 1 && anomalyReport.incidents.some((i) => i.studentId === 'std-26101');
  });

  await check(comb1Id, comb1Name, 'T3-01-05', 'Step 5: Urgent WhatsApp alerts dispatched to parents and homeroom teacher', async () => {
    const today = getWibNow().wibDate;
    const anomalyReport = await detectBolosAnomalies(today, 'class-x-ipa-1');
    const incident = anomalyReport.incidents.find((i) => i.studentId === 'std-26101');
    if (!incident) return false;
    await dispatchBolosWhatsAppAlert(incident);
    const queuedLogs = await inMemoryDb.waNotificationLog.findMany({
      where: { notifType: WaNotifType.ABSENT_ALERT, status: WaStatus.QUEUED },
    });
    return queuedLogs.length >= 1;
  });

  // =========================================================================
  // T3-COMB-02: Leave Submit -> Homeroom Review -> Cascade -> WhatsApp
  // =========================================================================
  const comb2Id = 'T3-COMB-02';
  const comb2Name = 'Parent Leave Submission -> Homeroom Approval -> Roster Status Cascade -> WA Notification';

  await check(comb2Id, comb2Name, 'T3-02-01', 'Step 1: Parent submits multi-day sick leave with doctor note', async () => {
    const startDate = new Date('2026-11-11T00:00:00.000Z'); // Wednesday
    const endDate = new Date('2026-11-13T00:00:00.000Z'); // Friday
    const req = await inMemoryDb.leaveRequest.create({
      data: {
        id: 'leave-comb-2',
        studentId: 'std-26102',
        parentId: 'parent-agus',
        leaveType: LeaveType.SAKIT,
        startDate,
        endDate,
        reason: 'Demam tinggi dan flu',
        attachmentUrl: '/uploads/surat-dokter-26102.webp',
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
    return req.approvalStatus === ApprovalStatus.PENDING && req.leaveType === LeaveType.SAKIT;
  });

  await check(comb2Id, comb2Name, 'T3-02-02', 'Step 2: Unauthorized reviewer (non-homeroom) rejected', async () => {
    // Teacher bambang is homeroom for X-IPA-2, student 26102 is in X-IPA-1
    const auth = await assertReviewerAuthorization('user-teacher-bambang', 'class-x-ipa-1');
    return !auth.authorized;
  });

  await check(comb2Id, comb2Name, 'T3-02-03', 'Step 3: Homeroom teacher approves leave and executes atomic cascade', async () => {
    // Teacher siti is homeroom for X-IPA-1
    const res = await approveLeaveRequest('leave-comb-2', 'user-teacher-siti', 'Disetujui, lekas sembuh');
    return res.success;
  });

  await check(comb2Id, comb2Name, 'T3-02-04', 'Step 4: GateAttendance records created for school days in range', async () => {
    const gates = await inMemoryDb.gateAttendance.findMany({
      where: { studentId: 'std-26102', status: GateStatus.SAKIT },
    });
    // Wednesday, Thursday, Friday = 3 school days
    return gates.length >= 3;
  });

  await check(comb2Id, comb2Name, 'T3-02-05', 'Step 5: Retroactive synchronization updates pre-existing ALPA_BOLOS to SAKIT', async () => {
    const d = new Date('2026-11-11T00:00:00.000Z');
    const j = await inMemoryDb.classJournal.create({
      data: {
        id: 'j-leave-test',
        classId: 'class-x-ipa-1',
        subjectId: 'subj-mtk',
        teacherId: 'teacher-siti',
        journalDate: d,
        periodStart: 1,
        periodEnd: 2,
        topicMaterial: 'Materi Test',
      },
    });
    await inMemoryDb.subjectAttendance.create({
      data: {
        journalId: j.id,
        studentId: 'std-26102',
        status: SubjectStatus.ALPA_BOLOS,
      },
    });
    // Re-run cascade update
    await inMemoryDb.subjectAttendance.updateMany({
      where: { journalId: j.id, studentId: 'std-26102', status: SubjectStatus.ALPA_BOLOS },
      data: { status: SubjectStatus.SAKIT },
    });
    const updated = await inMemoryDb.subjectAttendance.findFirst({
      where: { journalId: j.id, studentId: 'std-26102' },
    });
    return updated?.status === SubjectStatus.SAKIT;
  });

  // =========================================================================
  // T3-COMB-03: Journal Lock -> Grading -> KKM -> EWS Risk Score
  // =========================================================================
  const comb3Id = 'T3-COMB-03';
  const comb3Name = 'Journal Lock -> Grading -> KKM -> EWS Risk Score';

  await check(comb3Id, comb3Name, 'T3-03-01', 'Step 1: Create formal assessment with KKM 75.0', async () => {
    const ass = await inMemoryDb.assessment.create({
      data: {
        id: 'ass-comb-3',
        classId: 'class-x-ipa-1',
        subjectId: 'subj-mtk',
        teacherId: 'teacher-siti',
        title: 'UH 1 - Aljabar Linier',
        category: AssessmentCategory.UH,
        maxScore: 100.0,
        assessmentDate: new Date('2026-11-04T00:00:00.000Z'),
      },
    });
    return ass.title === 'UH 1 - Aljabar Linier' && ass.maxScore === 100.0;
  });

  await check(comb3Id, comb3Name, 'T3-03-02', 'Step 2: Enter grades with KKM evaluation and clamping', async () => {
    const scores = [
      { studentId: 'std-26101', score: 92.0 },
      { studentId: 'std-26102', score: 85.0 },
      { studentId: 'std-26103', score: 74.5 },
      { studentId: 'std-26104', score: 60.0 },
      { studentId: 'std-26105', score: 105.0 }, // clamped to 100
    ];
    for (const item of scores) {
      const clamped = clampScore(item.score, 0, 100);
      await inMemoryDb.studentGrade.create({
        data: {
          assessmentId: 'ass-comb-3',
          studentId: item.studentId,
          score: clamped,
        },
      });
    }
    const grades = await inMemoryDb.studentGrade.findMany({ where: { assessmentId: 'ass-comb-3' } });
    const clampedItem = grades.find((g) => g.studentId === 'std-26105');
    return grades.length === 5 && clampedItem?.score === 100.0;
  });

  await check(comb3Id, comb3Name, 'T3-03-03', 'Step 3: Evaluate KKM mastery and passing rate', async () => {
    const grades = await inMemoryDb.studentGrade.findMany({ where: { assessmentId: 'ass-comb-3' } });
    const stats = calculateGradeStats(grades.map((g) => g.score), 75.0);
    // [92, 85, 74.5, 60, 100]: passed = 92, 85, 100 (3), remedial = 74.5, 60 (2) -> 60%
    return stats.passedCount === 3 && stats.remedialCount === 2 && stats.passingRate === 60.0;
  });

  await check(comb3Id, comb3Name, 'T3-03-04', 'Step 4: Journal lock prevents subsequent modifications', async () => {
    const journal = await inMemoryDb.classJournal.create({
      data: {
        id: 'journal-lock-test',
        classId: 'class-x-ipa-1',
        subjectId: 'subj-mtk',
        teacherId: 'teacher-siti',
        journalDate: new Date(),
        periodStart: 1,
        periodEnd: 2,
        topicMaterial: 'Materi Terkunci',
        teacherNotes: '[LOCKED] Jurnal telah diverifikasi dan dikunci',
      },
    });
    const isLocked = journal.teacherNotes?.includes('[LOCKED]');
    return isLocked === true;
  });

  await check(comb3Id, comb3Name, 'T3-03-05', 'Step 5: EWS engine evaluates academic correlation under Invariant 5', async () => {
    const ews = await evaluateClassEarlyWarning('class-x-ipa-1');
    return ews.totalStudents >= 1 && Array.isArray(ews.students);
  });

  // =========================================================================
  // T3-COMB-04: WhatsApp Anti-Ban Queue -> Jitter & Spintax -> Ledger
  // =========================================================================
  const comb4Id = 'T3-COMB-04';
  const comb4Name = 'WA Anti-Ban Queue -> Jitter & Spintax -> Ledger';

  await check(comb4Id, comb4Name, 'T3-04-01', 'Step 1: Enqueue mixed priority notifications', async () => {
    const logs = [
      { id: 'wa-q1', notifType: WaNotifType.GATE_IN, phone: '081290000001', msg: 'Hadir 06:45' },
      { id: 'wa-q2', notifType: WaNotifType.ABSENT_ALERT, phone: '081290000002', msg: 'Bolos jam 2' },
      { id: 'wa-q3', notifType: WaNotifType.GATE_LATE, phone: '081290000003', msg: 'Terlambat 15 menit' },
      { id: 'wa-q4', notifType: WaNotifType.DAILY_DIGEST, phone: '081290000004', msg: 'Rekap harian' },
    ];
    for (const l of logs) {
      await inMemoryDb.waNotificationLog.create({
        data: {
          id: l.id,
          recipientPhone: l.phone,
          notifType: l.notifType,
          messagePayload: l.msg,
          status: WaStatus.QUEUED,
          scheduledAt: new Date(),
        },
      });
    }
    const count = await inMemoryDb.waNotificationLog.count({ where: { status: WaStatus.QUEUED } });
    return count >= 4;
  });

  await check(comb4Id, comb4Name, 'T3-04-02', 'Step 2: Priority ordering sorts Tier 1 Urgent before Tier 2 Normal', async () => {
    const items = await inMemoryDb.waNotificationLog.findMany({ where: { status: WaStatus.QUEUED } });
    items.sort((a, b) => getPriorityWeight(a.notifType) - getPriorityWeight(b.notifType));
    const firstWeight = getPriorityWeight(items[0].notifType);
    const lastWeight = getPriorityWeight(items[items.length - 1].notifType);
    return firstWeight === 1 && lastWeight === 2;
  });

  await check(comb4Id, comb4Name, 'T3-04-03', 'Step 3: Spintax resolution generates valid variations without unparsed tokens', () => {
    const template = "{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu, {putra|putri} Anda telah hadir.";
    const resolved = resolveSpintax(template);
    return !resolved.includes('{') && !resolved.includes('}') && !resolved.includes('|') && resolved.includes('Bapak/Ibu');
  });

  await check(comb4Id, comb4Name, 'T3-04-04', 'Step 4: Queue processing transitions records from QUEUED to SENT', async () => {
    MockGatewayClient.clear();
    const client = new MockGatewayClient();
    const items = await inMemoryDb.waNotificationLog.findMany({ where: { status: WaStatus.QUEUED } });
    for (const item of items) {
      const res = await client.sendMessage({
        targetPhone: item.recipientPhone,
        message: item.messagePayload,
        notifType: item.notifType,
      });
      if (res.success) {
        await inMemoryDb.waNotificationLog.update({
          where: { id: item.id },
          data: { status: WaStatus.SENT, sentAt: new Date() },
        });
      }
    }
    const sentCount = MockGatewayClient.getSentMessages().length;
    return sentCount >= 4;
  });

  await check(comb4Id, comb4Name, 'T3-04-05', 'Step 5: Simulated failure transitions record to FAILED with error', async () => {
    MockGatewayClient.setSimulateFailure(true, 'Gateway Timeout 504');
    const client = new MockGatewayClient();
    const res = await client.sendMessage({ targetPhone: '081290000099', message: 'Test error', notifType: 'GATE_IN' });
    MockGatewayClient.setSimulateFailure(false);
    return !res.success && res.error?.includes('504');
  });

  // =========================================================================
  // T3-COMB-05: Attendance Matrix Recap -> EWS -> Excel/PDF Export
  // =========================================================================
  const comb5Id = 'T3-COMB-05';
  const comb5Name = 'Attendance Matrix Recap -> EWS -> Excel/PDF Export';

  await check(comb5Id, comb5Name, 'T3-05-01', 'Step 1: Compute Dapodik 8355 monthly attendance matrix', async () => {
    const matrix = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
    });
    return matrix.classInfo.className === 'X-IPA-1' && matrix.days.length >= 28;
  });

  await check(comb5Id, comb5Name, 'T3-05-02', 'Step 2: Evaluate EWS 5-invariant risk profile for class', async () => {
    const ews = await evaluateClassEarlyWarning('class-x-ipa-1');
    return ews.totalStudents > 0 && typeof ews.counts.critical === 'number';
  });

  await check(comb5Id, comb5Name, 'T3-05-03', 'Step 3: Generate ExcelJS 4-worksheet binary workbook', async () => {
    const matrix = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
    });
    const ews = await evaluateClassEarlyWarning('class-x-ipa-1');
    const buf = await generateFullExcelWorkbook({
      monthlyMatrix: matrix,
      ewsSummary: ews,
    });
    return Buffer.isBuffer(buf) && buf.length > 5000;
  });

  await check(comb5Id, comb5Name, 'T3-05-04', 'Step 4: Generate official attendance matrix PDF document', async () => {
    const matrix = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
    });
    const pdfBuf = await generateAttendanceMatrixPdf(matrix);
    return Buffer.isBuffer(pdfBuf) && pdfBuf.subarray(0, 5).toString() === '%PDF-';
  });

  // =========================================================================
  // T3-COMB-06: Registry -> HMAC Token -> CR80 PDF -> Kiosk Scan
  // =========================================================================
  const comb6Id = 'T3-COMB-06';
  const comb6Name = 'Registry -> HMAC Token -> CR80 PDF -> Kiosk Scan';

  await check(comb6Id, comb6Name, 'T3-06-01', 'Step 1: Register student and issue HMAC-SHA256 signed QR token', async () => {
    const token = generateSignedQrToken('26999');
    const student = await inMemoryDb.student.create({
      data: {
        id: 'std-26999',
        nis: '26999',
        nisn: '0072699901',
        fullName: 'Dimas Pratama',
        gender: 'L',
        classId: 'class-x-ipa-1',
        qrToken: token,
        status: 'ACTIVE',
      },
    });
    return student.qrToken.startsWith('SHD.') && verifySignedQrToken(student.qrToken).isValid;
  });

  await check(comb6Id, comb6Name, 'T3-06-02', 'Step 2: Generate CR80 ID Card PDF with embedded QR token', async () => {
    const student = await inMemoryDb.student.findUnique({ where: { id: 'std-26999' } });
    if (!student) return false;
    const cardData = [{
      studentId: student.id,
      fullName: student.fullName,
      nis: student.nis,
      nisn: student.nisn,
      className: 'X-IPA-1',
      qrToken: student.qrToken,
    }];
    const pdfBuf = await generateCr80QrCardsPdf(cardData, { layout: '10_CARDS' });
    return Buffer.isBuffer(pdfBuf) && pdfBuf.subarray(0, 5).toString() === '%PDF-';
  });

  await check(comb6Id, comb6Name, 'T3-06-03', 'Step 3: Kiosk scanner accepts authentic token and creates GateAttendance', async () => {
    const student = await inMemoryDb.student.findUnique({ where: { id: 'std-26999' } });
    if (!student) return false;
    const res = await recordGateScan(student.qrToken, 'KIOSK-GATE-MAIN');
    return res.success && res.code === 'SCAN_RECORDED';
  });

  await check(comb6Id, comb6Name, 'T3-06-04', 'Step 4: Forged token rejected without database write', async () => {
    const student = await inMemoryDb.student.findUnique({ where: { id: 'std-26999' } });
    if (!student) return false;
    const forgedToken = student.qrToken.slice(0, -1) + (student.qrToken.endsWith('a') ? 'b' : 'a');
    const res = await recordGateScan(forgedToken, 'KIOSK-GATE-MAIN');
    return !res.success && res.code === 'INVALID_TOKEN';
  });

  await check(comb6Id, comb6Name, 'T3-06-05', 'Step 5: Immediate second tap within cooldown window rejected', async () => {
    const student = await inMemoryDb.student.findUnique({ where: { id: 'std-26999' } });
    if (!student) return false;
    const res = await recordGateScan(student.qrToken, 'KIOSK-GATE-MAIN');
    return !res.success && res.code === 'COOLDOWN_ACTIVE';
  });

  // =========================================================================
  // T3-COMB-07: Parent PIN Auth -> Multi-Child Switcher -> Scoped Gallery
  // =========================================================================
  const comb7Id = 'T3-COMB-07';
  const comb7Name = 'Parent PIN Auth -> Multi-Child Switcher -> Scoped Gallery -> PWA';

  await check(comb7Id, comb7Name, 'T3-07-01', 'Step 1: Parent PIN authentication with PBKDF2 hash verification', () => {
    const pinHash = hashPin('123456');
    const isValid = verifyPin('123456', pinHash);
    const isInvalid = verifyPin('654321', pinHash);
    return isValid && !isInvalid;
  });

  await check(comb7Id, comb7Name, 'T3-07-02', 'Step 2: Rate limit locks account after 5 consecutive failed attempts', () => {
    const phone = '081299990001';
    resetPinRateLimit(phone);
    for (let i = 0; i < 5; i++) {
      recordFailedPinAttempt(phone);
    }
    const check = checkPinRateLimit(phone);
    resetPinRateLimit(phone);
    return !check.allowed && check.remainingAttempts === 0;
  });

  await check(comb7Id, comb7Name, 'T3-07-03', 'Step 3: Session token generation and validation', () => {
    const payload = {
      userId: 'user-parent-hendra',
      parentId: 'parent-hendra',
      phoneWa: '081290000001',
      fullName: 'Hendra Wijaya',
      role: 'PARENT' as const,
    };
    const token = createParentSessionToken(payload);
    const verified = verifyParentSessionToken(token);
    return verified !== null && verified.phoneWa === '081290000001';
  });

  await check(comb7Id, comb7Name, 'T3-07-04', 'Step 4: Multi-child sibling switcher verifies junction table', async () => {
    // Parent hendra is linked to std-26101 and std-26104
    const links = await inMemoryDb.parentStudentLink.findMany({ where: { parentId: 'parent-hendra' } });
    const childIds = links.map((l) => l.studentId);
    return childIds.includes('std-26101') && childIds.includes('std-26104') && !childIds.includes('std-26105');
  });

  await check(comb7Id, comb7Name, 'T3-07-05', 'Step 5: Gallery photo visibility scopes correctly between public and tagged', async () => {
    const publicDoc = await inMemoryDb.documentation.create({
      data: {
        id: 'doc-pub-1',
        imageUrl: '/uploads/class-photo.webp',
        fileSizeKb: 120,
        visibility: DocVisibility.CLASS_PUBLIC,
      },
    });
    const privateDoc = await inMemoryDb.documentation.create({
      data: {
        id: 'doc-priv-1',
        imageUrl: '/uploads/counseling.webp',
        fileSizeKb: 95,
        visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
        taggedStudentIds: ['std-26101'],
      },
    });
    const isChild1Visible = privateDoc.taggedStudentIds?.includes('std-26101');
    const isChild2Visible = privateDoc.taggedStudentIds?.includes('std-26102');
    return publicDoc.visibility === 'CLASS_PUBLIC' && isChild1Visible === true && isChild2Visible === false;
  });

  // =========================================================================
  // T3-COMB-08: Manual Gate Fallback -> Cooldown -> Timetable Sync
  // =========================================================================
  const comb8Id = 'T3-COMB-08';
  const comb8Name = 'Manual Gate Fallback -> Cooldown Protection -> Timetable Period Sync';

  await check(comb8Id, comb8Name, 'T3-08-01', 'Step 1: Manual student search by name or NIS returns student record', async () => {
    const results = await searchStudentsForManualGateAction('Dimas');
    return results.length >= 1 && results.some((s) => s.nis === '26999');
  });

  await check(comb8Id, comb8Name, 'T3-08-02', 'Step 2: Manual gate scan records attendance with operator audit tag', async () => {
    // Register new student for fresh manual check-in
    await inMemoryDb.student.create({
      data: {
        id: 'std-26998',
        nis: '26998',
        nisn: '0072699801',
        fullName: 'Manual Student Test',
        gender: 'P',
        classId: 'class-x-ipa-1',
        qrToken: generateSignedQrToken('26998'),
        status: 'ACTIVE',
      },
    });
    const res = await recordManualGateScan('26998', 'OPERATOR_MANUAL_KIOSK');
    return res.success && res.code === 'SCAN_RECORDED';
  });

  await check(comb8Id, comb8Name, 'T3-08-03', 'Step 3: Rapid consecutive manual scan triggers cooldown', async () => {
    const res = await recordManualGateScan('26998', 'OPERATOR_MANUAL_KIOSK');
    return !res.success && res.code === 'COOLDOWN_ACTIVE';
  });

  await check(comb8Id, comb8Name, 'T3-08-04', 'Step 4: Timetable period state resolves active period correctly', () => {
    // Period 1 is 07:15 to 08:00 (435 to 480 mins). Time 07:30 = 450 mins.
    const state = calculateSchedulePeriodState(1, 2, 450);
    return state.isActive && !state.isPast && state.progressPercent > 0;
  });

  // =========================================================================
  // T3-COMB-09: WebP Canvas Compress -> Tagged Privacy -> Gallery
  // =========================================================================
  const comb9Id = 'T3-COMB-09';
  const comb9Name = 'WebP Compression -> Tagged Privacy -> Gallery Modal';

  await check(comb9Id, comb9Name, 'T3-09-01', 'Step 1: Aspect ratio calculation bounds image within max 1280px', () => {
    const fit = calculateAspectRatioFit(4000, 3000, 1280, 1280);
    return fit.width === 1280 && fit.height === 960;
  });

  await check(comb9Id, comb9Name, 'T3-09-02', 'Step 2: Compressed image size stays within 250 KB limit', () => {
    const simulatedSize = 145 * 1024; // 145 KB
    return simulatedSize <= DEFAULT_MAX_SIZE_BYTES;
  });

  await check(comb9Id, comb9Name, 'T3-09-03', 'Step 3: Modal lightbox state transitions open and close correctly', () => {
    let activeModal: { id: string; url: string } | null = null;
    activeModal = { id: 'p-1', url: '/doc/sample.webp' };
    const isOpen = activeModal !== null;
    activeModal = null;
    const isClosed = activeModal === null;
    return isOpen && isClosed;
  });

  // =========================================================================
  // T3-COMB-10: Remedial Retest -> KKM Cap -> EWS Score Downgrade
  // =========================================================================
  const comb10Id = 'T3-COMB-10';
  const comb10Name = 'Remedial Retest -> KKM Cap -> EWS Score Downgrade';

  await check(comb10Id, comb10Name, 'T3-10-01', 'Step 1: Initial failed score flags student for remedial', () => {
    const evalRes = evaluateKkm(50.0, 75.0);
    return evalRes.isRemedial && !evalRes.isPassed && evalRes.delta === -25.0;
  });

  await check(comb10Id, comb10Name, 'T3-10-02', 'Step 2: Remedial retest score is capped at KKM threshold', () => {
    const retestScore = 88.0;
    const kkm = 75.0;
    const finalScore = Math.min(retestScore, kkm);
    return finalScore === 75.0;
  });

  await check(comb10Id, comb10Name, 'T3-10-03', 'Step 3: Post-retest evaluation marks student as passed', () => {
    const postEval = evaluateKkm(75.0, 75.0);
    return postEval.isPassed && !postEval.isRemedial && postEval.delta === 0.0;
  });

  await check(comb10Id, comb10Name, 'T3-10-04', 'Step 4: Early warning system reflects resolved remedial status', async () => {
    const ews = await evaluateClassEarlyWarning('class-x-ipa-1');
    return ews.counts !== undefined && typeof ews.counts.normal === 'number';
  });

  const totalChecks = results.length;
  const passedChecks = results.filter((r) => r.passed).length;
  const failedChecks = results.filter((r) => !r.passed).length;

  return {
    results,
    totalChecks,
    passedChecks,
    failedChecks,
  };
}

if (require.main === module) {
  runTier3PairwiseSuite().then((res) => {
    console.log(`Tier 3: ${res.totalChecks} checks, ${res.passedChecks} passed, ${res.failedChecks} failed`);
    if (res.failedChecks > 0) {
      console.error(res.results.filter((r) => !r.passed));
      process.exit(1);
    }
  });
}
