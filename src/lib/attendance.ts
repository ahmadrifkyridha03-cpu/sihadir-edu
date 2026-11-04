import { db } from '@/lib/db';
import {
  StudentStatus,
  GateStatus,
  SubjectStatus,
  EngagementBadge,
  ApprovalStatus,
  Gender,
  LeaveType,
  WaNotifType,
  WaStatus,
} from '@prisma/client';
import { normalizeDateOnly, formatWibTime } from './timezone';

export interface EnrichedStudentAttendanceItem {
  studentId: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: Gender;
  photoUrl: string | null;

  // Layer 2 Subject Attendance State
  subjectStatus: SubjectStatus;
  engagementBadge: EngagementBadge;
  note: string | null;

  // Layer 1 Gate Context
  gateAttendanceId: string | null;
  gateStatus: GateStatus | null;
  checkInTime: string | null; // ISO string for client hydration
  lateMinutes: number;
  scannedBy: string | null;

  // Leave Context (if approved)
  leaveRequestId: string | null;
  leaveType: LeaveType | null;
  leaveReason: string | null;
  leaveAttachmentUrl: string | null;

  // Status & Warning Flags
  isExistingRecord: boolean;
  isUnscannedGate: boolean;
  isLate: boolean;
  hasApprovedLeave: boolean;
  isPotentialBolos: boolean; // True if Gate == HADIR/TERLAMBAT but Subject == ALPA_BOLOS
}

export interface ClassroomRosterPayload {
  journalId: string;
  classId: string;
  className: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
  journalDate: string; // YYYY-MM-DD
  periodStart: number;
  periodEnd: number;
  topicMaterial: string;
  teacherNotes: string | null;
  isExisting: boolean;
  totalStudents: number;
  stats: {
    hadir: number;
    sakit: number;
    izin: number;
    alpaBolos: number;
    unscanned: number;
    late: number;
  };
  students: EnrichedStudentAttendanceItem[];
}

export interface BolosIncident {
  incidentId: string;
  studentId: string;
  nis: string;
  fullName: string;
  photoUrl: string | null;
  classId: string;
  className: string;
  journalId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  teacherPhoneWa?: string | null;
  periodStart: number;
  periodEnd: number;
  gateCheckInTime: string | null;
  gateStatus: GateStatus;
  lateMinutes: number;
  detectedAt: string;
  homeroomTeacher: {
    id: string;
    fullName: string;
    phoneWa: string | null;
  } | null;
  parentContacts: {
    parentId: string;
    fullName: string;
    phoneWa: string;
    relation: string;
  }[];
}

export interface BolosAnomalyReport {
  date: string;
  totalIncidents: number;
  incidents: BolosIncident[];
  summaryByClass: Record<string, number>;
  summaryBySubject: Record<string, number>;
}

/**
 * Pre-fills or retrieves the classroom attendance roster for a teaching journal session.
 * Synchronizes morning gate scans (Layer 1) into subject classroom records (Layer 2)
 * so that teachers spend under 2 minutes marking exceptions.
 *
 * @param journalId - UUID of the class journal session
 * @param classId - UUID of the class being taught
 * @param targetDate - Calendar date of the class session
 */
