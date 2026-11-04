'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  SubjectStatus,
  EngagementBadge,
  GateStatus,
} from '@prisma/client';
import {
  prefillSubjectAttendanceFromGate,
  dispatchBolosWhatsAppAlert,
  type ClassroomRosterPayload,
  type BolosIncident,
} from '@/lib/attendance';
import { normalizeDateOnly } from '@/lib/timezone';
import type { ServerActionResult } from '@/types/database';

const attendanceItemSchema = z.object({
  studentId: z.string().uuid('ID Siswa tidak valid'),
  status: z.nativeEnum(SubjectStatus, {
    errorMap: () => ({ message: 'Status presensi mapel tidak valid' }),
  }),
  engagementBadge: z
    .nativeEnum(EngagementBadge)
    .default(EngagementBadge.GOOD),
  note: z.string().max(255).optional().nullable(),
});

const saveSubjectAttendanceSchema = z.object({
  journalId: z.string().uuid('ID Jurnal mengajar tidak valid'),
  classId: z.string().uuid('ID Rombel tidak valid'),
  attendances: z
    .array(attendanceItemSchema)
    .min(1, 'Daftar presensi siswa minimal berisi 1 siswa'),
  topicMaterial: z.string().max(255).optional(),
  teacherNotes: z.string().optional().nullable(),
});

export type SaveSubjectAttendanceInput = z.infer<typeof saveSubjectAttendanceSchema>;

export interface SubjectAttendanceSaveResult {
  savedCount: number;
  bolosIncidents: BolosIncident[];
  message: string;
}

/**
 * Server Action to retrieve the enriched classroom attendance roster
 * pre-filled from morning gate scans and approved leaves.
 */
export async function getClassroomRosterAction(
  journalId: string,
  classId: string,
  targetDate: string
): Promise<ServerActionResult<ClassroomRosterPayload>> {
  try {
    const data = await prefillSubjectAttendanceFromGate(journalId, classId, targetDate);
    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error('Error in getClassroomRosterAction:', err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memuat rekap presensi kelas dari data gerbang.',
    };
  }
}

/**
 * Server Action to save or update classroom subject attendance for a journal session.
 * Executes atomic upsert transaction and triggers immediate bolos alerts if a student
 * was present at the gate but marked absent from class.
 */
export async function saveSubjectAttendanceAction(
  input: SaveSubjectAttendanceInput
): Promise<ServerActionResult<SubjectAttendanceSaveResult>> {
  try {
    const parsed = saveSubjectAttendanceSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data presensi yang dikirimkan tidak valid.',
        fieldErrors,
      };
    }

    const { journalId, classId, attendances, topicMaterial, teacherNotes } = parsed.data;

    // 1. Verify journal exists
    const journal = await db.classJournal.findUnique({
      where: { id: journalId },
      include: {
        class: {
          include: {
            homeroomTeacher: true,
          },
        },
        subject: true,
        teacher: true,
      },
    });

    if (!journal) {
      return {
        success: false,
        error: `Jurnal kelas dengan ID ${journalId} tidak ditemukan.`,
      };
    }

    const journalDateNormalized = normalizeDateOnly(journal.journalDate);

    // 2. Fetch gate attendances for students marked ALPA_BOLOS to detect discrepancies
    const alpaStudentIds = attendances
      .filter((a) => a.status === SubjectStatus.ALPA_BOLOS)
      .map((a) => a.studentId);

    let gateScansForAlpa: Map<string, { status: GateStatus; checkInTime: Date | null; lateMinutes: number }> =
      new Map();

    if (alpaStudentIds.length > 0) {
      const gateRecords = await db.gateAttendance.findMany({
        where: {
          studentId: { in: alpaStudentIds },
          attendanceDate: journalDateNormalized,
          status: { in: [GateStatus.HADIR, GateStatus.TERLAMBAT] },
        },
      });

      for (const g of gateRecords) {
        gateScansForAlpa.set(g.studentId, {
          status: g.status,
          checkInTime: g.checkInTime,
          lateMinutes: g.lateMinutes,
        });
      }
    }

    // 3. Execute atomic transaction to save all attendance records
    await db.$transaction(async (tx) => {
      // 3a. Update journal topic and notes if provided
      if (topicMaterial !== undefined || teacherNotes !== undefined) {
        await tx.classJournal.update({
          where: { id: journalId },
          data: {
            ...(topicMaterial ? { topicMaterial } : {}),
            ...(teacherNotes !== undefined ? { teacherNotes } : {}),
          },
        });
      }

      // 3b. Upsert subject attendance for each student
      for (const item of attendances) {
        await tx.subjectAttendance.upsert({
          where: {
            journalId_studentId: {
              journalId,
              studentId: item.studentId,
            },
          },
          create: {
            journalId,
            studentId: item.studentId,
            status: item.status,
            engagementBadge: item.engagementBadge,
            note: item.note || null,
          },
          update: {
            status: item.status,
            engagementBadge: item.engagementBadge,
            note: item.note || null,
          },
        });
      }
    });

    // 4. Evaluate Bolos Anomalies & Dispatch High-Priority WhatsApp Alerts
    const bolosIncidents: BolosIncident[] = [];

    if (gateScansForAlpa.size > 0) {
      // Fetch student and parent details for flagged students
      const flaggedStudents = await db.student.findMany({
        where: { id: { in: Array.from(gateScansForAlpa.keys()) } },
        include: {
          parentLinks: {
            where: { receiveWaNotif: true },
            include: { parent: true },
          },
        },
      });

      for (const student of flaggedStudents) {
        const gate = gateScansForAlpa.get(student.id);
        if (!gate) continue;

        const incident: BolosIncident = {
          incidentId: `${journal.id}-${student.id}`,
          studentId: student.id,
          nis: student.nis,
          fullName: student.fullName,
          photoUrl: student.photoUrl,
          classId: journal.classId,
          className: journal.class.className,
          journalId: journal.id,
          subjectName: journal.subject.subjectName,
          subjectCode: journal.subject.subjectCode,
          teacherName: journal.teacher.fullName,
          teacherPhoneWa: journal.teacher.phoneWa,
          periodStart: journal.periodStart,
          periodEnd: journal.periodEnd,
          gateCheckInTime: gate.checkInTime ? gate.checkInTime.toISOString() : null,
          gateStatus: gate.status,
          lateMinutes: gate.lateMinutes,
          detectedAt: new Date().toISOString(),
          homeroomTeacher: journal.class.homeroomTeacher
            ? {
                id: journal.class.homeroomTeacher.id,
                fullName: journal.class.homeroomTeacher.fullName,
                phoneWa: journal.class.homeroomTeacher.phoneWa,
              }
            : null,
          parentContacts: student.parentLinks.map((pl) => ({
            parentId: pl.parent.id,
            fullName: pl.parent.fullName,
            phoneWa: pl.parent.phoneWa,
            relation: pl.relation,
          })),
        };

        bolosIncidents.push(incident);

        // Non-blocking dispatch
        void dispatchBolosWhatsAppAlert(incident);
      }
    }

    return {
      success: true,
      data: {
        savedCount: attendances.length,
        bolosIncidents,
        message:
          bolosIncidents.length > 0
            ? `Presensi tersimpan. Terdeteksi ${bolosIncidents.length} siswa bolos! Notifikasi peringatan telah dikirimkan ke orang tua & Wali Kelas.`
            : `Presensi ${attendances.length} siswa berhasil disimpan dengan sukses.`,
      },
    };
  } catch (err) {
    console.error('Error saving subject attendance:', err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan internal saat menyimpan presensi kelas.',
    };
  }
}
