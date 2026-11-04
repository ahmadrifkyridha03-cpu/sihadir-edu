/**
 * ADVERSARIAL STRESS TEST HARNESS — MILESTONE 7
 * Author: challenger_m7_2 (EMPIRICAL CHALLENGER - critic, specialist)
 * Target Scope:
 *  1. Dapodik Form 8355 Recap Matrix: Pathological calendar edge-cases (0 effective days, all-Sunday, all-holiday, empty class)
 *  2. Early Warning System (EWS): 5 Invariants, strict boundary transitions (89.5% vs 90.0%, 80.0% vs 85.0%), clamping [0, 100]
 *  3. Multi-day Leave Cascades: Retroactive synchronization of Gate ALPA and Subject ALPA_BOLOS to SAKIT/IZIN
 *  4. Parent Portal PIN Rate Limiting & Sibling Switcher: 5-attempt lockout (15 mins) and cross-tenant isolation
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

// 1. Setup in-memory DB proxy before loading domain code
import { inMemoryDb } from './e2e/mocks/in-memory-db';
(globalThis as any).prismaGlobal = inMemoryDb;

// Patch inMemoryDb to support nested assessment relation filter in matchesWhere and include.user in enrichIncludes
const origMatchesWhere = (inMemoryDb as any).matchesWhere.bind(inMemoryDb);
(inMemoryDb as any).matchesWhere = function (item: any, where: any) {
  if (!where) return true;
  if (where.assessment && item && item.assessmentId) {
    const ass = this.assessments.find((a: any) => a.id === item.assessmentId);
    if (!ass || !this.matchesWhere(ass, where.assessment)) return false;
    const rest = { ...where };
    delete rest.assessment;
    return this.matchesWhere(item, rest);
  }
  return origMatchesWhere(item, where);
};

const origEnrichIncludes = (inMemoryDb as any).enrichIncludes.bind(inMemoryDb);
(inMemoryDb as any).enrichIncludes = function (item: any, include?: any) {
  if (!item || !include) return item;
  const res = origEnrichIncludes(item, include);
  if (include.user && res.userId) {
    res.user = this.users.find((u: any) => u.id === res.userId) || null;
  }
  return res;
};

// 2. Setup mock for next/headers cookie store
const nextHeaders = require('next/headers');
const cookieJar = new Map<string, string>();
nextHeaders.cookies = async () => ({
  get: (name: string) =>
    cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
  set: (name: string, value: string) => {
    cookieJar.set(name, value);
  },
  delete: (name: string) => {
    cookieJar.delete(name);
  },
});

import { db } from '../src/lib/db';
import {
  generateAttendanceMatrixRecap,
  type AttendanceMatrixRecapResult,
} from '../src/lib/analytics/recap-matrix';
import {
  evaluateClassEarlyWarning,
  type EwsClassSummaryResult,
} from '../src/lib/analytics/early-warning';
import { calculateEffectiveSchoolDays, isSchoolDay } from '../src/lib/analytics/holidays';
import { generateFullExcelWorkbook } from '../src/lib/export/excel-export';
import { approveLeaveRequest, rejectLeaveRequest } from '../src/lib/leave';
import { submitLeaveRequestAction, approveLeaveRequestAction } from '../src/actions/leave';
import {
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
} from '../src/lib/rate-limit';
import {
  parentLoginAction,
  setActiveStudentCookieAction,
} from '../src/actions/parent-auth';
import { GateStatus, SubjectStatus, ApprovalStatus, LeaveType, Role, EngagementBadge } from '@prisma/client';

interface AdversarialCheck {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  error?: string;
}

const checks: AdversarialCheck[] = [];

function record(
  id: string,
  category: string,
  description: string,
  passed: boolean,
  actual?: any,
  expected?: any,
  error?: string
) {
  checks.push({ id, category, description, passed, actual, expected, error });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${id}: ${description}`);
  if (!passed) {
    if (actual !== undefined) console.log(`       Actual:   ${JSON.stringify(actual)}`);
    if (expected !== undefined) console.log(`       Expected: ${JSON.stringify(expected)}`);
    if (error) console.log(`       Error:    ${error}`);
  }
}

async function runAdversarialAlgorithmStressSuite() {
  console.log('='.repeat(80));
  console.log('   SIHADIR-EDU: ADVERSARIAL ALGORITHM & STATE-MACHINE STRESS HARNESS');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Environment: Offline In-Memory DB & Mock Cookie Context`);
  console.log('-'.repeat(80));

  // ===========================================================================
  // SECTION 1: DAPODIK FORM 8355 RECAP MATRIX PATHOLOGICAL CASES
  // ===========================================================================
  console.log('\n>>> [SECTION 1] DAPODIK FORM 8355 RECAP MATRIX: PATHOLOGICAL CALENDAR STRESS');

  // 1.1: 0 Elapsed Effective Days Mid-Month (today set before school month starts or on 1st Sunday)
  try {
    const recapZeroElapsed = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
      today: '2026-11-01', // Sunday Nov 1, 2026 -> 0 elapsed school days
    });

    const hasNoNanZeroElapsed =
      Number.isFinite(recapZeroElapsed.classStats.averageAttendanceRate) &&
      !Number.isNaN(recapZeroElapsed.classStats.averageAttendanceRate) &&
      recapZeroElapsed.students.every(
        (s) =>
          Number.isFinite(s.summary.attendanceRate) &&
          !Number.isNaN(s.summary.attendanceRate) &&
          Number.isFinite(s.summary.unexcusedRate) &&
          !Number.isNaN(s.summary.unexcusedRate)
      );

    record(
      'M7-ADV-RECAP-01',
      'RECAP_MATRIX',
      '0 elapsed effective days on Month Day 1 (Sunday): attendanceRate defaults to 100.0% with zero NaN/Infinity',
      recapZeroElapsed.period.elapsedEffectiveDays === 0 &&
        recapZeroElapsed.classStats.averageAttendanceRate === 100.0 &&
        hasNoNanZeroElapsed,
      {
        elapsed: recapZeroElapsed.period.elapsedEffectiveDays,
        avgRate: recapZeroElapsed.classStats.averageAttendanceRate,
        noNan: hasNoNanZeroElapsed,
      },
      { elapsed: 0, avgRate: 100.0, noNan: true }
    );
  } catch (err: any) {
    record('M7-ADV-RECAP-01', 'RECAP_MATRIX', 'Zero elapsed days threw unexpected error', false, null, null, err.message);
  }

  // 1.2: All-Sunday Custom Calendar Range (Total Effective Days = 0)
  try {
    const recapAllSunday = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'CUSTOM',
      startDate: '2026-11-01', // Sunday
      endDate: '2026-11-01',   // Sunday
      today: '2026-11-01',
    });

    const isTotalEffectiveZero = recapAllSunday.period.totalEffectiveDays === 0;
    const isElapsedEffectiveZero = recapAllSunday.period.elapsedEffectiveDays === 0;
    const allDaysMarkedNonSchool = recapAllSunday.days.every((d) => !d.isEffective);
    const allStudentCodesDash = recapAllSunday.students.every(
      (s) => s.dailyStatuses['2026-11-01'] === '-'
    );
    const noNanInSummary = recapAllSunday.students.every(
      (s) =>
        s.summary.attendanceRate === 100.0 &&
        s.summary.unexcusedRate === 0.0 &&
        !Number.isNaN(s.summary.attendanceRate)
    );

    record(
      'M7-ADV-RECAP-02',
      'RECAP_MATRIX',
      'All-Sunday calendar: totalEffectiveDays=0, daily statuses "-", rates default cleanly without NaN',
      isTotalEffectiveZero &&
        isElapsedEffectiveZero &&
        allDaysMarkedNonSchool &&
        allStudentCodesDash &&
        noNanInSummary,
      {
        totalEffective: recapAllSunday.period.totalEffectiveDays,
        allDash: allStudentCodesDash,
        noNan: noNanInSummary,
      },
      { totalEffective: 0, allDash: true, noNan: true }
    );
  } catch (err: any) {
    record('M7-ADV-RECAP-02', 'RECAP_MATRIX', 'All-Sunday calendar threw unexpected error', false, null, null, err.message);
  }

  // 1.3: All-Holiday Calendar (Every single day in month registered in customHolidays)
  try {
    const fullMonthHolidays = new Map<string, string>();
    for (let day = 1; day <= 30; day++) {
      const iso = `2026-11-${String(day).padStart(2, '0')}`;
      fullMonthHolidays.set(iso, 'Bulan Libur Total');
    }

    const recapAllHoliday = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
      customHolidays: fullMonthHolidays,
      today: '2026-11-20',
    });

    const effectiveZero = recapAllHoliday.period.totalEffectiveDays === 0;
    const elapsedZero = recapAllHoliday.period.elapsedEffectiveDays === 0;
    const avgRateFinite = Number.isFinite(recapAllHoliday.classStats.averageAttendanceRate);
    const genderRatesFinite =
      Number.isFinite(recapAllHoliday.classStats.genderStats.laki.attendanceRate) &&
      Number.isFinite(recapAllHoliday.classStats.genderStats.perempuan.attendanceRate);

    record(
      'M7-ADV-RECAP-03',
      'RECAP_MATRIX',
      'All-Holiday month (30 custom holidays): totalEffectiveDays=0, avg attendanceRate=100.0%, no NaN',
      effectiveZero && elapsedZero && avgRateFinite && genderRatesFinite && recapAllHoliday.classStats.averageAttendanceRate === 100.0,
      {
        totalEffective: recapAllHoliday.period.totalEffectiveDays,
        avgRate: recapAllHoliday.classStats.averageAttendanceRate,
        lakiRate: recapAllHoliday.classStats.genderStats.laki.attendanceRate,
        perempuanRate: recapAllHoliday.classStats.genderStats.perempuan.attendanceRate,
      },
      { totalEffective: 0, avgRate: 100.0, lakiRate: 100.0, perempuanRate: 100.0 }
    );
  } catch (err: any) {
    record('M7-ADV-RECAP-03', 'RECAP_MATRIX', 'All-holiday month threw error', false, null, null, err.message);
  }

  // 1.4: Empty Class (0 Active Students)
  try {
    const emptyClass = await db.class.create({
      data: {
        id: 'class-adv-empty',
        className: 'Class Empty Test',
        gradeLevel: 10,
        academicYearId: 'ay-2026-2027',
        homeroomTeacherId: 'teacher-budi',
        isActive: true,
      },
    });

    const recapEmpty = await generateAttendanceMatrixRecap({
      classId: emptyClass.id,
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
      today: '2026-11-15',
    });

    const totalStudentsZero = recapEmpty.classStats.totalStudents === 0;
    const countLakiZero = recapEmpty.classStats.countLaki === 0;
    const countPerempuanZero = recapEmpty.classStats.countPerempuan === 0;
    const avgAttendanceValid = recapEmpty.classStats.averageAttendanceRate === 100.0;
    const dailyDistValid = recapEmpty.classStats.dailyClassDistribution.every(
      (d) => d.attendanceRate === 0 && !Number.isNaN(d.attendanceRate)
    );

    record(
      'M7-ADV-RECAP-04',
      'RECAP_MATRIX',
      'Empty class (0 students): aggregates compute safely without division by zero',
      totalStudentsZero && countLakiZero && countPerempuanZero && avgAttendanceValid && dailyDistValid,
      {
        totalStudents: recapEmpty.classStats.totalStudents,
        avgRate: recapEmpty.classStats.averageAttendanceRate,
        dailyRateZero: dailyDistValid,
      },
      { totalStudents: 0, avgRate: 100.0, dailyRateZero: true }
    );
  } catch (err: any) {
    record('M7-ADV-RECAP-04', 'RECAP_MATRIX', 'Empty class recap threw error', false, null, null, err.message);
  }

  // 1.5: Excel Generation with Pathological Matrix
  try {
    const recapZeroElapsed = await generateAttendanceMatrixRecap({
      classId: 'class-x-ipa-1',
      periodType: 'MONTHLY',
      year: 2026,
      month: 11,
      today: '2026-11-01',
    });

    const excelBuffer = await generateFullExcelWorkbook({
      monthlyMatrix: recapZeroElapsed,
    });

    record(
      'M7-ADV-RECAP-05',
      'RECAP_MATRIX',
      'Excel export with elapsedEffectiveDays=0 generates valid Buffer without formula or math errors',
      Buffer.isBuffer(excelBuffer) && excelBuffer.length > 5000,
      { isBuffer: Buffer.isBuffer(excelBuffer), byteLength: excelBuffer?.length },
      { isBuffer: true, byteLength: '> 5000' }
    );
  } catch (err: any) {
    record('M7-ADV-RECAP-05', 'RECAP_MATRIX', 'Excel export on zero elapsed threw error', false, null, null, err.message);
  }

  // ===========================================================================
  // SECTION 2: EARLY WARNING SYSTEM (EWS) 5 INVARIANTS & BOUNDARIES
  // ===========================================================================
  console.log('\n>>> [SECTION 2] EARLY WARNING SYSTEM (EWS): 5 INVARIANTS & BOUNDARY STRESS');

  const ewsClass = await db.class.create({
    data: {
      id: 'class-ews-stress',
      className: 'X-EWS Stress Lab',
      gradeLevel: 10,
      academicYearId: 'ay-2026-2027',
      homeroomTeacherId: 'teacher-budi',
      isActive: true,
    },
  });

  const s1 = await db.student.create({
    data: {
      id: 'std-ews-perfect',
      nis: 'EWS001',
      nisn: '0011223341',
      fullName: 'Ahmad Sempurna',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_1',
      status: 'ACTIVE',
    },
  });

  const s2a = await db.student.create({
    data: {
      id: 'std-ews-boundary-895',
      nis: 'EWS002A',
      nisn: '0011223342',
      fullName: 'Bambang Boundary A',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_2A',
      status: 'ACTIVE',
    },
  });

  const s2b = await db.student.create({
    data: {
      id: 'std-ews-boundary-900',
      nis: 'EWS002B',
      nisn: '0011223343',
      fullName: 'Bambang Boundary B',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_2B',
      status: 'ACTIVE',
    },
  });

  const s3 = await db.student.create({
    data: {
      id: 'std-ews-consecutive',
      nis: 'EWS003',
      nisn: '0011223344',
      fullName: 'Candra Tiga Alpa',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_3',
      status: 'ACTIVE',
    },
  });

  const s4 = await db.student.create({
    data: {
      id: 'std-ews-lateness',
      nis: 'EWS004',
      nisn: '0011223345',
      fullName: 'Dedi Lima Telat',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_4',
      status: 'ACTIVE',
    },
  });

  const s5 = await db.student.create({
    data: {
      id: 'std-ews-bolos',
      nis: 'EWS005',
      nisn: '0011223346',
      fullName: 'Eko Dua Bolos',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_5',
      status: 'ACTIVE',
    },
  });

  const s6 = await db.student.create({
    data: {
      id: 'std-ews-catastrophic',
      nis: 'EWS006',
      nisn: '0011223347',
      fullName: 'Fahri Catastrophic All',
      gender: 'L',
      classId: ewsClass.id,
      qrToken: 'TOKEN_EWS_6',
      status: 'ACTIVE',
    },
  });

  // Effective days for November 2026 up to Friday Nov 27, 2026 (20 school days)
  // Week 1 (Nov 2-6): 5 days
  // Week 2 (Nov 9-13): 5 days
  // Week 3 (Nov 16-20): 5 days
  // Week 4 (Nov 23-27): 5 days
  // Total = 20 elapsed school days
  const evalDate = '2026-11-27';
  const elapsed20Days = [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27',
  ];

  // 1. Student 1: 20 days HADIR (100%)
  for (const dateStr of elapsed20Days) {
    await db.gateAttendance.create({
      data: {
        studentId: s1.id,
        attendanceDate: new Date(`${dateStr}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${dateStr}T06:50:00.000Z`),
        lateMinutes: 0,
      },
    });
  }

  // 2. Student 2b: 18 days HADIR, 2 days SAKIT -> 18/20 = 90.0% exactly!
  for (let i = 0; i < 18; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s2b.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
        lateMinutes: 0,
      },
    });
  }
  await db.gateAttendance.create({
    data: {
      studentId: s2b.id,
      attendanceDate: new Date(`${elapsed20Days[18]}T00:00:00.000Z`),
      status: GateStatus.SAKIT,
    },
  });
  await db.gateAttendance.create({
    data: {
      studentId: s2b.id,
      attendanceDate: new Date(`${elapsed20Days[19]}T00:00:00.000Z`),
      status: GateStatus.SAKIT,
    },
  });

  // Student 2a: 17 days HADIR, 3 days SAKIT (excused by doctor) -> 17/20 = 85.0% (<90% but >=85%)
  // Notice: 0 Alpa, so monthlyAlpaCount=0, but attendanceRate=85.0%!
  // Wait, in early-warning.ts:
  // if (monthlyAlpaCount >= 3 || attendanceRate < 85.0) -> CRITICAL
  // else if (monthlyAlpaCount === 2 || attendanceRate < 90.0) -> WARNING (15 pts)
  // For 85.0% to 89.9%: 17/20 = 85.0% (< 90.0 and NOT < 85.0)!
  // Triggers Invariant 2 WARNING with exactly 15 points!
  for (let i = 0; i < 17; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s2a.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
        lateMinutes: 0,
      },
    });
  }
  for (let i = 17; i < 20; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s2a.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.SAKIT,
      },
    });
  }

  // 3. Student 3: 3 consecutive Alpa ending at latest day (Nov 25, 26, 27)
  for (let i = 0; i < 17; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s3.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
      },
    });
  }
  // Days 17, 18, 19 (Nov 25, 26, 27) no scan -> defaults to ALPA in matrix recap!

  // 4. Student 4: Exactly 5 late arrivals
  for (let i = 0; i < 5; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s4.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.TERLAMBAT,
        checkInTime: new Date(`${elapsed20Days[i]}T07:25:00.000Z`),
        lateMinutes: 10,
      },
    });
  }
  for (let i = 5; i < 20; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s4.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
      },
    });
  }

  // 5. Student 5: 2 bolos in classroom (Nov 09 & Nov 10)
  for (let i = 0; i < 20; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s5.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
      },
    });
  }
  const journal1 = await db.classJournal.create({
    data: {
      id: 'journal-ews-bolos-1',
      classId: ewsClass.id,
      teacherId: 'teacher-budi',
      subjectId: 'subj-mtk',
      journalDate: new Date('2026-11-09T00:00:00.000Z'),
      periodStart: 3,
      periodEnd: 4,
      topic: 'Trigonometri',
      teachingActivity: 'Latihan soal',
    },
  });
  await db.subjectAttendance.create({
    data: {
      id: 'sa-ews-bolos-1',
      journalId: journal1.id,
      studentId: s5.id,
      status: SubjectStatus.ALPA_BOLOS,
      note: 'Tidak ada di kelas saat diabsen',
    },
  });
  const journal2 = await db.classJournal.create({
    data: {
      id: 'journal-ews-bolos-2',
      classId: ewsClass.id,
      teacherId: 'teacher-budi',
      subjectId: 'subj-fis',
      journalDate: new Date('2026-11-10T00:00:00.000Z'),
      periodStart: 5,
      periodEnd: 6,
      topic: 'Dinamika Gerak',
      teachingActivity: 'Praktikum',
    },
  });
  await db.subjectAttendance.create({
    data: {
      id: 'sa-ews-bolos-2',
      journalId: journal2.id,
      studentId: s5.id,
      status: SubjectStatus.ALPA_BOLOS,
      note: 'Meninggalkan kelas tanpa izin',
    },
  });

  // 6. Student 6: Catastrophic student triggering ALL 5 invariants:
  // - Inv 1: 3 consecutive Alpa (Nov 25, 26, 27) -> 40 pts
  // - Inv 2: Monthly Alpa >= 3 -> 30 pts
  // - Inv 3: 5 Late arrivals (Nov 2, 3, 4, 5, 6) -> 25 pts
  // - Inv 4: 2 Bolos on Days 5 & 6 (Nov 9, 10 where gate was HADIR) -> 35 pts
  // - Inv 5: Attendance < 90% and 2 remedial subjects -> 25 pts
  // Total raw points = 40 + 30 + 25 + 35 + 25 = 155 points!
  for (let i = 0; i < 5; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s6.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.TERLAMBAT,
        checkInTime: new Date(`${elapsed20Days[i]}T07:25:00.000Z`),
        lateMinutes: 15,
      },
    });
  }
  for (let i = 5; i < 17; i++) {
    await db.gateAttendance.create({
      data: {
        studentId: s6.id,
        attendanceDate: new Date(`${elapsed20Days[i]}T00:00:00.000Z`),
        status: GateStatus.HADIR,
        checkInTime: new Date(`${elapsed20Days[i]}T06:50:00.000Z`),
      },
    });
  }
  // Days 17, 18, 19 (Nov 25, 26, 27) no scan -> ALPA (3 consecutive Alpa!)

  // Bolos on Days 5 & 6
  await db.subjectAttendance.create({
    data: {
      id: 'sa-ews-cat-bolos-1',
      journalId: journal1.id,
      studentId: s6.id,
      status: SubjectStatus.ALPA_BOLOS,
      note: 'Bolos jam ke-3',
    },
  });
  await db.subjectAttendance.create({
    data: {
      id: 'sa-ews-cat-bolos-2',
      journalId: journal2.id,
      studentId: s6.id,
      status: SubjectStatus.ALPA_BOLOS,
      note: 'Bolos jam ke-5',
    },
  });

  // Assessments for Invariant 5
  const asm1 = await db.assessment.create({
    data: {
      id: 'asm-ews-1',
      classId: ewsClass.id,
      subjectId: 'subj-mtk',
      teacherId: 'teacher-budi',
      title: 'UH 1 Matematika',
      category: 'UH',
      weight: 20,
      assessmentDate: new Date('2026-11-04T00:00:00.000Z'),
    },
  });
  await db.studentGrade.create({
    data: {
      id: 'sg-ews-1',
      assessmentId: asm1.id,
      studentId: s6.id,
      score: 55.0, // KKM 75
    },
  });

  const asm2 = await db.assessment.create({
    data: {
      id: 'asm-ews-2',
      classId: ewsClass.id,
      subjectId: 'subj-fis',
      teacherId: 'teacher-budi',
      title: 'UH 1 Fisika',
      category: 'UH',
      weight: 20,
      assessmentDate: new Date('2026-11-05T00:00:00.000Z'),
    },
  });
  await db.studentGrade.create({
    data: {
      id: 'sg-ews-2',
      assessmentId: asm2.id,
      studentId: s6.id,
      score: 50.0, // KKM 75
    },
  });

  // Evaluate EWS for this class
  const ewsResult = await evaluateClassEarlyWarning({
    classId: ewsClass.id,
    year: 2026,
    month: 11,
    today: evalDate,
  });

  const evalS1 = ewsResult.students.find((s) => s.studentId === s1.id)!;
  const evalS2a = ewsResult.students.find((s) => s.studentId === s2a.id)!;
  const evalS2b = ewsResult.students.find((s) => s.studentId === s2b.id)!;
  const evalS3 = ewsResult.students.find((s) => s.studentId === s3.id)!;
  const evalS4 = ewsResult.students.find((s) => s.studentId === s4.id)!;
  const evalS5 = ewsResult.students.find((s) => s.studentId === s5.id)!;
  const evalS6 = ewsResult.students.find((s) => s.studentId === s6.id)!;

  // 2.1: S1 Perfect Student
  record(
    'M7-ADV-EWS-01',
    'EWS_INVARIANTS',
    'Perfect student: riskScore=0, riskLevel=NORMAL, all invariants triggered=false',
    evalS1.riskScore === 0 &&
      evalS1.riskLevel === 'NORMAL' &&
      evalS1.invariants.every((inv) => !inv.triggered && inv.points === 0),
    { riskScore: evalS1.riskScore, riskLevel: evalS1.riskLevel },
    { riskScore: 0, riskLevel: 'NORMAL' }
  );

  // 2.2: S2a (85.0% < 90%) vs S2b (90.0% >= 90%) Strict Boundary Check
  const inv2_s2a = evalS2a.invariants.find((inv) => inv.id === 'INV_2_MONTHLY_ABSENCE')!;
  const inv2_s2b = evalS2b.invariants.find((inv) => inv.id === 'INV_2_MONTHLY_ABSENCE')!;
  record(
    'M7-ADV-EWS-02',
    'EWS_INVARIANTS',
    'Attendance rate boundary: 85.0% (<90%) triggers Invariant 2 WARNING (15 pts) vs 90.0% NORMAL (0 pts)',
    inv2_s2a.triggered === true &&
      inv2_s2a.severity === 'WARNING' &&
      inv2_s2a.points === 15 &&
      inv2_s2b.triggered === false &&
      inv2_s2b.severity === 'NORMAL' &&
      inv2_s2b.points === 0,
    {
      s2a: { rate: evalS2a.attendanceRate, triggered: inv2_s2a.triggered, pts: inv2_s2a.points },
      s2b: { rate: evalS2b.attendanceRate, triggered: inv2_s2b.triggered, pts: inv2_s2b.points },
    },
    {
      s2a: { rate: 85, triggered: true, pts: 15 },
      s2b: { rate: 90, triggered: false, pts: 0 },
    }
  );

  // 2.3: Invariant 1 (Consecutive Alpa) Stress Check: 3 days streak -> 40 pts, CRITICAL, Home Visit SOP
  const inv1_s3 = evalS3.invariants.find((inv) => inv.id === 'INV_1_CONSECUTIVE_ALPA')!;
  const sopS3 = evalS3.counselingSop;
  record(
    'M7-ADV-EWS-03',
    'EWS_INVARIANTS',
    'Invariant 1: 3 consecutive Alpa triggers CRITICAL (40 pts) and routes to Home Visit SOP',
    inv1_s3.triggered === true &&
      inv1_s3.severity === 'CRITICAL' &&
      inv1_s3.points === 40 &&
      evalS3.riskLevel === 'CRITICAL' &&
      sopS3?.roleResponsible === 'GURU_BK' &&
      sopS3.primaryAction.includes('Home Visit'),
    {
      consecutiveAlpa: evalS3.metrics.consecutiveAlpaDays,
      points: inv1_s3.points,
      sopRole: sopS3?.roleResponsible,
      sopAction: sopS3?.primaryAction,
    },
    {
      consecutiveAlpa: 3,
      points: 40,
      sopRole: 'GURU_BK',
      sopAction: 'Panggilan Darurat & Kunjungan Rumah (Home Visit)',
    }
  );

  // 2.4: Invariant 3 (Habitual Lateness): Exactly 5 late arrivals -> 25 pts, CRITICAL
  const inv3_s4 = evalS4.invariants.find((inv) => inv.id === 'INV_3_HABITUAL_LATENESS')!;
  record(
    'M7-ADV-EWS-04',
    'EWS_INVARIANTS',
    'Invariant 3: Exactly 5 late arrivals triggers CRITICAL (25 pts)',
    inv3_s4.triggered === true &&
      inv3_s4.severity === 'CRITICAL' &&
      inv3_s4.points === 25 &&
      evalS4.metrics.lateArrivalCount === 5,
    { lateCount: evalS4.metrics.lateArrivalCount, points: inv3_s4.points, sev: inv3_s4.severity },
    { lateCount: 5, points: 25, sev: 'CRITICAL' }
  );

  // 2.5: Invariant 4 (Dual-Layer Bolos): 2 bolos in classroom -> 35 pts, CRITICAL, SP 2 SOP
  const inv4_s5 = evalS5.invariants.find((inv) => inv.id === 'INV_4_BOLOS_ANOMALY')!;
  const sopS5 = evalS5.counselingSop;
  record(
    'M7-ADV-EWS-05',
    'EWS_INVARIANTS',
    'Invariant 4: 2 classroom bolos triggers CRITICAL (35 pts) and routes to SP 2 Case Conference SOP',
    inv4_s5.triggered === true &&
      inv4_s5.severity === 'CRITICAL' &&
      inv4_s5.points === 35 &&
      evalS5.metrics.bolosCount === 2 &&
      sopS5?.roleResponsible === 'GURU_BK' &&
      sopS5.primaryAction.includes('SP 2'),
    {
      bolosCount: evalS5.metrics.bolosCount,
      points: inv4_s5.points,
      sopRole: sopS5?.roleResponsible,
      sopAction: sopS5?.primaryAction,
    },
    {
      bolosCount: 2,
      points: 35,
      sopRole: 'GURU_BK',
      sopAction: 'Sidang Kasus (Case Conference) & SP 2 Pelanggaran',
    }
  );

  // 2.6: Invariant 5 & Severity Clamping to [0, 100]
  const rawSumS6 = evalS6.invariants.reduce((acc, inv) => acc + inv.points, 0);
  record(
    'M7-ADV-EWS-06',
    'EWS_INVARIANTS',
    'Severity clamping: raw points exceed 100 (155 pts) but riskScore is strictly clamped to 100',
    rawSumS6 === 155 && evalS6.riskScore === 100 && evalS6.riskLevel === 'CRITICAL',
    { rawSum: rawSumS6, clampedScore: evalS6.riskScore, level: evalS6.riskLevel },
    { rawSum: 155, clampedScore: 100, level: 'CRITICAL' }
  );

  // 2.7: Strict Interval Invariant [0, 100] for ALL evaluated students
  const allClamped = ewsResult.students.every(
    (s) => s.riskScore >= 0 && s.riskScore <= 100 && !Number.isNaN(s.riskScore)
  );
  record(
    'M7-ADV-EWS-07',
    'EWS_INVARIANTS',
    'Mathematical invariant: all evaluated student risk scores strictly in range [0, 100]',
    allClamped,
    { allInBounds: allClamped, count: ewsResult.students.length },
    { allInBounds: true, count: ewsResult.students.length }
  );

  // ===========================================================================
  // SECTION 3: MULTI-DAY LEAVE CASCADES & RETROACTIVE SYNCHRONIZATION
  // ===========================================================================
  console.log('\n>>> [SECTION 3] MULTI-DAY LEAVE CASCADES & RETROACTIVE SYNCHRONIZATION');

  // Realistic UUID fixtures for Section 3 to pass Zod schema validation
  const testStudentUuid = 'a1111111-1111-4111-8111-111111111111';
  const testParentUuid = 'b2222222-2222-4222-8222-222222222222';
  const testParentUserUuid = 'c3333333-3333-4333-8333-333333333333';
  const testClassUuid = 'd4444444-4444-4444-8444-444444444444';
  const testTeacherUuid = 'e5555555-5555-4555-8555-555555555555';
  const testTeacherUserUuid = 'f6666666-6666-4666-8666-666666666666';
  const testUnauthorizedTeacherUserUuid = 'a7777777-7777-4777-8777-777777777777';
  const testUnauthorizedTeacherUuid = 'b8888888-8888-4888-8888-888888888888';

  // Create entities in database
  await db.user.create({
    data: {
      id: testTeacherUserUuid,
      name: 'Wali Kelas Ibu Ratna',
      role: Role.TEACHER,
      isActive: true,
      passwordHash: 'dummy',
    },
  });

  await db.teacher.create({
    data: {
      id: testTeacherUuid,
      userId: testTeacherUserUuid,
      fullName: 'Ibu Ratna S.Pd',
      nip: '198501012010012001',
      phoneWa: '081295551111',
    },
  });

  await db.class.create({
    data: {
      id: testClassUuid,
      className: 'X-IPA-CascadeLab',
      gradeLevel: 10,
      academicYearId: 'ay-2026-2027',
      homeroomTeacherId: testTeacherUuid,
      isActive: true,
    },
  });

  await db.user.create({
    data: {
      id: testUnauthorizedTeacherUserUuid,
      name: 'Guru Lain Pak Joko',
      role: Role.TEACHER,
      isActive: true,
      passwordHash: 'dummy',
    },
  });

  await db.teacher.create({
    data: {
      id: testUnauthorizedTeacherUuid,
      userId: testUnauthorizedTeacherUserUuid,
      fullName: 'Pak Joko M.Pd',
      nip: '198202022010011002',
      phoneWa: '081295552222',
    },
  });

  await db.user.create({
    data: {
      id: testParentUserUuid,
      name: 'Bapak Gunawan',
      phoneWa: '081298889999',
      role: Role.PARENT,
      isActive: true,
      passwordHash: 'dummy',
    },
  });

  await db.parent.create({
    data: {
      id: testParentUuid,
      userId: testParentUserUuid,
      fullName: 'Gunawan Prasetyo',
      phoneWa: '081298889999',
    },
  });

  await db.student.create({
    data: {
      id: testStudentUuid,
      nis: 'CAS001',
      nisn: '0011998877',
      fullName: 'Bayu Gunawan',
      gender: 'L',
      classId: testClassUuid,
      qrToken: 'TOKEN_CAS_1',
      status: 'ACTIVE',
    },
  });

  await db.parentStudentLink.create({
    data: {
      id: 'link-cas-1',
      parentId: testParentUuid,
      studentId: testStudentUuid,
      relation: 'AYAH',
      receiveWaNotif: true,
      isEmergencyContact: true,
    },
  });

  // Set initial dirty state: gate ALPA and subject ALPA_BOLOS on Nov 02, 03, 04
  const cascadeDates = ['2026-11-02', '2026-11-03', '2026-11-04'];
  for (const dateStr of cascadeDates) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    await db.gateAttendance.create({
      data: {
        studentId: testStudentUuid,
        attendanceDate: d,
        status: GateStatus.ALPA,
        scannedBy: 'INITIAL_UNEXCUSED_SCAN',
      },
    });

    const j = await db.classJournal.create({
      data: {
        id: `journal-cas-${dateStr}`,
        classId: testClassUuid,
        teacherId: testTeacherUuid,
        subjectId: 'subj-mtk',
        journalDate: d,
        periodStart: 1,
        periodEnd: 2,
        topic: `Topik ${dateStr}`,
        teachingActivity: 'Ceramah',
      },
    });

    await db.subjectAttendance.create({
      data: {
        id: `sa-cas-${dateStr}`,
        journalId: j.id,
        studentId: testStudentUuid,
        status: SubjectStatus.ALPA_BOLOS,
        note: 'Tidak hadir di kelas sebelum surat masuk',
      },
    });
  }

  // 3.1: Submit 3-day SAKIT Leave Request
  const leaveSubmission = await submitLeaveRequestAction({
    studentId: testStudentUuid,
    parentId: testParentUuid,
    leaveType: LeaveType.SAKIT,
    startDate: '2026-11-02',
    endDate: '2026-11-04',
    reason: 'Sakit demam berdarah opname 3 hari di RSUD',
    attachmentUrl: 'https://storage.sihadir.sch.id/leaves/surat_dokter_bayu.pdf',
  });

  record(
    'M7-ADV-LEAVE-01',
    'LEAVE_CASCADE',
    'Parent submits 3-day SAKIT leave request with medical attachment: returns success & PENDING',
    leaveSubmission.success === true &&
      leaveSubmission.data?.approvalStatus === ApprovalStatus.PENDING,
    { success: leaveSubmission.success, status: leaveSubmission.data?.approvalStatus },
    { success: true, status: 'PENDING' }
  );

  const leaveRequestId = leaveSubmission.data!.id;

  // 3.2: Unauthorized Teacher Approval Attempt
  const unauthorizedApproval = await approveLeaveRequestAction(
    leaveRequestId,
    testUnauthorizedTeacherUserUuid,
    'Mencoba menyetujui tanpa hak wali kelas'
  );

  record(
    'M7-ADV-LEAVE-02',
    'LEAVE_CASCADE',
    'Unauthorized teacher approval attempt is strictly forbidden by RBAC check',
    unauthorizedApproval.success === false &&
      unauthorizedApproval.error?.includes('Akses ditolak'),
    { success: unauthorizedApproval.success, error: unauthorizedApproval.error },
    { success: false, error: 'Contains "Akses ditolak"' }
  );

  // 3.3: Authorized Homeroom Teacher Approval & Retroactive Cascade
  const authorizedApproval = await approveLeaveRequestAction(
    leaveRequestId,
    testTeacherUserUuid,
    'Disetujui berdasarkan surat dokter RSUD yang valid'
  );

  record(
    'M7-ADV-LEAVE-03',
    'LEAVE_CASCADE',
    'Homeroom teacher approval succeeds and transitions leave status to APPROVED',
    authorizedApproval.success === true &&
      authorizedApproval.data?.approvalStatus === ApprovalStatus.APPROVED,
    { success: authorizedApproval.success, status: authorizedApproval.data?.approvalStatus },
    { success: true, status: 'APPROVED' }
  );

  // 3.4: Verify Retroactive GateAttendance Synchronization
  const updatedGateRecords = await db.gateAttendance.findMany({
    where: {
      studentId: testStudentUuid,
      attendanceDate: {
        gte: new Date('2026-11-02T00:00:00.000Z'),
        lte: new Date('2026-11-04T00:00:00.000Z'),
      },
    },
  });

  const allGateSyncedToSakit =
    updatedGateRecords.length === 3 &&
    updatedGateRecords.every(
      (g) => g.status === GateStatus.SAKIT && g.scannedBy.includes('LEAVE_APPROVAL')
    );

  record(
    'M7-ADV-LEAVE-04',
    'LEAVE_CASCADE',
    'Retroactive GateAttendance cascade: all 3 days atomically updated from ALPA to SAKIT with audit tag',
    allGateSyncedToSakit,
    {
      count: updatedGateRecords.length,
      statuses: updatedGateRecords.map((g) => g.status),
      tags: updatedGateRecords.map((g) => g.scannedBy),
    },
    { count: 3, statuses: ['SAKIT', 'SAKIT', 'SAKIT'], tags: 'Contains LEAVE_APPROVAL' }
  );

  // 3.5: Verify Retroactive SubjectAttendance Synchronization (Bolos Cleared)
  const updatedSubjectRecords = await db.subjectAttendance.findMany({
    where: {
      studentId: testStudentUuid,
      journal: {
        journalDate: {
          gte: new Date('2026-11-02T00:00:00.000Z'),
          lte: new Date('2026-11-04T00:00:00.000Z'),
        },
      },
    },
  });

  const allSubjectSyncedToSakit =
    updatedSubjectRecords.length === 3 &&
    updatedSubjectRecords.every(
      (sa) => sa.status === SubjectStatus.SAKIT && sa.note?.includes('Disetujui')
    );

  record(
    'M7-ADV-LEAVE-05',
    'LEAVE_CASCADE',
    'Retroactive SubjectAttendance cascade: all ALPA_BOLOS records converted to SAKIT, clearing false truancy',
    allSubjectSyncedToSakit,
    {
      count: updatedSubjectRecords.length,
      statuses: updatedSubjectRecords.map((sa) => sa.status),
      notes: updatedSubjectRecords.map((sa) => sa.note),
    },
    { count: 3, statuses: ['SAKIT', 'SAKIT', 'SAKIT'], notes: 'Contains Disetujui' }
  );

  // 3.6: Idempotent Re-Approval Prevention
  const doubleApproval = await approveLeaveRequestAction(
    leaveRequestId,
    testTeacherUserUuid,
    'Persetujuan ganda tidak sengaja'
  );

  record(
    'M7-ADV-LEAVE-06',
    'LEAVE_CASCADE',
    'Re-approval of already approved leave request fails gracefully (idempotency guard)',
    doubleApproval.success === false &&
      doubleApproval.error?.includes('sudah disetujui sebelumnya'),
    { success: doubleApproval.success, error: doubleApproval.error },
    { success: false, error: 'Contains "sudah disetujui sebelumnya"' }
  );

  // ===========================================================================
  // SECTION 4: PARENT PORTAL PIN RATE LIMITING & SIBLING SWITCHER
  // ===========================================================================
  console.log('\n>>> [SECTION 4] PARENT PORTAL PIN RATE LIMITING & SIBLING SWITCHER SECURITY');

  const parentPhone = '081290000001'; // Hendra Wijaya (parent-hendra)
  resetPinRateLimit(parentPhone);

  // 4.1: Initial State check
  const rlInit = checkPinRateLimit(parentPhone);
  record(
    'M7-ADV-PORTAL-01',
    'RATE_LIMITING',
    'Initial rate limit state: isAllowed=true, remainingAttempts=5',
    rlInit.isAllowed === true && rlInit.remainingAttempts === 5,
    rlInit,
    { isAllowed: true, remainingAttempts: 5 }
  );

  // 4.2: 4 Consecutive Failed PIN Attempts
  let allFourDecremented = true;
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedPinAttempt(parentPhone);
    if (res.isLocked !== false || res.remainingAttempts !== 5 - i) {
      allFourDecremented = false;
      break;
    }
  }

  record(
    'M7-ADV-PORTAL-02',
    'RATE_LIMITING',
    'Attempts 1 to 4 failed attempts strictly decrement remaining quota (4 -> 3 -> 2 -> 1)',
    allFourDecremented,
    { allFourDecremented },
    { allFourDecremented: true }
  );

  // 4.3: 5th Failed PIN Attempt -> 15-Minute Lockout
  const fifthAttempt = recordFailedPinAttempt(parentPhone);
  record(
    'M7-ADV-PORTAL-03',
    'RATE_LIMITING',
    '5th failed PIN attempt triggers immediate lockout: isLocked=true, remainingAttempts=0, lockout=15 mins',
    fifthAttempt.isLocked === true &&
      fifthAttempt.remainingAttempts === 0 &&
      fifthAttempt.lockoutRemainingMinutes === 15,
    fifthAttempt,
    { isLocked: true, remainingAttempts: 0, lockoutRemainingMinutes: 15 }
  );

  // 4.4: 6th Attempt While Locked
  const sixthCheck = checkPinRateLimit(parentPhone);
  record(
    'M7-ADV-PORTAL-04',
    'RATE_LIMITING',
    'Check rate limit during active lockout: isAllowed=false, remainingAttempts=0, lockoutRemainingMinutes >= 1',
    sixthCheck.isAllowed === false &&
      sixthCheck.remainingAttempts === 0 &&
      typeof sixthCheck.lockoutRemainingMinutes === 'number' &&
      sixthCheck.lockoutRemainingMinutes > 0,
    sixthCheck,
    { isAllowed: false, remainingAttempts: 0, lockoutRemainingMinutes: '>= 1' }
  );

  // 4.5: Full Server Action Login with Rate Limit Lockout
  const actionLoginBlocked = await parentLoginAction(parentPhone, '999999');
  record(
    'M7-ADV-PORTAL-05',
    'RATE_LIMITING',
    'parentLoginAction rejects locked account with remainingAttempts=0 and lockout error message',
    actionLoginBlocked.success === false &&
      actionLoginBlocked.remainingAttempts === 0 &&
      actionLoginBlocked.error?.includes('terkunci sementara'),
    {
      success: actionLoginBlocked.success,
      remaining: actionLoginBlocked.remainingAttempts,
      error: actionLoginBlocked.error,
    },
    { success: false, remaining: 0, error: 'Contains "terkunci sementara"' }
  );

  // Reset rate limit for sibling switcher testing
  resetPinRateLimit(parentPhone);

  // 4.6: Valid Parent Login Sets Session Cookie and Active Student Cookie
  cookieJar.clear();
  const validLogin = await parentLoginAction(parentPhone, '123456'); // Correct PIN for Hendra Wijaya
  record(
    'M7-ADV-PORTAL-06',
    'SIBLING_SWITCHER',
    'Valid login authenticates parent, creates signed session cookie and sets default active student',
    validLogin.success === true &&
      cookieJar.has('sihadir_parent_session') &&
      cookieJar.has('sihadir_active_student'),
    {
      success: validLogin.success,
      hasSessionCookie: cookieJar.has('sihadir_parent_session'),
      activeStudentCookie: cookieJar.get('sihadir_active_student'),
    },
    { success: true, hasSessionCookie: true, activeStudentCookie: 'std-26101' }
  );

  // 4.7: Valid Sibling Switch (Parent Hendra switches between child Budi and child Dewi)
  // Child 1: std-26101 (Budi)
  // Child 2: std-26104 (Dewi - sibling in same family)
  const switchDewi = await setActiveStudentCookieAction('std-26104');
  record(
    'M7-ADV-PORTAL-07',
    'SIBLING_SWITCHER',
    'Parent switches to verified sibling (Dewi Lestari, std-26104): returns success and updates cookie',
    switchDewi.success === true && cookieJar.get('sihadir_active_student') === 'std-26104',
    { success: switchDewi.success, activeStudentCookie: cookieJar.get('sihadir_active_student') },
    { success: true, activeStudentCookie: 'std-26104' }
  );

  // Switch back to Budi
  const switchBudi = await setActiveStudentCookieAction('std-26101');
  record(
    'M7-ADV-PORTAL-08',
    'SIBLING_SWITCHER',
    'Parent switches back to Budi Santoso (std-26101): returns success and updates cookie',
    switchBudi.success === true && cookieJar.get('sihadir_active_student') === 'std-26101',
    { success: switchBudi.success, activeStudentCookie: cookieJar.get('sihadir_active_student') },
    { success: true, activeStudentCookie: 'std-26101' }
  );

  // 4.9: Cross-Tenant Breach Attempt: Parent Hendra attempts to switch to unrelated student std-26102 (Siti Rahmawati, child of Agus)
  const crossTenantSwitch = await setActiveStudentCookieAction('std-26102');
  record(
    'M7-ADV-PORTAL-09',
    'SIBLING_SWITCHER',
    'Cross-Tenant Isolation: Switching to unrelated student (std-26102) is strictly rejected',
    crossTenantSwitch.success === false &&
      crossTenantSwitch.error?.includes('tidak terdaftar dalam akun orang tua ini') &&
      cookieJar.get('sihadir_active_student') === 'std-26101', // Cookie remains unchanged!
    {
      success: crossTenantSwitch.success,
      error: crossTenantSwitch.error,
      cookiePreserved: cookieJar.get('sihadir_active_student'),
    },
    {
      success: false,
      error: 'Contains "tidak terdaftar dalam akun orang tua ini"',
      cookiePreserved: 'std-26101',
    }
  );

  // 4.10: Switch to Non-Existent Student ID
  const invalidStudentSwitch = await setActiveStudentCookieAction('std-non-existent-999');
  record(
    'M7-ADV-PORTAL-10',
    'SIBLING_SWITCHER',
    'Switching to non-existent student ID is rejected and preserves existing active student',
    invalidStudentSwitch.success === false &&
      cookieJar.get('sihadir_active_student') === 'std-26101',
    { success: invalidStudentSwitch.success, error: invalidStudentSwitch.error },
    { success: false }
  );

  // 4.11: Unauthenticated Sibling Switch (No Session Cookie)
  cookieJar.delete('sihadir_parent_session');
  const unauthenticatedSwitch = await setActiveStudentCookieAction('std-26101');
  record(
    'M7-ADV-PORTAL-11',
    'SIBLING_SWITCHER',
    'Unauthenticated switch attempt without session cookie is rejected with session expiry error',
    unauthenticatedSwitch.success === false &&
      unauthenticatedSwitch.error?.includes('Sesi orang tua telah berakhir'),
    { success: unauthenticatedSwitch.success, error: unauthenticatedSwitch.error },
    { success: false, error: 'Contains "Sesi orang tua telah berakhir"' }
  );

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('                 ADVERSARIAL STRESS TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  console.log(`TOTAL CHECKS EXECUTED : ${total}`);
  console.log(`PASSED CHECKS         : ${passed} (${((passed / total) * 100).toFixed(2)}%)`);
  console.log(`FAILED CHECKS         : ${failed}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.error(`\n❌ VERIFICATION FAILED: ${failed} check(s) did not satisfy specifications.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${total} ADVERSARIAL STRESS CHECKS PASSED WITH 100% SUCCESS.`);
    process.exit(0);
  }
}

runAdversarialAlgorithmStressSuite().catch((err) => {
  console.error('Fatal unhandled error in adversarial test suite:', err);
  process.exit(1);
});