export async function prefillSubjectAttendanceFromGate(
  journalId: string,
  classId: string,
  targetDate: Date | string
): Promise<ClassroomRosterPayload> {
  const normalizedDate = normalizeDateOnly(targetDate);

  // 1. Fetch Class Journal with Class, Subject, and Teacher relations
  const journal = await db.classJournal.findUnique({
    where: { id: journalId },
    include: {
      class: true,
      subject: true,
      teacher: true,
      subjectAttendances: true,
    },
  });

  if (!journal) {
    throw new Error(`Jurnal pembelajaran dengan ID ${journalId} tidak ditemukan.`);
  }

  // 2. Fetch all active students enrolled in this class
  const enrolledStudents = await db.student.findMany({
    where: {
      classId: classId,
      status: StudentStatus.ACTIVE,
    },
    orderBy: { fullName: 'asc' },
  });

  // 3. Fetch Layer 1 GateAttendance for all students in this class on this date
  const gateRecords = await db.gateAttendance.findMany({
    where: {
      studentId: { in: enrolledStudents.map((s) => s.id) },
      attendanceDate: normalizedDate,
    },
  });
  const gateMap = new Map(gateRecords.map((g) => [g.studentId, g]));

  // 4. Fetch approved LeaveRequests covering this date
  const approvedLeaves = await db.leaveRequest.findMany({
    where: {
      studentId: { in: enrolledStudents.map((s) => s.id) },
      approvalStatus: ApprovalStatus.APPROVED,
      startDate: { lte: normalizedDate },
      endDate: { gte: normalizedDate },
    },
  });
  const leaveMap = new Map(approvedLeaves.map((l) => [l.studentId, l]));

  // 5. Existing SubjectAttendance check (has teacher already saved attendance?)
  const existingMap = new Map(
    journal.subjectAttendances.map((sa) => [sa.studentId, sa])
  );
  const isExisting = journal.subjectAttendances.length > 0;

  // 6. Map each student into an enriched item
  let hadirCount = 0;
  let sakitCount = 0;
  let izinCount = 0;
  let alpaBolosCount = 0;
  let unscannedCount = 0;
  let lateCount = 0;

  const rosterItems: EnrichedStudentAttendanceItem[] = enrolledStudents.map((student) => {
    const existing = existingMap.get(student.id);
    const gate = gateMap.get(student.id);
    const leave = leaveMap.get(student.id);

    let subjectStatus: SubjectStatus;
    let engagementBadge: EngagementBadge = EngagementBadge.GOOD;
    let note: string | null = null;

    if (existing) {
      // Use existing saved data
      subjectStatus = existing.status;
      engagementBadge = existing.engagementBadge;
      note = existing.note;
    } else {
      // Deterministic pre-fill logic
      if (leave) {
        subjectStatus =
          leave.leaveType === LeaveType.SAKIT ? SubjectStatus.SAKIT : SubjectStatus.IZIN;
        note = leave.reason;
      } else if (gate) {
        if (gate.status === GateStatus.HADIR || gate.status === GateStatus.TERLAMBAT) {
          subjectStatus = SubjectStatus.HADIR;
        } else if (gate.status === GateStatus.SAKIT) {
          subjectStatus = SubjectStatus.SAKIT;
        } else if (gate.status === GateStatus.IZIN) {
          subjectStatus = SubjectStatus.IZIN;
        } else {
          // GateStatus.ALPA: default to HADIR for classroom visual check
          subjectStatus = SubjectStatus.HADIR;
        }
      } else {
        // No gate record: default to HADIR with unscanned flag
        subjectStatus = SubjectStatus.HADIR;
      }
    }

    // Accumulate counters
    if (subjectStatus === SubjectStatus.HADIR) hadirCount++;
    else if (subjectStatus === SubjectStatus.SAKIT) sakitCount++;
    else if (subjectStatus === SubjectStatus.IZIN) izinCount++;
    else if (subjectStatus === SubjectStatus.ALPA_BOLOS) alpaBolosCount++;

    const isUnscannedGate = !gate;
    const isLate = !!gate && gate.status === GateStatus.TERLAMBAT;
    if (isUnscannedGate) unscannedCount++;
    if (isLate) lateCount++;

    const isPotentialBolos =
      !!gate &&
      (gate.status === GateStatus.HADIR || gate.status === GateStatus.TERLAMBAT) &&
      subjectStatus === SubjectStatus.ALPA_BOLOS;

    return {
      studentId: student.id,
      nis: student.nis,
      nisn: student.nisn,
      fullName: student.fullName,
      gender: student.gender,
      photoUrl: student.photoUrl,

      subjectStatus,
      engagementBadge,
      note,

      gateAttendanceId: gate?.id || null,
      gateStatus: gate?.status || null,
      checkInTime: gate?.checkInTime ? gate.checkInTime.toISOString() : null,
      lateMinutes: gate?.lateMinutes || 0,
      scannedBy: gate?.scannedBy || null,

      leaveRequestId: leave?.id || null,
      leaveType: leave?.leaveType || null,
      leaveReason: leave?.reason || null,
      leaveAttachmentUrl: leave?.attachmentUrl || null,

      isExistingRecord: !!existing,
      isUnscannedGate,
      isLate,
      hasApprovedLeave: !!leave,
      isPotentialBolos,
    };
  });

  return {
    journalId: journal.id,
    classId: journal.class.id,
    className: journal.class.className,
    gradeLevel: journal.class.gradeLevel,
    subjectId: journal.subject.id,
    subjectName: journal.subject.subjectName,
    subjectCode: journal.subject.subjectCode,
    teacherId: journal.teacher.id,
    teacherName: journal.teacher.fullName,
    journalDate: normalizedDate.toISOString().split('T')[0],
    periodStart: journal.periodStart,
    periodEnd: journal.periodEnd,
    topicMaterial: journal.topicMaterial,
    teacherNotes: journal.teacherNotes,
    isExisting,
    totalStudents: enrolledStudents.length,
    stats: {
      hadir: hadirCount,
      sakit: sakitCount,
      izin: izinCount,
      alpaBolos: alpaBolosCount,
      unscanned: unscannedCount,
      late: lateCount,
    },
    students: rosterItems,
  };
}

