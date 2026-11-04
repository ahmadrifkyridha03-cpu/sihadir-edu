import { db } from '@/lib/db';
import {
  normalizeDateOnly,
  getWibNow,
} from '@/lib/timezone';
import {
  isSchoolDay,
  isNationalHoliday,
  calculateEffectiveSchoolDays,
} from './holidays';
import {
  GateStatus,
  SubjectStatus,
  ApprovalStatus,
  LeaveType,
} from '@prisma/client';

export type DailyStatusCode = 'H' | 'T' | 'S' | 'I' | 'A' | 'B' | '-' | ' ';

export interface DayMetadata {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  dayOfWeek: number; // 0..6
  dayName: string; // "Sen", "Sel", etc.
  isEffective: boolean;
  isElapsed: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

export interface StudentAttendanceSummary {
  hadirCount: number;
  terlambatCount: number;
  sakitCount: number;
  izinCount: number;
  alpaCount: number;
  bolosCount: number;
  totalPresent: number; // H + T
  totalAbsent: number; // S + I + A + B
  attendanceRate: number; // (H + T) / elapsedEffectiveDays * 100
  unexcusedRate: number; // (A + B) / elapsedEffectiveDays * 100
}

export interface StudentAttendanceMatrixRow {
  studentId: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  classId: string;
  className: string;
  dailyStatuses: Record<string, DailyStatusCode>; // ISO date -> Code
  dailyStatusDetails?: Record<string, { code: DailyStatusCode; note?: string; lateMinutes?: number }>;
  summary: StudentAttendanceSummary;
}

export interface GenderAttendanceStats {
  count: number;
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
  bolos: number;
  attendanceRate: number;
}

export interface DailyClassDistribution {
  date: string;
  dayNumber: number;
  isEffective: boolean;
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
  bolos: number;
  attendanceRate: number;
}

export interface AttendanceMatrixRecapResult {
  classInfo: {
    id: string;
    className: string;
    gradeLevel: number;
    homeroomTeacher?: {
      id: string;
      fullName: string;
      nip?: string | null;
    } | null;
    academicYear?: {
      id: string;
      yearName: string;
      semester: number;
    } | null;
  };
  period: {
    type: 'MONTHLY' | 'SEMESTER' | 'CUSTOM';
    label: string;
    year: number;
    month?: number;
    semester?: number;
    startDate: string;
    endDate: string;
    totalEffectiveDays: number;
    elapsedEffectiveDays: number;
  };
  days: DayMetadata[];
  students: StudentAttendanceMatrixRow[];
  classStats: {
    totalStudents: number;
    countLaki: number;
    countPerempuan: number;
    averageAttendanceRate: number;
    genderStats: {
      laki: GenderAttendanceStats;
      perempuan: GenderAttendanceStats;
    };
    dailyClassDistribution: DailyClassDistribution[];
  };
}

export interface GenerateMatrixRecapParams {
  classId: string;
  periodType?: 'MONTHLY' | 'SEMESTER' | 'CUSTOM';
  year?: number;
  month?: number; // 1-12
  semester?: 1 | 2;
  startDate?: Date | string;
  endDate?: Date | string;
  schoolDaysPerWeek?: 5 | 6;
  customHolidays?: Map<string, string>;
  today?: Date | string;
}

const INDO_DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * High-Performance Attendance Matrix Recap Generator
 */
export async function generateAttendanceMatrixRecap(
  params: GenerateMatrixRecapParams
): Promise<AttendanceMatrixRecapResult> {
  const { classId } = params;
  const todayWib = params.today ? normalizeDateOnly(params.today) : getWibNow().wibDate;
  const periodType = params.periodType || 'MONTHLY';
  const schoolDaysPerWeek = params.schoolDaysPerWeek || 5;

  // 1. Fetch Class with Homeroom Teacher and Academic Year
  const classRecord = await db.class.findUnique({
    where: { id: classId },
    include: {
      homeroomTeacher: true,
      academicYear: true,
      schedules: {
        select: { dayOfWeek: true },
      },
    },
  });

  if (!classRecord) {
    throw new Error(`Class with ID "${classId}" not found`);
  }

  // Auto-detect 6-day week if schedules contain Saturday (dayOfWeek 6)
  const effectiveSchoolDaysPerWeek: 5 | 6 =
    params.schoolDaysPerWeek ||
    (classRecord.schedules.some((s) => s.dayOfWeek === 6) ? 6 : 5);

  // 2. Resolve Date Bounds
  let startDate: Date;
  let endDate: Date;
  let periodLabel = '';
  const currentYear = todayWib.getUTCFullYear();
  const currentMonth = todayWib.getUTCMonth() + 1;

  if (periodType === 'MONTHLY') {
    const yr = params.year || currentYear;
    const mo = params.month || currentMonth;
    startDate = new Date(Date.UTC(yr, mo - 1, 1, 0, 0, 0, 0));
    // Last day of month
    endDate = new Date(Date.UTC(yr, mo, 0, 0, 0, 0, 0));
    periodLabel = `Bulan ${INDO_MONTH_NAMES[mo - 1]} ${yr}`;
  } else if (periodType === 'SEMESTER') {
    const yr = params.year || currentYear;
    const sem = params.semester || (currentMonth >= 7 ? 1 : 2);
    if (sem === 1) {
      // Semester 1: July 1 to December 31
      startDate = new Date(Date.UTC(yr, 6, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yr, 11, 31, 0, 0, 0, 0));
      periodLabel = `Semester 1 (Ganjil) ${yr}/${yr + 1}`;
    } else {
      // Semester 2: January 1 to June 30
      startDate = new Date(Date.UTC(yr, 0, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yr, 5, 30, 0, 0, 0, 0));
      periodLabel = `Semester 2 (Genap) ${yr - 1}/${yr}`;
    }
  } else {
    // Custom date range
    if (!params.startDate || !params.endDate) {
      throw new Error('startDate and endDate are required for CUSTOM periodType');
    }
    startDate = normalizeDateOnly(params.startDate);
    endDate = normalizeDateOnly(params.endDate);
    periodLabel = `Periode ${startDate.toISOString().split('T')[0]} s/d ${endDate.toISOString().split('T')[0]}`;
  }

  // 3. Compute Effective School Days & Day Metadata
  const effectiveDayCalculation = calculateEffectiveSchoolDays(
    startDate,
    endDate,
    todayWib,
    effectiveSchoolDaysPerWeek,
    params.customHolidays
  );

  const days: DayMetadata[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const iso = cur.toISOString().split('T')[0];
    const dayNumber = cur.getUTCDate();
    const dayOfWeek = cur.getUTCDay();
    const isEffective = isSchoolDay(cur, effectiveSchoolDaysPerWeek, params.customHolidays);
    const isElapsed = cur <= todayWib;
    const hol = isNationalHoliday(cur);

    days.push({
      date: iso,
      dayNumber,
      dayOfWeek,
      dayName: INDO_DAY_NAMES[dayOfWeek],
      isEffective,
      isElapsed,
      isHoliday: hol.isHoliday,
      holidayName: hol.description,
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // 4. Batch Fetch Active Students in Class
  const students = await db.student.findMany({
    where: {
      classId,
      status: 'ACTIVE',
    },
    orderBy: { fullName: 'asc' },
  });

  const studentIds = students.map((s) => s.id);

  // 5. Batch Fetch GateAttendance Records
  const gateAttendances = await db.gateAttendance.findMany({
    where: {
      studentId: { in: studentIds },
      attendanceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Map: `studentId:YYYY-MM-DD` -> GateAttendance
  const gateMap = new Map<string, typeof gateAttendances[0]>();
  for (const gate of gateAttendances) {
    const isoDate = normalizeDateOnly(gate.attendanceDate).toISOString().split('T')[0];
    gateMap.set(`${gate.studentId}:${isoDate}`, gate);
  }

  // 6. Batch Fetch Approved Leave Requests
  const leaves = await db.leaveRequest.findMany({
    where: {
      studentId: { in: studentIds },
      approvalStatus: ApprovalStatus.APPROVED,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  // 7. Batch Fetch Truancy / Bolos Subject Attendances
  const truancyRecords = await db.subjectAttendance.findMany({
    where: {
      studentId: { in: studentIds },
      status: SubjectStatus.ALPA_BOLOS,
      journal: {
        journalDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      journal: {
        select: { journalDate: true },
      },
    },
  });

  // Set: `studentId:YYYY-MM-DD` for bolos flags
  const bolosSet = new Set<string>();
  for (const t of truancyRecords) {
    const isoDate = normalizeDateOnly(t.journal.journalDate).toISOString().split('T')[0];
    bolosSet.add(`${t.studentId}:${isoDate}`);
  }

  // Helper function to check if student has approved leave on given date
  function getApprovedLeaveOnDate(studentId: string, date: Date) {
    return leaves.find(
      (l) =>
        l.studentId === studentId &&
        normalizeDateOnly(l.startDate) <= date &&
        normalizeDateOnly(l.endDate) >= date
    );
  }

  // 8. Construct Rows and Aggregate Metrics
  const elapsedEffectiveDays = effectiveDayCalculation.elapsedEffectiveDays;
  const rows: StudentAttendanceMatrixRow[] = [];

  // Track daily distribution
  const dailyDistributionMap = new Map<string, {
    hadir: number;
    terlambat: number;
    sakit: number;
    izin: number;
    alpa: number;
    bolos: number;
  }>();

  for (const d of days) {
    dailyDistributionMap.set(d.date, {
      hadir: 0,
      terlambat: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      bolos: 0,
    });
  }

  for (const student of students) {
    const dailyStatuses: Record<string, DailyStatusCode> = {};
    const dailyStatusDetails: StudentAttendanceMatrixRow['dailyStatusDetails'] = {};

    let hadirCount = 0;
    let terlambatCount = 0;
    let sakitCount = 0;
    let izinCount = 0;
    let alpaCount = 0;
    let bolosCount = 0;

    for (const d of days) {
      const dateObj = new Date(d.date + 'T00:00:00.000Z');
      const key = `${student.id}:${d.date}`;
      const dayDist = dailyDistributionMap.get(d.date)!;

      // 6-Tier Precedence Hierarchy
      // Tier 1: Future date
      if (!d.isElapsed) {
        dailyStatuses[d.date] = ' ';
        continue;
      }

      // Tier 2: Non-school day (weekend or holiday)
      if (!d.isEffective) {
        dailyStatuses[d.date] = '-';
        continue;
      }

      // Tier 3: Gate scan exists
      const gate = gateMap.get(key);
      const isBolosInClass = bolosSet.has(key);

      if (gate) {
        if (gate.status === GateStatus.HADIR) {
          if (isBolosInClass) {
            dailyStatuses[d.date] = 'B';
            bolosCount++;
            dayDist.bolos++;
            dailyStatusDetails[d.date] = { code: 'B', note: 'Bolos jam pelajaran' };
          } else {
            dailyStatuses[d.date] = 'H';
            hadirCount++;
            dayDist.hadir++;
            dailyStatusDetails[d.date] = { code: 'H' };
          }
        } else if (gate.status === GateStatus.TERLAMBAT) {
          if (isBolosInClass) {
            dailyStatuses[d.date] = 'B';
            bolosCount++;
            dayDist.bolos++;
            dailyStatusDetails[d.date] = {
              code: 'B',
              note: `Terlambat ${gate.lateMinutes}m tapi bolos kelas`,
              lateMinutes: gate.lateMinutes,
            };
          } else {
            dailyStatuses[d.date] = 'T';
            terlambatCount++;
            dayDist.terlambat++;
            dailyStatusDetails[d.date] = {
              code: 'T',
              lateMinutes: gate.lateMinutes,
            };
          }
        } else if (gate.status === GateStatus.SAKIT) {
          dailyStatuses[d.date] = 'S';
          sakitCount++;
          dayDist.sakit++;
          dailyStatusDetails[d.date] = { code: 'S' };
        } else if (gate.status === GateStatus.IZIN) {
          dailyStatuses[d.date] = 'I';
          izinCount++;
          dayDist.izin++;
          dailyStatusDetails[d.date] = { code: 'I' };
        } else if (gate.status === GateStatus.ALPA) {
          dailyStatuses[d.date] = 'A';
          alpaCount++;
          dayDist.alpa++;
          dailyStatusDetails[d.date] = { code: 'A' };
        }
        continue;
      }

      // Tier 4: Approved Leave Request
      const leave = getApprovedLeaveOnDate(student.id, dateObj);
      if (leave) {
        if (leave.leaveType === LeaveType.SAKIT) {
          dailyStatuses[d.date] = 'S';
          sakitCount++;
          dayDist.sakit++;
          dailyStatusDetails[d.date] = { code: 'S', note: leave.reason };
        } else {
          dailyStatuses[d.date] = 'I';
          izinCount++;
          dayDist.izin++;
          dailyStatusDetails[d.date] = { code: 'I', note: leave.reason };
        }
        continue;
      }

      // Tier 5: Elapsed school day, no scan, no leave -> Alpa
      dailyStatuses[d.date] = 'A';
      alpaCount++;
      dayDist.alpa++;
      dailyStatusDetails[d.date] = { code: 'A', note: 'Tanpa Keterangan' };
    }

    const totalPresent = hadirCount + terlambatCount;
    const totalAbsent = sakitCount + izinCount + alpaCount + bolosCount;

    // Division by elapsedEffectiveDays to prevent false failure mid-month
    const attendanceRate =
      elapsedEffectiveDays > 0
        ? Math.round(((hadirCount + terlambatCount) / elapsedEffectiveDays) * 1000) / 10
        : 100.0;

    const unexcusedRate =
      elapsedEffectiveDays > 0
        ? Math.round(((alpaCount + bolosCount) / elapsedEffectiveDays) * 1000) / 10
        : 0.0;

    // Gender inference: Dapodik convention NISN / Name heuristic or default
    // Even last digit of NISN or standard naming heuristic
    const isFemale =
      /^(siti|putri|ayu|nur|dwi|ani|indah|fitri|ratna|dewi|maya|nadia|ria|sarah|zahra)/i.test(
        student.fullName
      ) ||
      (student.nisn && parseInt(student.nisn.slice(-1), 10) % 2 === 0);

    const gender: 'L' | 'P' = isFemale ? 'P' : 'L';

    rows.push({
      studentId: student.id,
      nis: student.nis,
      nisn: student.nisn,
      fullName: student.fullName,
      gender,
      classId: classRecord.id,
      className: classRecord.className,
      dailyStatuses,
      dailyStatusDetails,
      summary: {
        hadirCount,
        terlambatCount,
        sakitCount,
        izinCount,
        alpaCount,
        bolosCount,
        totalPresent,
        totalAbsent,
        attendanceRate,
        unexcusedRate,
      },
    });
  }

  // 9. Aggregate Class-Level Statistics
  const totalStudents = rows.length;
  const lakiRows = rows.filter((r) => r.gender === 'L');
  const perempuanRows = rows.filter((r) => r.gender === 'P');

  const aggregateGender = (subRows: StudentAttendanceMatrixRow[]): GenderAttendanceStats => {
    const count = subRows.length;
    if (count === 0) {
      return {
        count: 0,
        hadir: 0,
        terlambat: 0,
        sakit: 0,
        izin: 0,
        alpa: 0,
        bolos: 0,
        attendanceRate: 100.0,
      };
    }
    const hadir = subRows.reduce((acc, r) => acc + r.summary.hadirCount, 0);
    const terlambat = subRows.reduce((acc, r) => acc + r.summary.terlambatCount, 0);
    const sakit = subRows.reduce((acc, r) => acc + r.summary.sakitCount, 0);
    const izin = subRows.reduce((acc, r) => acc + r.summary.izinCount, 0);
    const alpa = subRows.reduce((acc, r) => acc + r.summary.alpaCount, 0);
    const bolos = subRows.reduce((acc, r) => acc + r.summary.bolosCount, 0);

    const avgRate =
      subRows.reduce((acc, r) => acc + r.summary.attendanceRate, 0) / count;

    return {
      count,
      hadir,
      terlambat,
      sakit,
      izin,
      alpa,
      bolos,
      attendanceRate: Math.round(avgRate * 10) / 10,
    };
  };

  const genderStatsLaki = aggregateGender(lakiRows);
  const genderStatsPerempuan = aggregateGender(perempuanRows);

  const averageAttendanceRate =
    totalStudents > 0
      ? Math.round(
          (rows.reduce((acc, r) => acc + r.summary.attendanceRate, 0) / totalStudents) * 10
        ) / 10
      : 100.0;

  // Build daily class distribution array
  const dailyClassDistribution: DailyClassDistribution[] = days.map((d) => {
    const dist = dailyDistributionMap.get(d.date)!;
    const rate =
      totalStudents > 0
        ? Math.round(((dist.hadir + dist.terlambat) / totalStudents) * 1000) / 10
        : 0;

    return {
      date: d.date,
      dayNumber: d.dayNumber,
      isEffective: d.isEffective,
      hadir: dist.hadir,
      terlambat: dist.terlambat,
      sakit: dist.sakit,
      izin: dist.izin,
      alpa: dist.alpa,
      bolos: dist.bolos,
      attendanceRate: rate,
    };
  });

  return {
    classInfo: {
      id: classRecord.id,
      className: classRecord.className,
      gradeLevel: classRecord.gradeLevel,
      homeroomTeacher: classRecord.homeroomTeacher
        ? {
            id: classRecord.homeroomTeacher.id,
            fullName: classRecord.homeroomTeacher.fullName,
            nip: classRecord.homeroomTeacher.nip,
          }
        : null,
      academicYear: classRecord.academicYear
        ? {
            id: classRecord.academicYear.id,
            yearName: classRecord.academicYear.yearName,
            semester: classRecord.academicYear.semester,
          }
        : null,
    },
    period: {
      type: periodType,
      label: periodLabel,
      year: startDate.getUTCFullYear(),
      month: periodType === 'MONTHLY' ? startDate.getUTCMonth() + 1 : undefined,
      semester: periodType === 'SEMESTER' ? params.semester || 1 : undefined,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalEffectiveDays: effectiveDayCalculation.totalEffectiveDays,
      elapsedEffectiveDays: effectiveDayCalculation.elapsedEffectiveDays,
    },
    days,
    students: rows,
    classStats: {
      totalStudents,
      countLaki: lakiRows.length,
      countPerempuan: perempuanRows.length,
      averageAttendanceRate,
      genderStats: {
        laki: genderStatsLaki,
        perempuan: genderStatsPerempuan,
      },
      dailyClassDistribution,
    },
  };
}
