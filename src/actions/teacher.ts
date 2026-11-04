'use server';

import db from '@/lib/db';
import {
  INDONESIAN_SCHOOL_PERIODS,
  calculateSchedulePeriodState,
  getMinutesFromMidnightWib,
  PeriodProgressState,
} from '@/lib/teacher-schedule';
import { getWibNow, formatIndoDate } from '@/lib/timezone';

export interface TeacherScheduleItem {
  id: string;
  dayOfWeek: number;
  periodStart: number;
  periodEnd: number;
  periodLabel: string;
  timeRangeStr: string;
  class: {
    id: string;
    className: string;
    gradeLevel: number;
  };
  subject: {
    id: string;
    subjectName: string;
    subjectCode: string;
    kkmScore: number;
  };
  journalToday?: {
    id: string;
    topicMaterial: string;
    createdAt: string;
  } | null;
  progressState: PeriodProgressState;
}

export interface TeacherDashboardPayload {
  teacher: {
    id: string;
    fullName: string;
    nip: string | null;
    specialty: string | null;
    userId: string;
  };
  homeroomClass?: {
    id: string;
    className: string;
    gradeLevel: number;
  } | null;
  todayInfo: {
    dateStr: string;
    dayOfWeek: number;
    indoDateFormatted: string;
  };
  schedules: TeacherScheduleItem[];
  pendingLeavesCount: number;
  pendingLeaves: Array<{
    id: string;
    studentName: string;
    studentNis: string;
    className: string;
    leaveType: string;
    startDateStr: string;
    endDateStr: string;
    reason: string;
    attachmentUrl: string | null;
  }>;
  recentJournals: Array<{
    id: string;
    journalDate: string;
    className: string;
    subjectName: string;
    topicMaterial: string;
    periodStart: number;
    periodEnd: number;
    photosCount: number;
    assessmentsCount: number;
  }>;
}

/**
 * Retrieves all data required for the Teacher Dashboard:
 * Today's timetable with active period & elapsed progress,
 * homeroom pending leaves with photo proofs, and recent journals summary.
 */
