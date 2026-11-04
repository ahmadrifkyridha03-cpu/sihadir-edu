/**
 * Adversarial TypeScript Test Runner for Milestone 3 Attendance Engine & Anti-Fraud
 * Invoked by tests/test_m3_leave_cascade_adversarial.py
 */

import {
  LeaveType,
  GateStatus,
  SubjectStatus,
  ApprovalStatus,
  Role,
} from '@prisma/client';

interface TestReportItem {
  id: string;
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details: string;
}

const reports: TestReportItem[] = [];

function check(
  id: string,
  name: string,
  passed: boolean,
  expected: any,
  actual: any,
  details: string
) {
  reports.push({ id, name, passed, expected, actual, details });
}

async function run() {
  // ============================================================================
  // 1. DYNAMIC MOCK DB SETUP BEFORE IMPORTING src/lib/leave
  // ============================================================================
  const mockCalls: {
    leaveRequestUpdates: any[];
    gateUpserts: any[];
    subjectUpdateManys: any[];
    findJournals: any[];
  } = {
    leaveRequestUpdates: [],
    gateUpserts: [],
    subjectUpdateManys: [],
    findJournals: [],
  };

  // State storage for mock DB
  const mockUsers: Record<string, any> = {
    'user-wali-1': {
      id: 'user-wali-1',
      role: Role.TEACHER,
      teacher: { id: 'teacher-wali-1', fullName: 'Budi Santoso, S.Pd', phoneWa: '081234567801' },
    },
    'user-other-teacher': {
      id: 'user-other-teacher',
      role: Role.TEACHER,
      teacher: { id: 'teacher-other-2', fullName: 'Siti Aminah, M.Pd', phoneWa: '081234567802' },
    },
    'user-teacher-no-homeroom': {
      id: 'user-teacher-no-homeroom',
      role: Role.TEACHER,
      teacher: { id: 'teacher-no-hr-3', fullName: 'Rudi Hartono, S.Kom', phoneWa: '081234567803' },
    },
    'user-admin-1': {
      id: 'user-admin-1',
      role: Role.ADMIN,
      teacher: null,
    },
    'user-parent-1': {
      id: 'user-parent-1',
      role: Role.PARENT,
      teacher: null,
    },
    'user-student-1': {
      id: 'user-student-1',
      role: Role.STUDENT,
      teacher: null,
    },
  };

  const mockClasses: Record<string, any> = {
    'class-x-ipa-1': {
      id: 'class-x-ipa-1',
      className: 'X-IPA-1',
      homeroomTeacherId: 'teacher-wali-1',
    },
    'class-x-ipa-2': {
      id: 'class-x-ipa-2',
      className: 'X-IPA-2',
      homeroomTeacherId: 'teacher-other-2',
    },
  };

  const mockLeaveRequests: Record<string, any> = {
    'leave-sakit-multi': {
      id: 'leave-sakit-multi',
      studentId: 'student-101',
      parentId: 'parent-101',
      startDate: new Date('2026-11-06T00:00:00.000Z'), // Friday
      endDate: new Date('2026-11-09T00:00:00.000Z'),   // Monday (spans Sat & Sun)
      leaveType: LeaveType.SAKIT,
      reason: 'Demam tinggi dan istirahat dokter',
      attachmentUrl: 'https://cloudinary.com/doctor_note.webp',
      approvalStatus: ApprovalStatus.PENDING,
      approvedById: null,
      student: {
        id: 'student-101',
        classId: 'class-x-ipa-1',
        fullName: 'Ahmad Fauzi',
        class: mockClasses['class-x-ipa-1'],
        parentLinks: [
          {
            receiveWaNotif: true,
            parent: { id: 'parent-101', fullName: 'Fauzi Senior', phoneWa: '0811111111' },
          },
        ],
      },
      parent: { id: 'parent-101', fullName: 'Fauzi Senior', phoneWa: '0811111111' },
    },
    'leave-izin-multi': {
      id: 'leave-izin-multi',
      studentId: 'student-102',
      parentId: 'parent-102',
      startDate: new Date('2026-11-07T00:00:00.000Z'), // Saturday
      endDate: new Date('2026-11-09T00:00:00.000Z'),   // Monday (spans Sun)
      leaveType: LeaveType.IZIN,
      reason: 'Acara keluarga di luar kota',
      attachmentUrl: null,
      approvalStatus: ApprovalStatus.PENDING,
      approvedById: null,
      student: {
        id: 'student-102',
        classId: 'class-x-ipa-1',
        fullName: 'Citra Lestari',
        class: mockClasses['class-x-ipa-1'],
        parentLinks: [
          {
            receiveWaNotif: true,
            parent: { id: 'parent-102', fullName: 'Lestari Ibu', phoneWa: '0811111112' },
          },
        ],
      },
      parent: { id: 'parent-102', fullName: 'Lestari Ibu', phoneWa: '0811111112' },
    },
    'leave-already-approved': {
      id: 'leave-already-approved',
      studentId: 'student-103',
      parentId: 'parent-103',
      startDate: new Date('2026-11-04T00:00:00.000Z'),
      endDate: new Date('2026-11-05T00:00:00.000Z'),
      leaveType: LeaveType.SAKIT,
      reason: 'Flu',
      approvalStatus: ApprovalStatus.APPROVED,
      student: {
        id: 'student-103',
        classId: 'class-x-ipa-1',
        fullName: 'Budi Santoso',
        class: mockClasses['class-x-ipa-1'],
        parentLinks: [],
      },
      parent: { id: 'parent-103', fullName: 'Santoso Ayah', phoneWa: '0811111113' },
    },
  };

  // Mock Prisma Client
  const mockPrisma = {
    user: {
      findUnique: async (args: any) => mockUsers[args.where.id] ?? null,
    },
    class: {
      findUnique: async (args: any) => mockClasses[args.where.id] ?? null,
    },
    leaveRequest: {
      findUnique: async (args: any) => mockLeaveRequests[args.where.id] ?? null,
      update: async (args: any) => {
        mockCalls.leaveRequestUpdates.push(args);
        return { ...mockLeaveRequests[args.where.id], ...args.data };
      },
    },
    $transaction: async (callback: any) => {
      // Transaction context mocks
      const tx = {
        leaveRequest: {
          update: async (args: any) => {
            mockCalls.leaveRequestUpdates.push(args);
            return { ...mockLeaveRequests[args.where.id], ...args.data };
          },
        },
        gateAttendance: {
          upsert: async (args: any) => {
            mockCalls.gateUpserts.push(args);
            return args;
          },
        },
        classJournal: {
          findMany: async (args: any) => {
            mockCalls.findJournals.push(args);
            // Simulate that Friday Nov 6 has 2 journals: MTK & BIN
            const reqDate = args.where.journalDate.toISOString().split('T')[0];
            if (reqDate === '2026-11-06') {
              return [{ id: 'journal-fri-mtk' }, { id: 'journal-fri-bin' }];
            }
            if (reqDate === '2026-11-09') {
              return [{ id: 'journal-mon-ipa' }];
            }
            return [];
          },
        },
        subjectAttendance: {
          updateMany: async (args: any) => {
            mockCalls.subjectUpdateManys.push(args);
            return { count: 1 };
          },
        },
      };
      return await callback(tx);
    },
  };

  // Set global singleton before dynamic import
  (globalThis as any).prismaGlobal = mockPrisma;

  // Import modules dynamically so they receive the mocked Prisma client
  const { getSchoolDaysInRange, assertReviewerAuthorization, approveLeaveRequest } =
    await import('../src/lib/leave');
  const { getWibNow, normalizeDateOnly } = await import('../src/lib/timezone');

  // ============================================================================
  // TEST SECTION 1: getSchoolDaysInRange ADVERSARIAL STRESS TEST
  // ============================================================================
  console.log('--- Executing getSchoolDaysInRange Tests ---');

  // Test 1.1: Fri to Mon (Nov 6 to Nov 9 2026) -> Fri (6), Sat (7), Mon (9). Sun (8) skipped!
  const fri = new Date('2026-11-06T00:00:00.000Z');
  const mon = new Date('2026-11-09T00:00:00.000Z');
  const daysFriMon = getSchoolDaysInRange(fri, mon);
  const formattedFriMon = daysFriMon.map((d) => d.toISOString().split('T')[0]);
  check(
    'TC_SCHOOL_DAYS_01',
    'Skip Sunday across Friday to Monday range',
    daysFriMon.length === 3 &&
      formattedFriMon.includes('2026-11-06') &&
      formattedFriMon.includes('2026-11-07') &&
      formattedFriMon.includes('2026-11-09') &&
      !formattedFriMon.includes('2026-11-08'),
    ['2026-11-06', '2026-11-07', '2026-11-09'],
    formattedFriMon,
    'Sunday 2026-11-08 must be omitted from school days'
  );

  // Test 1.2: Single Sunday date (Nov 8 to Nov 8) -> returns []
  const sun = new Date('2026-11-08T00:00:00.000Z');
  const daysSunOnly = getSchoolDaysInRange(sun, sun);
  check(
    'TC_SCHOOL_DAYS_02',
    'Single day on Sunday returns empty array',
    daysSunOnly.length === 0,
    0,
    daysSunOnly.length,
    'Sunday alone produces 0 school days'
  );

  // Test 1.3: Start on Sunday (Nov 8 to Nov 10) -> returns [Mon Nov 9, Tue Nov 10]
  const tue = new Date('2026-11-10T00:00:00.000Z');
  const daysSunTue = getSchoolDaysInRange(sun, tue);
  const formattedSunTue = daysSunTue.map((d) => d.toISOString().split('T')[0]);
  check(
    'TC_SCHOOL_DAYS_03',
    'Range starting on Sunday skips leading Sunday',
    daysSunTue.length === 2 &&
      formattedSunTue[0] === '2026-11-09' &&
      formattedSunTue[1] === '2026-11-10',
    ['2026-11-09', '2026-11-10'],
    formattedSunTue,
    'Leading Sunday properly bypassed'
  );

  // Test 1.4: 14-day multi-week range (Nov 2 to Nov 15) -> 14 calendar days, exactly 2 Sundays (Nov 8 & 15) skipped -> 12 days
  const start14 = new Date('2026-11-02T00:00:00.000Z');
  const end14 = new Date('2026-11-15T00:00:00.000Z');
  const days14 = getSchoolDaysInRange(start14, end14);
  const sundaysIncluded = days14.filter((d) => d.getUTCDay() === 0);
  check(
    'TC_SCHOOL_DAYS_04',
    '14-day leave skips exactly 2 Sundays (12 school days)',
    days14.length === 12 && sundaysIncluded.length === 0,
    { total: 12, sundays: 0 },
    { total: days14.length, sundays: sundaysIncluded.length },
    'All Sundays in multi-week span correctly excluded'
  );

  // Test 1.5: Inverted range (start > end) -> returns []
  const inverted = getSchoolDaysInRange(tue, fri);
  check(
    'TC_SCHOOL_DAYS_05',
    'Inverted date range returns empty array',
    inverted.length === 0,
    0,
    inverted.length,
    'No dates produced when startDate > endDate'
  );

  // ============================================================================
  // TEST SECTION 2: REVIEWER AUTHORIZATION MATRIX
  // ============================================================================
  console.log('--- Executing assertReviewerAuthorization Tests ---');

  // Case 2.1: Homeroom teacher of student class
  const authWali = await assertReviewerAuthorization('user-wali-1', 'class-x-ipa-1');
  check(
    'TC_AUTH_01',
    'Assigned Homeroom Teacher (Wali Kelas) is authorized',
    authWali.authorized === true && authWali.reviewerTeacherId === 'teacher-wali-1',
    { authorized: true, teacherId: 'teacher-wali-1' },
    { authorized: authWali.authorized, teacherId: authWali.reviewerTeacherId },
    'Wali Kelas has legitimate authority'
  );

  // Case 2.2: Teacher of DIFFERENT class
  const authOther = await assertReviewerAuthorization('user-other-teacher', 'class-x-ipa-1');
  check(
    'TC_AUTH_02',
    'Teacher of different class is strictly REJECTED',
    authOther.authorized === false && authOther.error?.includes('bukan Wali Kelas') === true,
    false,
    authOther.authorized,
    `Error returned: ${authOther.error}`
  );

  // Case 2.3: Teacher without homeroom class
  const authNoHr = await assertReviewerAuthorization('user-teacher-no-homeroom', 'class-x-ipa-1');
  check(
    'TC_AUTH_03',
    'Non-homeroom teacher is strictly REJECTED',
    authNoHr.authorized === false && authNoHr.error?.includes('bukan Wali Kelas') === true,
    false,
    authNoHr.authorized,
    `Error returned: ${authNoHr.error}`
  );

  // Case 2.4: System Admin
  const authAdmin = await assertReviewerAuthorization('user-admin-1', 'class-x-ipa-1');
  check(
    'TC_AUTH_04',
    'System Admin has supervisory authority over all classes',
    authAdmin.authorized === true,
    true,
    authAdmin.authorized,
    'Admin bypass confirmed'
  );

  // Case 2.5: Parent User
  const authParent = await assertReviewerAuthorization('user-parent-1', 'class-x-ipa-1');
  check(
    'TC_AUTH_05',
    'Parent user cannot approve leave requests',
    authParent.authorized === false && authParent.error?.includes('Akses ditolak') === true,
    false,
    authParent.authorized,
    'Parent privilege escalation prevented'
  );

  // Case 2.6: Student User
  const authStudent = await assertReviewerAuthorization('user-student-1', 'class-x-ipa-1');
  check(
    'TC_AUTH_06',
    'Student user cannot approve leave requests',
    authStudent.authorized === false && authStudent.error?.includes('Akses ditolak') === true,
    false,
    authStudent.authorized,
    'Student privilege escalation prevented'
  );

  // Case 2.7: Non-existent User
  const authNonExistent = await assertReviewerAuthorization('user-unknown-999', 'class-x-ipa-1');
  check(
    'TC_AUTH_07',
    'Non-existent user is rejected',
    authNonExistent.authorized === false &&
      authNonExistent.error?.includes('tidak ditemukan') === true,
    false,
    authNonExistent.authorized,
    'Missing user safety confirmed'
  );

  // ============================================================================
  // TEST SECTION 3: MULTI-DAY LEAVE APPROVAL CASCADE & ATOMIC TRANSACTION
  // ============================================================================
  console.log('--- Executing approveLeaveRequest Cascade Tests ---');

  // Reset call history
  mockCalls.gateUpserts = [];
  mockCalls.subjectUpdateManys = [];
  mockCalls.leaveRequestUpdates = [];

  // Case 3.1: Approve multi-day sick leave (Fri Nov 6 to Mon Nov 9, student-101)
  const approveRes = await approveLeaveRequest(
    'leave-sakit-multi',
    'user-wali-1',
    'Surat dokter terverifikasi'
  );

  check(
    'TC_CASCADE_01',
    'approveLeaveRequest returns success: true',
    approveRes.success === true,
    true,
    approveRes.success,
    `Result: ${JSON.stringify(approveRes)}`
  );

  // Check GateAttendance upserts
  const upsertDates = mockCalls.gateUpserts.map((u) =>
    u.where.studentId_attendanceDate.attendanceDate.toISOString().split('T')[0]
  );

  check(
    'TC_CASCADE_02',
    'GateAttendance upserted for Fri, Sat, Mon (Sunday skipped)',
    mockCalls.gateUpserts.length === 3 &&
      upsertDates.includes('2026-11-06') &&
      upsertDates.includes('2026-11-07') &&
      upsertDates.includes('2026-11-09') &&
      !upsertDates.includes('2026-11-08'),
    ['2026-11-06', '2026-11-07', '2026-11-09'],
    upsertDates,
    'Exactly 3 gate attendances upserted, Sunday strictly omitted'
  );

  // Check GateAttendance upsert payload integrity
  const allUpsertsStatusSakit = mockCalls.gateUpserts.every(
    (u) =>
      u.create.status === GateStatus.SAKIT &&
      u.update.status === GateStatus.SAKIT &&
      u.create.studentId === 'student-101' &&
      u.create.lateMinutes === 0 &&
      u.create.scannedBy === 'LEAVE_APPROVAL:teacher-wali-1' &&
      u.update.scannedBy === 'LEAVE_APPROVAL:teacher-wali-1'
  );

  check(
    'TC_CASCADE_03',
    'GateAttendance upserts carry SAKIT status and audit tag LEAVE_APPROVAL:<id>',
    allUpsertsStatusSakit,
    true,
    allUpsertsStatusSakit,
    'Gate upserts have status=SAKIT and audit scannedBy'
  );

  // Check Retroactive SubjectAttendance update
  // We configured journals on 2026-11-06 (Fri) and 2026-11-09 (Mon)
  check(
    'TC_CASCADE_04',
    'Retroactive SubjectAttendance ALPA_BOLOS -> SAKIT update invoked',
    mockCalls.subjectUpdateManys.length >= 1,
    true,
    mockCalls.subjectUpdateManys.length >= 1,
    `subjectAttendance.updateMany was called ${mockCalls.subjectUpdateManys.length} times`
  );

  if (mockCalls.subjectUpdateManys.length > 0) {
    const firstUpdate = mockCalls.subjectUpdateManys[0];
    check(
      'TC_CASCADE_05',
      'SubjectAttendance update updates ALPA_BOLOS to SAKIT with note',
      firstUpdate.where.status === SubjectStatus.ALPA_BOLOS &&
        firstUpdate.where.studentId === 'student-101' &&
        firstUpdate.data.status === SubjectStatus.SAKIT &&
        firstUpdate.data.note?.includes('Surat dokter terverifikasi'),
      {
        targetStudent: 'student-101',
        fromStatus: SubjectStatus.ALPA_BOLOS,
        toStatus: SubjectStatus.SAKIT,
      },
      {
        targetStudent: firstUpdate.where.studentId,
        fromStatus: firstUpdate.where.status,
        toStatus: firstUpdate.data.status,
      },
      'Retroactive truancy correction verified'
    );
  }

  // Case 3.2: Re-approving already approved leave is rejected
  const reApproveRes = await approveLeaveRequest(
    'leave-already-approved',
    'user-wali-1'
  );
  const reApproveError = !reApproveRes.success ? reApproveRes.error : undefined;
  check(
    'TC_CASCADE_06',
    'Already approved leave is rejected idempotently',
    reApproveRes.success === false &&
      reApproveError?.includes('sudah disetujui') === true,
    false,
    reApproveRes.success,
    `Error returned: ${reApproveError}`
  );

  // Case 3.3: IZIN leave produces GateStatus.IZIN
  mockCalls.gateUpserts = [];
  const approveIzinRes = await approveLeaveRequest('leave-izin-multi', 'user-wali-1');
  const allUpsertsStatusIzin = mockCalls.gateUpserts.every(
    (u) =>
      u.create.status === GateStatus.IZIN &&
      u.update.status === GateStatus.IZIN &&
      u.create.studentId === 'student-102'
  );
  check(
    'TC_CASCADE_07',
    'Permission leave (IZIN) produces GateStatus.IZIN',
    approveIzinRes.success === true && allUpsertsStatusIzin,
    true,
    approveIzinRes.success && allUpsertsStatusIzin,
    'Gate status IZIN mapping verified'
  );

  // ============================================================================
  // TEST SECTION 4: TIMEZONE & DATE BOUNDARY EMPIRICAL INVARIANTS
  // ============================================================================
  console.log('--- Executing Timezone & Date Boundary Tests ---');

  // Morning hours in WIB (UTC+7):
  // 06:00 WIB = 23:00 UTC previous day
  // 06:30 WIB = 23:30 UTC previous day
  // 07:00 WIB = 00:00 UTC current day
  // 10:00 WIB = 03:00 UTC current day

  // 4.1: getWibNow with 06:00 WIB Date
  const d0600 = new Date('2026-11-04T06:00:00+07:00');
  const wib0600 = getWibNow(d0600);
  check(
    'TC_TZ_01',
    'getWibNow at 06:00 WIB maps to correct Indonesian calendar date (2026-11-04)',
    wib0600.dateString === '2026-11-04' &&
      wib0600.hours === 6 &&
      wib0600.minutes === 0 &&
      wib0600.minutesFromMidnight === 360,
    { date: '2026-11-04', hours: 6, mins: 360 },
    { date: wib0600.dateString, hours: wib0600.hours, mins: wib0600.minutesFromMidnight },
    'getWibNow preserves Indonesian date across UTC midnight offset'
  );

  // 4.2: getWibNow at 07:00 WIB
  const d0700 = new Date('2026-11-04T07:00:00+07:00');
  const wib0700 = getWibNow(d0700);
  check(
    'TC_TZ_02',
    'getWibNow at 07:00 WIB threshold maps to 420 minutes from midnight',
    wib0700.dateString === '2026-11-04' &&
      wib0700.hours === 7 &&
      wib0700.minutes === 0 &&
      wib0700.minutesFromMidnight === 420,
    { date: '2026-11-04', hours: 7, mins: 420 },
    { date: wib0700.dateString, hours: wib0700.hours, mins: wib0700.minutesFromMidnight },
    '07:00 WIB threshold calculation validated'
  );

  // 4.3: normalizeDateOnly with string inputs
  const normStr = normalizeDateOnly('2026-11-04');
  const normStrIso = normalizeDateOnly('2026-11-04T06:30:00+07:00');
  check(
    'TC_TZ_03',
    'normalizeDateOnly with string inputs produces exact UTC midnight 2026-11-04T00:00:00.000Z',
    normStr.toISOString() === '2026-11-04T00:00:00.000Z' &&
      normStrIso.toISOString() === '2026-11-04T00:00:00.000Z',
    '2026-11-04T00:00:00.000Z',
    normStr.toISOString(),
    'String date normalization verified'
  );

  // 4.4: EMPIRICAL DEFECT PROBE: normalizeDateOnly with Date object at 06:00 WIB
  // d0600 is 2026-11-04T06:00:00+07:00 (which is 2026-11-03T23:00:00Z in UTC)
  const normDateObj0600 = normalizeDateOnly(d0600);
  const shiftedBack = normDateObj0600.toISOString() === '2026-11-03T00:00:00.000Z';
  check(
    'TC_TZ_04_DEFECT_PROBE',
    'PROBE: normalizeDateOnly(Date) at 06:00 WIB shifts back to previous day (2026-11-03)',
    shiftedBack,
    '2026-11-03T00:00:00.000Z (shifted)',
    normDateObj0600.toISOString(),
    'DEFECT CONFIRMED: When normalizeDateOnly receives a Date instance between 00:00-06:59 WIB, it shifts to UTC previous day'
  );

  // Output all results in JSON for Python harness consumption
  console.log('\n--- JSON_REPORT_OUTPUT_BEGIN ---');
  console.log(JSON.stringify(reports, null, 2));
  console.log('--- JSON_REPORT_OUTPUT_END ---');
}

run().catch((err) => {
  console.error('Fatal error in runner:', err);
  process.exit(1);
});
