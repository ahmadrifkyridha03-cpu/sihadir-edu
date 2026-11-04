import { db } from '@/lib/db';
import {
  GateStatus,
  SubjectStatus,
  EngagementBadge,
  DocVisibility,
  AssessmentCategory,
} from '@prisma/client';
import {
  normalizeDateOnly,
  formatWibTime,
  formatIndoDate,
  getWibNow,
} from './timezone';
import { evaluateKkm } from './grading';

export type ActivityItemType =
  | 'GATE_CHECK_IN'
  | 'CLASS_SESSION'
  | 'GATE_CHECK_OUT'
  | 'LEAVE_RECORD'
  | 'FORMAL_ASSESSMENT';

export interface ActivityPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
  fileSizeKb: number;
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityItemType;
  timestamp: string; // ISO string
  timeFormatted: string; // e.g. "06:48 WIB" or "07:30 - 09:00 WIB"
  title: string;
  subtitle?: string | null;
  statusBadge: {
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
  details: {
    // Class Session Details
    subjectName?: string;
    subjectCode?: string;
    teacherName?: string;
    periodText?: string;
    topicMaterial?: string;
    teacherNotes?: string | null;

    // Student Personal Participation
    studentStatus?: SubjectStatus;
    engagementBadge?: EngagementBadge;
    engagementLabel?: string;
    engagementIcon?: string;
    studentNote?: string | null;

    // Visual Documentation Proof (Scoped)
    photos?: ActivityPhoto[];

    // Formal Assessment if attached
    assessment?: {
      id: string;
      title: string;
      category: AssessmentCategory;
      score: number;
      maxScore: number;
      kkmScore: number;
      isPassed: boolean;
      teacherFeedback?: string | null;
    };
  };
}

export interface DailyActivityTimeline {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Rabu, 4 November 2026"
  isToday: boolean;
  daySummary: {
    gateStatus: GateStatus | 'BELUM_HADIR';
    checkInTime: string | null;
    checkOutTime: string | null;
    lateMinutes: number;
    classesTotal: number;
    classesAttended: number;
    starsEarned: number;
  };
  timeline: ActivityFeedItem[];
}

export interface GetStudentTimelineFilter {
  dateFrom?: string | Date;
  dateTo?: string | Date;
  limitDays?: number;
  includeDraftJournals?: boolean;
}

/**
 * Checks if a documentation photo is visible to a specific student based on visibility scoping:
 * - CLASS_PUBLIC: visible to all students in the class
 * - TAGGED_STUDENTS_ONLY: visible only if studentId is in taggedStudentIds
 */