/**
 * Scans the database for cross-layer discrepancies between Gate scans and Classroom journals.
 * Identifies all students who arrived at school but skipped specific classes (Bolos).
 *
 * @param targetDate - Calendar date to evaluate
 * @param classIdFilter - Optional class UUID filter
 */
export async function detectBolosAnomalies(
  targetDate: Date | string,
  classIdFilter?: string
): Promise<BolosAnomalyReport> {
  const normalizedDate = normalizeDateOnly(targetDate);

  // 1. Query all SubjectAttendance with status ALPA_BOLOS on the specified date
  const bolosRecords = await db.subjectAttendance.findMany({
    where: {
      status: SubjectStatus.ALPA_BOLOS,
      journal: {
        journalDate: normalizedDate,
        ...(classIdFilter ? { classId: classIdFilter } : {}),
      },
    },
    include: {
      student: {
        include: {
          class: {
            include: {
              homeroomTeacher: true,
            },
          },
          parentLinks: {
            where: { receiveWaNotif: true },
            include: { parent: true },
          },
        },
      },
      journal: {
        include: {
          subject: true,
          teacher: true,
          class: true,
        },
      },
    },
  });

  if (bolosRecords.length === 0) {
    return {
      date: normalizedDate.toISOString().split('T')[0],
      totalIncidents: 0,
      incidents: [],
      summaryByClass: {},
      summaryBySubject: {},
    };
  }

  // 2. Query GateAttendance for all flagged students on the same date
  const studentIds = bolosRecords.map((r) => r.studentId);
  const gateScans = await db.gateAttendance.findMany({
    where: {
      studentId: { in: studentIds },
      attendanceDate: normalizedDate,
      status: { in: [GateStatus.HADIR, GateStatus.TERLAMBAT] },
    },
  });
  const gateMap = new Map(gateScans.map((g) => [g.studentId, g]));

  // 3. Filter only confirmed cross-layer discrepancies
  const incidents: BolosIncident[] = [];
  const summaryByClass: Record<string, number> = {};
  const summaryBySubject: Record<string, number> = {};

  for (const record of bolosRecords) {
    const gate = gateMap.get(record.studentId);
    if (!gate) continue; // If no gate record or gate was SAKIT/IZIN, not a gate-verified bolos

    const className = record.journal.class.className;
    const subjectName = record.journal.subject.subjectName;

    summaryByClass[className] = (summaryByClass[className] || 0) + 1;
    summaryBySubject[subjectName] = (summaryBySubject[subjectName] || 0) + 1;

    incidents.push({
      incidentId: `${record.journalId}-${record.studentId}`,
      studentId: record.student.id,
      nis: record.student.nis,
      fullName: record.student.fullName,
      photoUrl: record.student.photoUrl,
      classId: record.journal.classId,
      className,
      journalId: record.journal.id,
      subjectName,
      subjectCode: record.journal.subject.subjectCode,
      teacherName: record.journal.teacher.fullName,
      teacherPhoneWa: record.journal.teacher.phoneWa,
      periodStart: record.journal.periodStart,
      periodEnd: record.journal.periodEnd,
      gateCheckInTime: gate.checkInTime ? gate.checkInTime.toISOString() : null,
      gateStatus: gate.status,
      lateMinutes: gate.lateMinutes,
      detectedAt: new Date().toISOString(),
      homeroomTeacher: record.student.class.homeroomTeacher
        ? {
            id: record.student.class.homeroomTeacher.id,
            fullName: record.student.class.homeroomTeacher.fullName,
            phoneWa: record.student.class.homeroomTeacher.phoneWa,
          }
        : null,
      parentContacts: record.student.parentLinks.map((pl) => ({
        parentId: pl.parent.id,
        fullName: pl.parent.fullName,
        phoneWa: pl.parent.phoneWa,
        relation: pl.relation,
      })),
    });
  }

  return {
    date: normalizedDate.toISOString().split('T')[0],
    totalIncidents: incidents.length,
    incidents,
    summaryByClass,
    summaryBySubject,
  };
}

