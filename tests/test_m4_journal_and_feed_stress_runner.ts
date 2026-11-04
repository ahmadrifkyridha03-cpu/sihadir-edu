/**
 * Empirical Adversarial Stress Harness for Milestone 4
 * Focus: Journal Lifecycle, Bolos Anomaly Detection, Activity Feed Scoping
 */

import { createRequire } from 'module';
const cjsRequire = createRequire('D:\\WEBSITE ABSENSI\\tests\\test_runner.js');
const cachePath = cjsRequire.resolve('next/cache');
cjsRequire(cachePath);
cjsRequire.cache[cachePath].exports.revalidatePath = () => {};

import { db } from '../src/lib/db';
import {
  GateStatus,
  SubjectStatus,
  EngagementBadge,
  DocVisibility,
  WaNotifType,
  WaStatus,
} from '@prisma/client';

export interface StressRunnerResult {
  suite: string;
  test: string;
  passed: boolean;
  actual: any;
  expected: any;
  details: string;
}

const runnerResults: StressRunnerResult[] = [];

function recordTest(
  suite: string,
  test: string,
  passed: boolean,
  actual: any,
  expected: any,
  details: string
) {
  runnerResults.push({ suite, test, passed, actual, expected, details });
  const mark = passed ? '[PASS]' : '[FAIL]';
  console.log(`${mark} [${suite}] ${test}: ${details}`);
}

// In-Memory Mock Store
const memoryStore = {
  classes: new Map<string, any>(),
  subjects: new Map<string, any>(),
  teachers: new Map<string, any>(),
  students: new Map<string, any>(),
  parentStudentLinks: new Map<string, any>(),
  gateAttendances: new Map<string, any>(),
  classJournals: new Map<string, any>(),
  subjectAttendances: new Map<string, any>(),
  documentations: new Map<string, any>(),
  assessments: new Map<string, any>(),
  studentGrades: new Map<string, any>(),
  leaveRequests: new Map<string, any>(),
  waNotificationLogs: new Map<string, any>(),
};