export function isPhotoVisibleToStudent(
  photo: { visibility: DocVisibility; taggedStudentIds?: unknown },
  studentId: string
): boolean {
  if (photo.visibility === DocVisibility.CLASS_PUBLIC) {
    return true;
  }

  if (photo.visibility === DocVisibility.TAGGED_STUDENTS_ONLY && photo.taggedStudentIds) {
    try {
      const tagged = Array.isArray(photo.taggedStudentIds)
        ? (photo.taggedStudentIds as string[])
        : JSON.parse(String(photo.taggedStudentIds));
      return Array.isArray(tagged) && tagged.includes(studentId);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Retrieves the comprehensive chronological activity timeline for a student.
 * Synthesizes Layer 1 Gate Attendances, Layer 2 Classroom Journals (locked/published),
 * Tier 1 Engagement Badges, Scoped Documentation Photos, and Tier 2 Formal Assessments.
 */
export async function getStudentActivityTimeline(
  studentId: string,
  filter?: GetStudentTimelineFilter
): Promise<DailyActivityTimeline[]> {
  // 1. Fetch Student profile with enrolled Class
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });

  if (!student) {
    throw new Error(`Siswa dengan ID ${studentId} tidak ditemukan.`);
  }

  // 2. Resolve Date Range Bounds
  const todayWib = getWibNow();
  const limitDays = filter?.limitDays || 7;

  const endDate = filter?.dateTo ? normalizeDateOnly(filter.dateTo) : todayWib.wibDate;
  let startDate: Date;

  if (filter?.dateFrom) {
    startDate = normalizeDateOnly(filter.dateFrom);
  } else {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (limitDays - 1));
  }

  // 3. Parallel Database Queries
  const [gateRecords, journals, leaves, grades] = await Promise.all([
    // Gate Attendances
    db.gateAttendance.findMany({
      where: {
        studentId,
        attendanceDate: { gte: startDate, lte: endDate },
      },
      orderBy: { attendanceDate: 'desc' },
    }),

    // Class Journals for Student's Class
    db.classJournal.findMany({
      where: {
        classId: student.classId,
        journalDate: { gte: startDate, lte: endDate },
      },
      include: {
        subject: true,
        teacher: true,
        subjectAttendances: {
          where: { studentId },
        },
        documentations: true,
        assessments: {
          include: {
            grades: {
              where: { studentId },
            },
          },
        },
      },
      orderBy: [{ journalDate: 'desc' }, { periodStart: 'asc' }],
    }),

    // Approved Leaves
    db.leaveRequest.findMany({
      where: {
        studentId,
        approvalStatus: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    }),

    // Standalone Assessments & Grades
    db.studentGrade.findMany({
      where: {
        studentId,
        assessment: {
          classId: student.classId,
          assessmentDate: { gte: startDate, lte: endDate },
          journalId: null,
        },
      },
      include: {
        assessment: {
          include: { subject: true },
        },
      },
    }),
  ]);

  // Index Gate Records by Date string (YYYY-MM-DD)
  const gateByDate = new Map<string, (typeof gateRecords)[0]>();
  for (const g of gateRecords) {
    const dStr = g.attendanceDate.toISOString().split('T')[0];
    gateByDate.set(dStr, g);
  }

  // Index Journals by Date string
  const journalsByDate = new Map<string, typeof journals>();
  for (const j of journals) {
    const dStr = j.journalDate.toISOString().split('T')[0];
    const arr = journalsByDate.get(dStr) || [];
    arr.push(j);
    journalsByDate.set(dStr, arr);
  }

  // Index Leaves by active dates
  const leavesByDate = new Map<string, (typeof leaves)[0]>();
  for (const l of leaves) {
    const cur = new Date(l.startDate);
    const end = new Date(l.endDate);
    while (cur <= end) {
      const dStr = cur.toISOString().split('T')[0];
      leavesByDate.set(dStr, l);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // 4. Construct Daily Timeline Groups
  const timelineDays: DailyActivityTimeline[] = [];
  const currentDate = new Date(endDate);

  while (currentDate >= startDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const isToday = dateKey === todayWib.dateString;
    const gateRecord = gateByDate.get(dateKey);
    const dayJournals = journalsByDate.get(dateKey) || [];
    const leaveRecord = leavesByDate.get(dateKey);

    const items: ActivityFeedItem[] = [];
    let classesAttended = 0;
    let starsEarned = 0;

    // 4a. Approved Leave Record (if present on this day)
    if (leaveRecord) {
      items.push({
        id: `leave-${leaveRecord.id}-${dateKey}`,
        type: 'LEAVE_RECORD',
        timestamp: `${dateKey}T06:30:00.000Z`,
        timeFormatted: 'Sepanjang Hari',
        title: `Izin Tidak Masuk (${leaveRecord.leaveType === 'SAKIT' ? 'Sakit' : 'Izin'})`,
        subtitle: leaveRecord.reason,
        statusBadge: {
          label: leaveRecord.leaveType === 'SAKIT' ? 'Sakit Disetujui' : 'Izin Disetujui',
          variant: 'info',
        },
        details: {},
      });
    }

    // 4b. Morning Gate Check-In Event
    if (gateRecord && gateRecord.checkInTime) {
      const isLate = gateRecord.status === GateStatus.TERLAMBAT;
      items.push({
        id: `gate-in-${gateRecord.id}`,
        type: 'GATE_CHECK_IN',
        timestamp: gateRecord.checkInTime.toISOString(),
        timeFormatted: `${formatWibTime(gateRecord.checkInTime)} WIB`,
        title: isLate ? 'Tiba di Sekolah (Terlambat)' : 'Tiba di Sekolah Tepat Waktu',
        subtitle: isLate
          ? `Terlambat ${gateRecord.lateMinutes} menit melewati batas jam masuk`
          : 'Pindai kartu QR di gerbang utama',
        statusBadge: {
          label: isLate ? `Terlambat +${gateRecord.lateMinutes}m` : 'Hadir Tepat Waktu',
          variant: isLate ? 'warning' : 'success',
        },
        details: {},
      });
    }

    // 4c. Classroom Teaching Sessions
    for (const journal of dayJournals) {
      const attendance = journal.subjectAttendances[0];
      const status = attendance?.status || SubjectStatus.HADIR;
      const badge = attendance?.engagementBadge || EngagementBadge.GOOD;

      if (status === SubjectStatus.HADIR) {
        classesAttended++;
      }
      if (badge === EngagementBadge.ACTIVE_STAR) {
        starsEarned++;
      }

      // Filter Documentations using visibility scoping
      const scopedPhotos = journal.documentations
        .filter((doc) => isPhotoVisibleToStudent(doc, studentId))
        .map((doc) => ({
          id: doc.id,
          imageUrl: doc.imageUrl,
          caption: doc.caption,
          fileSizeKb: doc.fileSizeKb,
        }));

      // Engagement presentation
      let badgeLabel = 'Mengikuti dengan Baik';
      let badgeIcon = '✅';
      if (badge === EngagementBadge.ACTIVE_STAR) {
        badgeLabel = 'Sangat Aktif Bertanya/Maju';
        badgeIcon = '🌟';
      } else if (badge === EngagementBadge.LESS_FOCUS) {
        badgeLabel = 'Perlu Lebih Fokus';
        badgeIcon = '⚠️';
      } else if (badge === EngagementBadge.NO_TASK) {
        badgeLabel = 'Belum Kumpul Tugas';
        badgeIcon = '❌';
      }

      // Check linked assessment
      let assessmentDetail = undefined;
      const linkedAssessment = journal.assessments[0];
      if (linkedAssessment) {
        const studentGrade = linkedAssessment.grades[0];
        if (studentGrade) {
          const scoreNum = Number(studentGrade.score);
          const kkmNum = Number(journal.subject.kkmScore);
          const kkmEval = evaluateKkm(scoreNum, kkmNum);
          assessmentDetail = {
            id: linkedAssessment.id,
            title: linkedAssessment.title,
            category: linkedAssessment.category,
            score: scoreNum,
            maxScore: Number(linkedAssessment.maxScore),
            kkmScore: kkmNum,
            isPassed: kkmEval.isPassed,
            teacherFeedback: studentGrade.teacherFeedback,
          };
        }
      }

      const periodStr = `Jam ke-${journal.periodStart}${
        journal.periodEnd !== journal.periodStart ? ` - ${journal.periodEnd}` : ''
      }`;

      // Status variant
      let statusVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'success';
      let statusLabel = 'Hadir di Kelas';
      if (status === SubjectStatus.ALPA_BOLOS) {
        statusVariant = 'danger';
        statusLabel = 'Tidak di Kelas (Alpa/Bolos)';
      } else if (status === SubjectStatus.SAKIT) {
        statusVariant = 'info';
        statusLabel = 'Izin Sakit';
      } else if (status === SubjectStatus.IZIN) {
        statusVariant = 'info';
        statusLabel = 'Izin';
      }

      items.push({
        id: `journal-${journal.id}`,
        type: 'CLASS_SESSION',
        timestamp: `${dateKey}T0${Math.min(9, journal.periodStart + 6)}:00:00.000Z`,
        timeFormatted: periodStr,
        title: `${journal.subject.subjectName} — ${journal.topicMaterial}`,
        subtitle: `Guru: ${journal.teacher.fullName}`,
        statusBadge: {
          label: statusLabel,
          variant: statusVariant,
        },
        details: {
          subjectName: journal.subject.subjectName,
          subjectCode: journal.subject.subjectCode,
          teacherName: journal.teacher.fullName,
          periodText: periodStr,
          topicMaterial: journal.topicMaterial,
          teacherNotes: journal.teacherNotes,
          studentStatus: status,
          engagementBadge: badge,
          engagementLabel: badgeLabel,
          engagementIcon: badgeIcon,
          studentNote: attendance?.note,
          photos: scopedPhotos,
          assessment: assessmentDetail,
        },
      });
    }

    // 4d. Gate Check-Out Event
    if (gateRecord && gateRecord.checkOutTime) {
      items.push({
        id: `gate-out-${gateRecord.id}`,
        type: 'GATE_CHECK_OUT',
        timestamp: gateRecord.checkOutTime.toISOString(),
        timeFormatted: `${formatWibTime(gateRecord.checkOutTime)} WIB`,
        title: 'Meninggalkan Sekolah (Pulang)',
        subtitle: 'Pindai kartu QR kepulangan di gerbang utama',
        statusBadge: {
          label: 'Sudah Pulang',
          variant: 'neutral',
        },
        details: {},
      });
    }

    // Day summary
    const daySummary = {
      gateStatus: gateRecord ? gateRecord.status : ('BELUM_HADIR' as const),
      checkInTime: gateRecord?.checkInTime ? formatWibTime(gateRecord.checkInTime) : null,
      checkOutTime: gateRecord?.checkOutTime ? formatWibTime(gateRecord.checkOutTime) : null,
      lateMinutes: gateRecord?.lateMinutes || 0,
      classesTotal: dayJournals.length,
      classesAttended,
      starsEarned,
    };

    timelineDays.push({
      date: dateKey,
      formattedDate: formatIndoDate(currentDate),
      isToday,
      daySummary,
      timeline: items,
    });

    currentDate.setDate(currentDate.getDate() - 1);
  }

  return timelineDays;
}