export async function getTeacherDashboardData(
  targetTeacherUserId?: string
): Promise<{ success: boolean; error?: string; data?: TeacherDashboardPayload }> {
  try {
    // 1. Locate teacher
    let teacher = null;
    if (targetTeacherUserId) {
      teacher = await db.teacher.findFirst({
        where: {
          OR: [{ userId: targetTeacherUserId }, { id: targetTeacherUserId }],
        },
      });
    }

    if (!teacher) {
      // Default / fallback to first teacher in database
      teacher = await db.teacher.findFirst({
        include: { user: true },
      });
    }

    if (!teacher) {
      return { success: false, error: 'Data guru tidak ditemukan di sistem.' };
    }

    // 2. Date and WIB Time Calculation
    const wibNow = getWibNow();
    const todayDate = wibNow.wibDate;
    const dateStr = wibNow.dateString;
    const dayOfWeek = wibNow.wibDate.getDay() === 0 ? 1 : wibNow.wibDate.getDay(); // Sunday maps to Monday in demo
    const currentMinutesWib = wibNow.minutesFromMidnight;

    // 3. Query Today's Teaching Schedules
    let schedules = await db.schedule.findMany({
      where: {
        teacherId: teacher.id,
        dayOfWeek: dayOfWeek,
      },
      include: {
        class: true,
        subject: true,
      },
      orderBy: { periodStart: 'asc' },
    });

    // If today is a weekend or has no scheduled classes, fallback to all schedules for this teacher
    if (schedules.length === 0) {
      schedules = await db.schedule.findMany({
        where: {
          teacherId: teacher.id,
        },
        include: {
          class: true,
          subject: true,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { periodStart: 'asc' }],
        take: 6,
      });
    }

    // 4. Query Journals created today by this teacher
    const todayJournals = await db.classJournal.findMany({
      where: {
        teacherId: teacher.id,
        journalDate: todayDate,
      },
    });

    const journalMap = new Map<string, (typeof todayJournals)[0]>();
    for (const j of todayJournals) {
      if (j.scheduleId) {
        journalMap.set(j.scheduleId, j);
      }
      // Also index by classId + subjectId as fallback
      journalMap.set(`${j.classId}_${j.subjectId}`, j);
    }

    // 5. Build Timetable items with Period Progress
    const scheduleItems: TeacherScheduleItem[] = schedules.map((s) => {
      const startDef =
        INDONESIAN_SCHOOL_PERIODS.find((p) => p.period === s.periodStart && !p.isBreak) ||
        INDONESIAN_SCHOOL_PERIODS[0];
      const endDef =
        INDONESIAN_SCHOOL_PERIODS.find((p) => p.period === s.periodEnd && !p.isBreak) ||
        startDef;

      const progressState = calculateSchedulePeriodState(
        s.periodStart,
        s.periodEnd,
        currentMinutesWib
      );

      const matchedJournal =
        journalMap.get(s.id) || journalMap.get(`${s.classId}_${s.subjectId}`) || null;

      return {
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        periodLabel:
          s.periodStart === s.periodEnd
            ? `Jam ke-${s.periodStart}`
            : `Jam ke-${s.periodStart} - ${s.periodEnd}`,
        timeRangeStr: `${startDef.startTimeStr} - ${endDef.endTimeStr} WIB`,
        class: {
          id: s.class.id,
          className: s.class.className,
          gradeLevel: s.class.gradeLevel,
        },
        subject: {
          id: s.subject.id,
          subjectName: s.subject.subjectName,
          subjectCode: s.subject.subjectCode,
          kkmScore: Number(s.subject.kkmScore),
        },
        journalToday: matchedJournal
          ? {
              id: matchedJournal.id,
              topicMaterial: matchedJournal.topicMaterial,
              createdAt: matchedJournal.createdAt.toISOString(),
            }
          : null,
        progressState,
      };
    });

    // 6. Check if Teacher is Homeroom Teacher
    const homeroomClass = await db.class.findFirst({
      where: { homeroomTeacherId: teacher.id },
    });

    let pendingLeavesList: TeacherDashboardPayload['pendingLeaves'] = [];
    if (homeroomClass) {
      const leaves = await db.leaveRequest.findMany({
        where: {
          student: { classId: homeroomClass.id },
          approvalStatus: 'PENDING',
        },
        include: {
          student: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      pendingLeavesList = leaves.map((l) => ({
        id: l.id,
        studentName: l.student.fullName,
        studentNis: l.student.nis,
        className: homeroomClass.className,
        leaveType: l.leaveType,
        startDateStr: l.startDate.toISOString().split('T')[0],
        endDateStr: l.endDate.toISOString().split('T')[0],
        reason: l.reason,
        attachmentUrl: l.attachmentUrl,
      }));
    }

    // 7. Recent 5 Journals
    const recentJournalsRaw = await db.classJournal.findMany({
      where: { teacherId: teacher.id },
      include: {
        class: true,
        subject: true,
        documentations: true,
        assessments: true,
      },
      orderBy: { journalDate: 'desc' },
      take: 5,
    });

    const recentJournals = recentJournalsRaw.map((j) => ({
      id: j.id,
      journalDate: j.journalDate.toISOString().split('T')[0],
      className: j.class.className,
      subjectName: j.subject.subjectName,
      topicMaterial: j.topicMaterial,
      periodStart: j.periodStart,
      periodEnd: j.periodEnd,
      photosCount: j.documentations.length,
      assessmentsCount: j.assessments.length,
    }));

    return {
      success: true,
      data: {
        teacher: {
          id: teacher.id,
          fullName: teacher.fullName,
          nip: teacher.nip,
          specialty: teacher.specialty,
          userId: teacher.userId,
        },
        homeroomClass: homeroomClass
          ? {
              id: homeroomClass.id,
              className: homeroomClass.className,
              gradeLevel: homeroomClass.gradeLevel,
            }
          : null,
        todayInfo: {
          dateStr,
          dayOfWeek,
          indoDateFormatted: formatIndoDate(todayDate),
        },
        schedules: scheduleItems,
        pendingLeavesCount: pendingLeavesList.length,
        pendingLeaves: pendingLeavesList,
        recentJournals,
      },
    };
  } catch (err) {
    console.error('Error in getTeacherDashboardData:', err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memuat data dashboard guru.',
    };
  }
}