function setupMockDb() {
  memoryStore.classes.clear();
  memoryStore.subjects.clear();
  memoryStore.teachers.clear();
  memoryStore.students.clear();
  memoryStore.parentStudentLinks.clear();
  memoryStore.gateAttendances.clear();
  memoryStore.classJournals.clear();
  memoryStore.subjectAttendances.clear();
  memoryStore.documentations.clear();
  memoryStore.assessments.clear();
  memoryStore.studentGrades.clear();
  memoryStore.leaveRequests.clear();
  memoryStore.waNotificationLogs.clear();

  const mockClass = {
    id: '11111111-1111-4111-8111-111111111111',
    className: 'X-IPA-1',
    gradeLevel: 10,
    academicYearId: '22222222-2222-4222-8222-222222222222',
    students: [] as any[],
  };
  const mockSubject = {
    id: '33333333-3333-4333-8333-333333333333',
    subjectCode: 'MTK',
    subjectName: 'Matematika',
    kkmScore: 75.0,
  };
  const mockTeacher = {
    id: '44444444-4444-4444-8444-444444444444',
    userId: '55555555-5555-4555-8555-555555555555',
    fullName: 'Budi Santoso, M.Pd.',
    phoneWa: '081234567890',
  };
  const mockStudentA = {
    id: '66666666-6666-4666-8666-666666666666',
    nis: '1001',
    nisn: '001001001',
    fullName: 'Ahmad Fauzi',
    classId: mockClass.id,
    class: mockClass,
    status: 'ACTIVE',
  };
  const mockStudentB = {
    id: '77777777-7777-4777-8777-777777777777',
    nis: '1002',
    nisn: '001001002',
    fullName: 'Bambang Pratama',
    classId: mockClass.id,
    class: mockClass,
    status: 'ACTIVE',
  };

  mockClass.students = [mockStudentA, mockStudentB];

  memoryStore.classes.set(mockClass.id, mockClass);
  memoryStore.subjects.set(mockSubject.id, mockSubject);
  memoryStore.teachers.set(mockTeacher.id, mockTeacher);
  memoryStore.students.set(mockStudentA.id, mockStudentA);
  memoryStore.students.set(mockStudentB.id, mockStudentB);

  memoryStore.parentStudentLinks.set(mockStudentA.id, {
    studentId: mockStudentA.id,
    receiveWaNotif: true,
    parent: {
      fullName: 'Ayah Ahmad',
      phoneWa: '081299990001',
    },
  });

  const mockPrisma: any = {
    class: {
      findUnique: async (args: any) => memoryStore.classes.get(args.where.id) || null,
    },
    subject: {
      findUnique: async (args: any) => memoryStore.subjects.get(args.where.id) || null,
    },
    teacher: {
      findUnique: async (args: any) => memoryStore.teachers.get(args.where.id) || null,
    },
    student: {
      findUnique: async (args: any) => {
        const s = memoryStore.students.get(args.where.id);
        if (!s) return null;
        return { ...s, class: memoryStore.classes.get(s.classId) };
      },
    },
    parentStudentLink: {
      findFirst: async (args: any) => {
        return memoryStore.parentStudentLinks.get(args.where.studentId) || null;
      },
    },
    gateAttendance: {
      findMany: async (args: any) => {
        const studentIds = args.where.studentId?.in || (args.where.studentId ? [args.where.studentId] : null);
        const statusList = args.where.status?.in || (args.where.status ? [args.where.status] : null);
        const targetDateStr = args.where.attendanceDate
          ? (args.where.attendanceDate instanceof Date
              ? args.where.attendanceDate.toISOString().split('T')[0]
              : String(args.where.attendanceDate).split('T')[0])
          : null;

        const results = [];
        for (const g of memoryStore.gateAttendances.values()) {
          const gDateStr = g.attendanceDate instanceof Date
            ? g.attendanceDate.toISOString().split('T')[0]
            : String(g.attendanceDate).split('T')[0];

          if (studentIds && !studentIds.includes(g.studentId)) continue;
          if (targetDateStr && gDateStr !== targetDateStr) continue;
          if (statusList && !statusList.includes(g.status)) continue;

          results.push({
            ...g,
            student: {
              ...memoryStore.students.get(g.studentId),
              class: memoryStore.classes.get(mockClass.id),
            },
          });
        }
        return results;
      },
    },
    classJournal: {
      findUnique: async (args: any) => {
        const j = memoryStore.classJournals.get(args.where.id);
        if (!j) return null;
        const attendances = Array.from(memoryStore.subjectAttendances.values()).filter(
          (a) => a.journalId === j.id
        );
        const documentations = Array.from(memoryStore.documentations.values()).filter(
          (d) => d.journalId === j.id
        );
        const assessments = Array.from(memoryStore.assessments.values()).filter(
          (as) => as.journalId === j.id
        );
        return {
          ...j,
          class: memoryStore.classes.get(j.classId),
          subject: memoryStore.subjects.get(j.subjectId),
          teacher: memoryStore.teachers.get(j.teacherId),
          subjectAttendances: attendances,
          documentations,
          assessments,
        };
      },
      findMany: async (args: any) => {
        const results = [];
        for (const j of memoryStore.classJournals.values()) {
          if (j.classId === args.where.classId) {
            const attendances = Array.from(memoryStore.subjectAttendances.values()).filter(
              (a) => a.journalId === j.id
            );
            const documentations = Array.from(memoryStore.documentations.values()).filter(
              (d) => d.journalId === j.id
            );
            const assessments = Array.from(memoryStore.assessments.values()).filter(
              (as) => as.journalId === j.id
            );
            results.push({
              ...j,
              subject: memoryStore.subjects.get(j.subjectId),
              teacher: memoryStore.teachers.get(j.teacherId),
              subjectAttendances: attendances,
              documentations,
              assessments: assessments.map((as) => ({
                ...as,
                grades: Array.from(memoryStore.studentGrades.values()).filter(
                  (g) => g.assessmentId === as.id
                ),
              })),
            });
          }
        }
        return results;
      },
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = args.data.id || `88888888-8888-4888-8888-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.classJournals.set(id, record);
        return record;
      },
      update: async (args: any) => {
        const existing = memoryStore.classJournals.get(args.where.id);
        if (!existing) throw new Error('Journal not found');
        const updated = { ...existing, ...args.data };
        memoryStore.classJournals.set(args.where.id, updated);
        return updated;
      },
    },
    subjectAttendance: {
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = `99999999-9999-4999-8999-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.subjectAttendances.set(`${args.data.journalId}_${args.data.studentId}`, record);
        return record;
      },
      upsert: async (args: any) => {
        const key = `${args.where.journalId_studentId.journalId}_${args.where.journalId_studentId.studentId}`;
        const existing = memoryStore.subjectAttendances.get(key);
        if (existing) {
          const updated = { ...existing, ...args.update };
          memoryStore.subjectAttendances.set(key, updated);
          return updated;
        } else {
          const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
          const created = { id: `99999999-9999-4999-8999-${randPart}`, ...args.create };
          memoryStore.subjectAttendances.set(key, created);
          return created;
        }
      },
    },
    documentation: {
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = `aaaaaaaa-aaaa-4aaa-8aaa-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.documentations.set(id, record);
        return record;
      },
      deleteMany: async (args: any) => {
        for (const [id, d] of memoryStore.documentations.entries()) {
          if (d.journalId === args.where.journalId) {
            memoryStore.documentations.delete(id);
          }
        }
        return { count: 1 };
      },
    },
    assessment: {
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = `bbbbbbbb-bbbb-4bbb-8bbb-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.assessments.set(id, record);
        return record;
      },
      findFirst: async (args: any) => {
        for (const a of memoryStore.assessments.values()) {
          if (a.journalId === args.where.journalId) return a;
        }
        return null;
      },
      update: async (args: any) => {
        const existing = memoryStore.assessments.get(args.where.id);
        const updated = { ...existing, ...args.data };
        memoryStore.assessments.set(args.where.id, updated);
        return updated;
      },
    },
    studentGrade: {
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = `cccccccc-cccc-4ccc-8ccc-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.studentGrades.set(`${args.data.assessmentId}_${args.data.studentId}`, record);
        return record;
      },
      upsert: async (args: any) => {
        const key = `${args.where.assessmentId_studentId.assessmentId}_${args.where.assessmentId_studentId.studentId}`;
        const existing = memoryStore.studentGrades.get(key);
        if (existing) {
          const updated = { ...existing, ...args.update };
          memoryStore.studentGrades.set(key, updated);
          return updated;
        } else {
          const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
          const created = { id: `cccccccc-cccc-4ccc-8ccc-${randPart}`, ...args.create };
          memoryStore.studentGrades.set(key, created);
          return created;
        }
      },
      findMany: async () => [],
    },
    leaveRequest: {
      findMany: async () => [],
    },
    waNotificationLog: {
      create: async (args: any) => {
        const randPart = Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        const id = `dddddddd-dddd-4ddd-8ddd-${randPart}`;
        const record = { id, ...args.data };
        memoryStore.waNotificationLogs.set(id, record);
        return record;
      },
    },
    $transaction: async (cb: any) => {
      return await cb(mockPrisma);
    },
  };

  Object.assign(db, mockPrisma);
  return { mockClass, mockSubject, mockTeacher, mockStudentA, mockStudentB };
}

async function runAdversarialStressTests() {
  console.log('=== STARTING ADVERSARIAL STRESS HARNESS RUNNER ===');
  const env = setupMockDb();

  // Dynamic import of actions after mocking db and cache
  const { createJournalAction, updateJournalAction, lockJournalAction } = await import(
    '../src/actions/journal'
  );
  const { getStudentActivityTimeline, isPhotoVisibleToStudent } = await import(
    '../src/lib/activity-feed'
  );

  // ============================================================================
  // SUITE 1: Journal Immutability & Lifecycle Guard
  // ============================================================================
  console.log('\n--- SUITE 1: Journal Immutability & Lifecycle Guard ---');

  // Test 1.1: Draft Creation (isLocked: false)
  const createDraftInput = {
    classId: env.mockClass.id,
    subjectId: env.mockSubject.id,
    teacherId: env.mockTeacher.id,
    journalDate: '2026-11-04',
    periodStart: 1,
    periodEnd: 2,
    topicMaterial: 'Aljabar Dasar - Sesi Draf',
    teacherNotes: 'Catatan draf awal',
    isLocked: false,
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
    ],
  };

  const draftRes = await createJournalAction(createDraftInput);
  const draftJournalId = draftRes.data?.journalId;
  const isDraftOk = Boolean(draftRes.success && draftJournalId && !draftRes.data.isLocked);
  recordTest(
    'JOURNAL_LIFECYCLE',
    'Draft Creation (isLocked: false)',
    isDraftOk,
    draftRes,
    { success: true, isLocked: false },
    `Draft created with id: ${draftJournalId}`
  );

  // Test 1.2: Draft Update (Updating topic and attendance on draft)
  const updateDraftInput = {
    ...createDraftInput,
    journalId: draftJournalId!,
    topicMaterial: 'Aljabar Dasar - Draf Diperbarui',
    isLocked: false,
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.ACTIVE_STAR,
      },
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
    ],
  };

  const draftUpdateRes = await updateJournalAction(updateDraftInput);
  const isDraftUpdateOk = Boolean(draftUpdateRes.success && !draftUpdateRes.data?.isLocked);
  recordTest(
    'JOURNAL_LIFECYCLE',
    'Draft Update Allowed',
    isDraftUpdateOk,
    draftUpdateRes,
    { success: true, isLocked: false },
    'Successfully updated draft topic and engagement badge'
  );

  // Test 1.3: Lock Journal (Explicit locking via lockJournalAction)
  const lockRes = await lockJournalAction(draftJournalId!);
  const isLockedOk = Boolean(lockRes.success && lockRes.data?.isLocked);
  const lockedRecord = memoryStore.classJournals.get(draftJournalId!);
  const hasLockedTag = lockedRecord?.teacherNotes?.includes('[LOCKED]');
  recordTest(
    'JOURNAL_LIFECYCLE',
    'Lock Journal Finalization',
    Boolean(isLockedOk && hasLockedTag),
    { lockRes, notes: lockedRecord?.teacherNotes },
    { isLocked: true, notesContainLocked: true },
    'Journal locked with [LOCKED] tag in teacherNotes'
  );

  // Test 1.4: Adversarial Test A: Attempt to update locked journal with isLocked: false
  // MUST be rejected (success: false)
  const tamperUnlockInput = {
    ...updateDraftInput,
    journalId: draftJournalId!,
    topicMaterial: 'HACKED TOPIC (isLocked: false)',
    isLocked: false,
  };
  const tamperUnlockRes = await updateJournalAction(tamperUnlockInput);
  const isUnlockTamperRejected = !tamperUnlockRes.success;
  recordTest(
    'JOURNAL_LIFECYCLE',
    'Adversarial Tamper: Edit locked journal with isLocked: false',
    isUnlockTamperRejected,
    tamperUnlockRes,
    { success: false },
    isUnlockTamperRejected
      ? 'Correctly rejected unlock tampering attempt'
      : 'VULNERABILITY: Allowed updating locked journal!'
  );

  // Test 1.5: Adversarial Test B: Attempt to update locked journal with isLocked: true
  // Attacker retains isLocked: true while retroactively modifying grades, topic, or attendances.
  // A finalized/locked journal MUST be immutable!
  const tamperWhileLockedInput = {
    ...updateDraftInput,
    journalId: draftJournalId!,
    topicMaterial: 'TAMPERED TOPIC ON LOCKED JOURNAL',
    teacherNotes: 'TAMPERED NOTES',
    isLocked: true,
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.ALPA_BOLOS, // Tampering attendance!
        engagementBadge: EngagementBadge.NO_TASK,
      },
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
    ],
  };
  const tamperWhileLockedRes = await updateJournalAction(tamperWhileLockedInput);
  // An immutable locked journal MUST reject ANY update!
  const isTamperWhileLockedRejected = !tamperWhileLockedRes.success;
  recordTest(
    'JOURNAL_LIFECYCLE',
    'Adversarial Tamper: Retroactive edit on locked journal (passing isLocked: true)',
    isTamperWhileLockedRejected,
    tamperWhileLockedRes,
    { success: false },
    isTamperWhileLockedRejected
      ? 'Strictly rejected tampering on locked journal'
      : 'CRITICAL BUG / VULNERABILITY: updateJournalAction allows editing locked journal if isLocked: true is passed!'
  );

  // Verify whether the record in memory was actually modified by Test 1.5
  const postTamperRecord = memoryStore.classJournals.get(draftJournalId!);
  const topicWasOverwritten = postTamperRecord?.topicMaterial === 'TAMPERED TOPIC ON LOCKED JOURNAL';
  recordTest(
    'JOURNAL_LIFECYCLE',
    'DB Immutability Check: Topic must NOT be overwritten on locked journal',
    !topicWasOverwritten,
    postTamperRecord?.topicMaterial,
    'Aljabar Dasar - Draf Diperbarui',
    topicWasOverwritten
      ? 'VULNERABILITY CONFIRMED: Locked journal topic was overwritten in storage!'
      : 'Topic remained pristine and immutable'
  );

  // ============================================================================
  // SUITE 2: Cross-Layer Bolos Detection in Journal Flow
  // ============================================================================
  console.log('\n--- SUITE 2: Cross-Layer Bolos Detection in Journal Flow ---');

  // Test 2.1: Positive Case: Student A scanned HADIR at gate, but marked ALPA_BOLOS in journal
  memoryStore.gateAttendances.set(`${env.mockStudentA.id}_2026-11-04`, {
    id: 'gate-att-1',
    studentId: env.mockStudentA.id,
    attendanceDate: new Date('2026-11-04T00:00:00.000Z'),
    checkInTime: new Date('2026-11-04T06:45:00.000Z'), // 06:45 WIB
    status: GateStatus.HADIR,
  });

  memoryStore.waNotificationLogs.clear();

  const bolosJournalInput = {
    classId: env.mockClass.id,
    subjectId: env.mockSubject.id,
    teacherId: env.mockTeacher.id,
    journalDate: '2026-11-04',
    periodStart: 3,
    periodEnd: 4,
    topicMaterial: 'Trigonometri - Deteksi Bolos Test',
    isLocked: true,
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.ALPA_BOLOS, // Student A skipped class!
        engagementBadge: EngagementBadge.NO_TASK,
      },
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
    ],
  };

  const bolosJournalRes = await createJournalAction(bolosJournalInput);
  const bolosCount = bolosJournalRes.data?.bolosCount ?? 0;
  const waLogs = Array.from(memoryStore.waNotificationLogs.values());
  const bolosAlertLog = waLogs.find(
    (l) => l.studentId === env.mockStudentA.id && l.notifType === WaNotifType.ABSENT_ALERT
  );

  recordTest(
    'BOLOS_DETECTION',
    'Cross-Layer Truancy Dispatch (Gate HADIR + Subject ALPA_BOLOS)',
    bolosCount === 1 && Boolean(bolosAlertLog),
    { bolosCount, logFound: Boolean(bolosAlertLog), waLogsCount: waLogs.length },
    { bolosCount: 1, logFound: true },
    bolosAlertLog
      ? `Successfully queued ABSENT_ALERT WhatsApp log for ${env.mockStudentA.fullName}`
      : 'FAILED to queue WhatsApp alert for detected bolos student'
  );

  // Test 2.2: TERLAMBAT gate scan + ALPA_BOLOS in classroom should also trigger alert
  memoryStore.gateAttendances.set(`${env.mockStudentB.id}_2026-11-04`, {
    id: 'gate-att-2',
    studentId: env.mockStudentB.id,
    attendanceDate: new Date('2026-11-04T00:00:00.000Z'),
    checkInTime: new Date('2026-11-04T07:15:00.000Z'), // 07:15 WIB (Terlambat)
    status: GateStatus.TERLAMBAT,
    lateMinutes: 15,
  });
  memoryStore.parentStudentLinks.set(env.mockStudentB.id, {
    studentId: env.mockStudentB.id,
    receiveWaNotif: true,
    parent: { fullName: 'Ayah Bambang', phoneWa: '081299990002' },
  });
  memoryStore.waNotificationLogs.clear();

  const bolosLateJournalInput = {
    ...bolosJournalInput,
    periodStart: 5,
    periodEnd: 6,
    topicMaterial: 'Trigonometri - Deteksi Bolos Terlambat',
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.HADIR,
        engagementBadge: EngagementBadge.GOOD,
      },
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.ALPA_BOLOS, // Student B skipped after arriving late!
        engagementBadge: EngagementBadge.NO_TASK,
      },
    ],
  };

  const bolosLateRes = await createJournalAction(bolosLateJournalInput);
  const bolosLateCount = bolosLateRes.data?.bolosCount ?? 0;
  const waLateLog = Array.from(memoryStore.waNotificationLogs.values()).find(
    (l) => l.studentId === env.mockStudentB.id && l.notifType === WaNotifType.ABSENT_ALERT
  );

  recordTest(
    'BOLOS_DETECTION',
    'Cross-Layer Truancy Dispatch (Gate TERLAMBAT + Subject ALPA_BOLOS)',
    bolosLateCount === 1 && Boolean(waLateLog),
    { bolosLateCount, logFound: Boolean(waLateLog) },
    { bolosLateCount: 1, logFound: true },
    'Successfully detected bolos for student arriving late at gate'
  );

  // Test 2.3: Control Case A: Gate SAKIT + Subject ALPA_BOLOS -> MUST NOT DISPATCH ALERT
  memoryStore.gateAttendances.set(`${env.mockStudentA.id}_2026-11-05`, {
    id: 'gate-att-3',
    studentId: env.mockStudentA.id,
    attendanceDate: new Date('2026-11-05T00:00:00.000Z'),
    checkInTime: null,
    status: GateStatus.SAKIT,
  });
  memoryStore.waNotificationLogs.clear();

  const controlSakitInput = {
    ...bolosJournalInput,
    journalDate: '2026-11-05',
    topicMaterial: 'Control Case - Gate Sakit',
    attendances: [
      {
        studentId: env.mockStudentA.id,
        status: SubjectStatus.ALPA_BOLOS,
        engagementBadge: EngagementBadge.NO_TASK,
      },
    ],
  };

  const controlSakitRes = await createJournalAction(controlSakitInput);
  const controlSakitCount = controlSakitRes.data?.bolosCount ?? 0;
  const noLogGeneratedA = memoryStore.waNotificationLogs.size === 0;

  recordTest(
    'BOLOS_DETECTION',
    'Control Case: Gate SAKIT + Subject ALPA_BOLOS -> No Alert',
    controlSakitCount === 0 && noLogGeneratedA,
    { controlSakitCount, logsCount: memoryStore.waNotificationLogs.size },
    { controlSakitCount: 0, logsCount: 0 },
    noLogGeneratedA
      ? 'Correct: No bolos alert dispatched when student had GateStatus.SAKIT'
      : 'ERROR: False positive bolos alert was dispatched for sick student'
  );

  // Test 2.4: Control Case B: Unscanned Gate (No Gate Record) + Subject ALPA_BOLOS -> MUST NOT DISPATCH ALERT
  memoryStore.gateAttendances.delete(`${env.mockStudentB.id}_2026-11-05`);
  memoryStore.waNotificationLogs.clear();

  const controlNoGateInput = {
    ...bolosJournalInput,
    journalDate: '2026-11-05',
    topicMaterial: 'Control Case - Unscanned Gate',
    attendances: [
      {
        studentId: env.mockStudentB.id,
        status: SubjectStatus.ALPA_BOLOS,
        engagementBadge: EngagementBadge.NO_TASK,
      },
    ],
  };

  const controlNoGateRes = await createJournalAction(controlNoGateInput);
  const controlNoGateCount = controlNoGateRes.data?.bolosCount ?? 0;
  const noLogGeneratedB = memoryStore.waNotificationLogs.size === 0;

  recordTest(
    'BOLOS_DETECTION',
    'Control Case: Unscanned Gate + Subject ALPA_BOLOS -> No Alert',
    controlNoGateCount === 0 && noLogGeneratedB,
    { controlNoGateCount, logsCount: memoryStore.waNotificationLogs.size },
    { controlNoGateCount: 0, logsCount: 0 },
    noLogGeneratedB
      ? 'Correct: No false positive bolos alert for student absent from gate'
      : 'ERROR: Dispatched bolos alert when student never arrived at gate'
  );

  // ============================================================================
  // SUITE 3: Activity Feed Privacy & Audience Scoping
  // ============================================================================
  console.log('\n--- SUITE 3: Activity Feed Privacy & Audience Scoping ---');

  // Test 3.1: Unit Scoping Invariant: CLASS_PUBLIC photo is visible to Student A
  const photoPublic = {
    visibility: DocVisibility.CLASS_PUBLIC,
    taggedStudentIds: [],
  };
  const isPublicVisible = isPhotoVisibleToStudent(photoPublic, env.mockStudentA.id);
  recordTest(
    'PRIVACY_SCOPING',
    'CLASS_PUBLIC Photo Visible to Any Class Student',
    isPublicVisible === true,
    isPublicVisible,
    true,
    'CLASS_PUBLIC photo is visible to student A'
  );

  // Test 3.2: Unit Scoping Invariant: TAGGED_STUDENTS_ONLY tagged with Student A
  const photoTaggedA = {
    visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
    taggedStudentIds: [env.mockStudentA.id],
  };
  const isTaggedAVisible = isPhotoVisibleToStudent(photoTaggedA, env.mockStudentA.id);
  recordTest(
    'PRIVACY_SCOPING',
    'TAGGED_STUDENTS_ONLY Photo Visible to Tagged Student A',
    isTaggedAVisible === true,
    isTaggedAVisible,
    true,
    'Tagged student A can view their remedial photo'
  );

  // Test 3.3: Unit Scoping Invariant: TAGGED_STUDENTS_ONLY tagged with Student B ONLY
  const photoTaggedBOnly = {
    visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
    taggedStudentIds: [env.mockStudentB.id],
  };
  const isTaggedBVisibleToA = isPhotoVisibleToStudent(photoTaggedBOnly, env.mockStudentA.id);
  recordTest(
    'PRIVACY_SCOPING',
    'TAGGED_STUDENTS_ONLY Photo Tagged with B ONLY is Hidden from A',
    isTaggedBVisibleToA === false,
    isTaggedBVisibleToA,
    false,
    isTaggedBVisibleToA === false
      ? 'Student B photo strictly hidden from Student A (Privacy preserved)'
      : 'PRIVACY LEAK: Student A could see student B tagged photo!'
  );

  // Test 3.4: Adversarial Test on getStudentActivityTimeline:
  memoryStore.classJournals.clear();
  memoryStore.subjectAttendances.clear();
  memoryStore.documentations.clear();
  memoryStore.gateAttendances.clear();

  const testDate = new Date('2026-11-04T00:00:00.000Z');

  // Gate Check-in for Student A
  memoryStore.gateAttendances.set(`${env.mockStudentA.id}_2026-11-04`, {
    id: 'gate-timeline-1',
    studentId: env.mockStudentA.id,
    attendanceDate: testDate,
    checkInTime: new Date('2026-11-04T06:48:00.000Z'),
    checkOutTime: null,
    status: GateStatus.HADIR,
    lateMinutes: 0,
  });

  // Journal 1: Locked & Published
  const lockedJournalId = '12121212-1212-4212-8212-121212121212';
  memoryStore.classJournals.set(lockedJournalId, {
    id: lockedJournalId,
    classId: env.mockClass.id,
    subjectId: env.mockSubject.id,
    teacherId: env.mockTeacher.id,
    journalDate: testDate,
    periodStart: 1,
    periodEnd: 2,
    topicMaterial: 'Bab 1 - Persamaan Kuadrat (Terkunci)',
    teacherNotes: '[LOCKED] Materi telah selesai',
  });
  memoryStore.subjectAttendances.set(`${lockedJournalId}_${env.mockStudentA.id}`, {
    id: 'att-lock-a',
    journalId: lockedJournalId,
    studentId: env.mockStudentA.id,
    status: SubjectStatus.HADIR,
    engagementBadge: EngagementBadge.ACTIVE_STAR,
    note: 'Sangat aktif di sesi terkunci',
  });
  // Photo public
  memoryStore.documentations.set('doc-pub-1', {
    id: 'doc-pub-1',
    journalId: lockedJournalId,
    imageUrl: 'https://images.school.sch.id/pub1.webp',
    caption: 'Foto Belajar Publik',
    visibility: DocVisibility.CLASS_PUBLIC,
    taggedStudentIds: [],
    fileSizeKb: 120,
  });
  // Photo tagged to B only
  memoryStore.documentations.set('doc-priv-b', {
    id: 'doc-priv-b',
    journalId: lockedJournalId,
    imageUrl: 'https://images.school.sch.id/priv-b.webp',
    caption: 'Foto Remedial Siswa B',
    visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
    taggedStudentIds: [env.mockStudentB.id],
    fileSizeKb: 135,
  });

  // Journal 2: UNLOCKED DRAFT (isLocked: false, no [LOCKED] tag)
  const draftJournalId2 = '13131313-1313-4313-8313-131313131313';
  memoryStore.classJournals.set(draftJournalId2, {
    id: draftJournalId2,
    classId: env.mockClass.id,
    subjectId: env.mockSubject.id,
    teacherId: env.mockTeacher.id,
    journalDate: testDate,
    periodStart: 3,
    periodEnd: 4,
    topicMaterial: 'Bab 2 - Draf Belum Selesai (DRAFT)',
    teacherNotes: 'Catatan internal guru - belum publikasi',
  });
  memoryStore.subjectAttendances.set(`${draftJournalId2}_${env.mockStudentA.id}`, {
    id: 'att-draft-a',
    journalId: draftJournalId2,
    studentId: env.mockStudentA.id,
    status: SubjectStatus.HADIR,
    engagementBadge: EngagementBadge.GOOD,
    note: 'Catatan draf',
  });

  // Execute getStudentActivityTimeline for Student A
  const timelineResult = await getStudentActivityTimeline(env.mockStudentA.id, {
    dateFrom: '2026-11-04',
    dateTo: '2026-11-04',
    limitDays: 1,
  });

  const dayTimeline = timelineResult[0];
  const sessionItems = dayTimeline?.timeline.filter((i) => i.type === 'CLASS_SESSION') || [];
  const lockedSession = sessionItems.find((s) => s.id === `journal-${lockedJournalId}`);
  const draftSession = sessionItems.find((s) => s.id === `journal-${draftJournalId2}`);

  // Test 3.4a: Locked journal MUST appear
  recordTest(
    'TIMELINE_SCOPING',
    'Locked Journal Appears in Student Activity Timeline',
    Boolean(lockedSession),
    Boolean(lockedSession),
    true,
    lockedSession
      ? `Locked session found: "${lockedSession.title}"`
      : 'Locked session missing from timeline'
  );

  // Test 3.4b: Unlocked Draft Journal MUST BE EXCLUDED from Timeline!
  const isDraftExcluded = !draftSession;
  recordTest(
    'TIMELINE_SCOPING',
    'Unlocked Draft Journal MUST Be Excluded from Student Timeline',
    isDraftExcluded,
    Boolean(draftSession),
    false,
    isDraftExcluded
      ? 'Correct: Unlocked draft journal is excluded from timeline'
      : 'DATA LEAK / INVARIANT BREACH: Unlocked draft journal appears on student/parent activity feed!'
  );

  // Test 3.4c: Privacy in Timeline: Photo tagged only for Student B MUST NOT appear in Student A's session
  const lockedSessionPhotos = lockedSession?.details?.photos || [];
  const hasPublicPhoto = lockedSessionPhotos.some((p) => p.id === 'doc-pub-1');
  const hasPrivateBPhoto = lockedSessionPhotos.some((p) => p.id === 'doc-priv-b');

  recordTest(
    'TIMELINE_SCOPING',
    'CLASS_PUBLIC Photo Appears in Timeline Session for Student A',
    hasPublicPhoto,
    hasPublicPhoto,
    true,
    'Public photo included in timeline item'
  );

  recordTest(
    'TIMELINE_SCOPING',
    'TAGGED_STUDENTS_ONLY Photo for B is Filtered Out in Student A Timeline',
    !hasPrivateBPhoto,
    hasPrivateBPhoto,
    false,
    !hasPrivateBPhoto
      ? 'Student B photo strictly excluded from Student A timeline item'
      : 'PRIVACY LEAK: Private photo of Student B leaked to Student A timeline!'
  );

  console.log('\n=== RUNNER SUMMARY ===');
  const total = runnerResults.length;
  const passed = runnerResults.filter((r) => r.passed).length;
  const failed = runnerResults.filter((r) => !r.passed).length;
  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);

  // Output structured JSON for python orchestrator
  console.log('\n__RUNNER_JSON_START__');
  console.log(JSON.stringify(runnerResults, null, 2));
  console.log('__RUNNER_JSON_END__');
}

runAdversarialStressTests().catch((err) => {
  console.error('FATAL UNCAUGHT ERROR IN ADVERSARIAL RUNNER:', err);
  process.exit(1);
});