/**
 * Dispatches immediate WhatsApp notifications to parents and homeroom teachers
 * when a student is detected skipping class after scanning at the gate.
 */
export async function dispatchBolosWhatsAppAlert(incident: BolosIncident): Promise<void> {
  const timeFormatted = incident.gateCheckInTime
    ? formatWibTime(new Date(incident.gateCheckInTime)) + ' WIB'
    : 'Pagi Hari';

  // 1. Enqueue to each registered parent phone
  for (const parent of incident.parentContacts) {
    if (!parent.phoneWa) continue;

    const parentMsg = [
      `*PEMBERITAHUAN KETIDAKHADIRAN DI KELAS (BOLOS)*`,
      `Yth. Bapak/Ibu ${parent.fullName},`,
      ``,
      `Kami menginformasikan bahwa putra/putri Anda:`,
      `👤 Nama: *${incident.fullName}* (${incident.className})`,
      `🕒 Tercatat Hadir di Gerbang: ${timeFormatted}`,
      ``,
      `Namun *TIDAK BERADA DI KELAS* pada:`,
      `📘 Mapel: *${incident.subjectName}* (Jam ke-${incident.periodStart}-${incident.periodEnd})`,
      `👨‍🏫 Guru Pengajar: ${incident.teacherName}`,
      ``,
      `Mohon konfirmasi atau koordinasi dengan pihak sekolah/Wali Kelas. Terima kasih.`,
      `_SiHadir-Edu Sistem Notifikasi Otomatis_`,
    ].join('\n');

    await db.waNotificationLog.create({
      data: {
        studentId: incident.studentId,
        targetPhone: parent.phoneWa,
        notifType: WaNotifType.ABSENT_ALERT,
        messageBody: parentMsg,
        status: WaStatus.QUEUED,
        scheduledAt: new Date(),
      },
    });
  }

  // 2. Also notify Homeroom Teacher if phone available
  if (incident.homeroomTeacher?.phoneWa) {
    const waliMsg = [
      `⚠️ *PERINGATAN SISWA BOLOS KELAS*`,
      `Halo Bpk/Ibu ${incident.homeroomTeacher.fullName} (Wali Kelas ${incident.className}),`,
      `Siswa Anda *${incident.fullName}* (NIS: ${incident.nis}) tercatat hadir di gerbang pada ${timeFormatted}, namun ditandai *ALPA_BOLOS* pada pelajaran ${incident.subjectName} (Jam ke-${incident.periodStart}-${incident.periodEnd}) oleh ${incident.teacherName}.`,
    ].join('\n');

    await db.waNotificationLog.create({
      data: {
        studentId: incident.studentId,
        targetPhone: incident.homeroomTeacher.phoneWa,
        notifType: WaNotifType.ABSENT_ALERT,
        messageBody: waliMsg,
        status: WaStatus.QUEUED,
        scheduledAt: new Date(),
      },
    });
  }
}
