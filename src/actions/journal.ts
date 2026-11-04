'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  SubjectStatus,
  EngagementBadge,
  DocVisibility,
  AssessmentCategory,
  GateStatus,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import type { ServerActionResult } from '@/types/database';
import { normalizeDateOnly } from '@/lib/timezone';
import { notificationHooks } from '@/lib/notification-hooks';
import { clampScore } from '@/lib/grading';

// ==============================================================================
// 1. ZOD VALIDATION SCHEMAS
// ==============================================================================

export const subjectAttendanceItemSchema = z.object({
  studentId: z.string().uuid('ID Siswa tidak valid'),
  status: z.nativeEnum(SubjectStatus),
  engagementBadge: z.nativeEnum(EngagementBadge).default(EngagementBadge.GOOD),
  note: z.string().max(255).optional().nullable(),
});

export const journalDocumentationItemSchema = z.object({
  imageUrl: z.string().min(1, 'URL foto dokumentasi tidak valid'),
  caption: z.string().max(255).optional().nullable(),
  visibility: z.nativeEnum(DocVisibility).default(DocVisibility.CLASS_PUBLIC),
  taggedStudentIds: z.array(z.string().uuid()).optional().default([]),
  fileSizeKb: z.number().int().min(1).max(250, 'Ukuran foto maksimal 250 KB'),
});

export const linkedAssessmentItemSchema = z.object({
  title: z.string().trim().min(3, 'Judul penilaian minimal 3 karakter').max(120),
  category: z.nativeEnum(AssessmentCategory).default(AssessmentCategory.TUGAS),
  maxScore: z.number().min(10).max(100).default(100),
  grades: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        score: z.number().min(0).max(100),
        teacherFeedback: z.string().max(255).optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export const createJournalSchema = z.object({
  classId: z.string().uuid('ID Kelas rombel wajib diisi'),
  subjectId: z.string().uuid('ID Mata Pelajaran wajib diisi'),
  teacherId: z.string().uuid('ID Guru wajib diisi'),
  scheduleId: z.string().uuid().optional().nullable(),
  journalDate: z.string().or(z.date()),
  periodStart: z.number().int().min(1).max(12),
  periodEnd: z.number().int().min(1).max(12),
  topicMaterial: z
    .string()
    .trim()
    .min(3, 'Topik materi pembelajaran wajib diisi minimal 3 karakter')
    .max(255),
  teacherNotes: z.string().optional().nullable(),
  isLocked: z.boolean().optional().default(false),
  attendances: z
    .array(subjectAttendanceItemSchema)
    .min(1, 'Presensi minimal 1 siswa harus disertakan'),
  documentations: z
    .array(journalDocumentationItemSchema)
    .max(5, 'Maksimal 5 foto dokumentasi')
    .optional()
    .default([]),
  assessment: linkedAssessmentItemSchema.optional().nullable(),
});

export const updateJournalSchema = createJournalSchema.extend({
  journalId: z.string().uuid('ID Jurnal wajib disertakan'),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;

export interface JournalMutationResult {
  journalId: string;
  isLocked: boolean;
  bolosCount: number;
}

// ==============================================================================
// 2. HELPER: DISPATCH BOLOS ALERTS
// ==============================================================================

async function checkAndDispatchBolos(params: {
  classId: string;
  subjectId: string;
  teacherId: string;
  journalDate: Date;
  periodStart: number;
  periodEnd: number;
  attendances: { studentId: string; status: SubjectStatus }[];
}): Promise<number> {
  const { classId, subjectId, teacherId, journalDate, periodStart, periodEnd, attendances } =
    params;

  const bolosStudentIds = attendances
    .filter((a) => a.status === SubjectStatus.ALPA_BOLOS)
    .map((a) => a.studentId);

  if (bolosStudentIds.length === 0) return 0;

  // Query gate attendances for these students on that date
  const gateRecords = await db.gateAttendance.findMany({
    where: {
      studentId: { in: bolosStudentIds },
      attendanceDate: journalDate,
      status: { in: [GateStatus.HADIR, GateStatus.TERLAMBAT] },
    },
    include: {
      student: {
        include: { class: true },
      },
    },
  });

  if (gateRecords.length === 0) return 0;

  const [classInfo, subject, teacher] = await Promise.all([
    db.class.findUnique({ where: { id: classId } }),
    db.subject.findUnique({ where: { id: subjectId } }),
    db.teacher.findUnique({ where: { id: teacherId } }),
  ]);

  if (!classInfo || !subject || !teacher) return 0;

  for (const record of gateRecords) {
    await notificationHooks.onBolosDetected({
      student: record.student,
      classInfo,
      subject,
      teacher,
      periodStart,
      periodEnd,
    });
  }

  return gateRecords.length;
}

// ==============================================================================
// 3. CREATE CLASS JOURNAL ACTION
// ==============================================================================

export async function createJournalAction(
  input: CreateJournalInput
): Promise<ServerActionResult<JournalMutationResult>> {
  try {
    const parsed = createJournalSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data pembuatan jurnal kelas tidak valid.',
        fieldErrors,
      };
    }

    const {
      classId,
      subjectId,
      teacherId,
      scheduleId,
      journalDate,
      periodStart,
      periodEnd,
      topicMaterial,
      teacherNotes,
      isLocked,
      attendances,
      documentations,
      assessment,
    } = parsed.data;

    const normalizedDate = normalizeDateOnly(journalDate);

    // Verify relations
    const [cls, subject, teacher] = await Promise.all([
      db.class.findUnique({ where: { id: classId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
      db.teacher.findUnique({ where: { id: teacherId } }),
    ]);

    if (!cls) return { success: false, error: 'Kelas rombel tidak ditemukan.' };
    if (!subject) return { success: false, error: 'Mata pelajaran tidak ditemukan.' };
    if (!teacher) return { success: false, error: 'Guru pengajar tidak ditemukan.' };

    const notesWithLock =
      isLocked && teacherNotes && !teacherNotes.includes('[LOCKED]')
        ? `[LOCKED] ${teacherNotes}`
        : isLocked && !teacherNotes
        ? '[LOCKED]'
        : teacherNotes;

    // Atomic Database Transaction
    const journalId = await db.$transaction(async (tx) => {
      // 1. Create ClassJournal
      const journal = await tx.classJournal.create({
        data: {
          classId,
          subjectId,
          teacherId,
          scheduleId: scheduleId || null,
          journalDate: normalizedDate,
          periodStart,
          periodEnd,
          topicMaterial,
          teacherNotes: notesWithLock || null,
        },
      });

      // 2. Insert Student Attendances
      for (const a of attendances) {
        await tx.subjectAttendance.create({
          data: {
            journalId: journal.id,
            studentId: a.studentId,
            status: a.status,
            engagementBadge: a.engagementBadge,
            note: a.note?.trim() || null,
          },
        });
      }

      // 3. Insert Documentation Photos
      if (documentations && documentations.length > 0) {
        for (const doc of documentations) {
          await tx.documentation.create({
            data: {
              journalId: journal.id,
              imageUrl: doc.imageUrl,
              caption: doc.caption?.trim() || null,
              visibility: doc.visibility,
              taggedStudentIds:
                doc.taggedStudentIds && doc.taggedStudentIds.length > 0
                  ? doc.taggedStudentIds
                  : undefined,
              fileSizeKb: doc.fileSizeKb,
            },
          });
        }
      }

      // 4. Create Linked Formal Assessment (if provided)
      if (assessment) {
        const createdAssessment = await tx.assessment.create({
          data: {
            classId,
            subjectId,
            teacherId,
            journalId: journal.id,
            title: assessment.title,
            category: assessment.category,
            assessmentDate: normalizedDate,
            maxScore: assessment.maxScore,
          },
        });

        if (assessment.grades && assessment.grades.length > 0) {
          for (const g of assessment.grades) {
            await tx.studentGrade.create({
              data: {
                assessmentId: createdAssessment.id,
                studentId: g.studentId,
                score: clampScore(g.score, 0, assessment.maxScore),
                teacherFeedback: g.teacherFeedback?.trim() || null,
              },
            });
          }
        }
      }

      return journal.id;
    });

    // Check for Truancy / Bolos anomalies & notify parents
    const bolosCount = await checkAndDispatchBolos({
      classId,
      subjectId,
      teacherId,
      journalDate: normalizedDate,
      periodStart,
      periodEnd,
      attendances,
    });

    revalidatePath('/teacher/dashboard');
    revalidatePath(`/teacher/journal/${journalId}`);

    return {
      success: true,
      data: {
        journalId,
        isLocked: Boolean(isLocked),
        bolosCount,
      },
      message: isLocked
        ? 'Jurnal mengajar berhasil disimpan, dikunci, dan dipublikasikan.'
        : 'Draf jurnal mengajar berhasil disimpan.',
    };
  } catch (err) {
    console.error('Error in createJournalAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan jurnal mengajar.',
    };
  }
}

// ==============================================================================
// 4. UPDATE CLASS JOURNAL ACTION
// ==============================================================================

export async function updateJournalAction(
  input: UpdateJournalInput
): Promise<ServerActionResult<JournalMutationResult>> {
  try {
    const parsed = updateJournalSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data pembaruan jurnal kelas tidak valid.',
        fieldErrors,
      };
    }

    const {
      journalId,
      classId,
      subjectId,
      teacherId,
      scheduleId,
      journalDate,
      periodStart,
      periodEnd,
      topicMaterial,
      teacherNotes,
      isLocked,
      attendances,
      documentations,
      assessment,
    } = parsed.data;

    // Check existing lock status
    const existing = await db.classJournal.findUnique({
      where: { id: journalId },
    });

    if (!existing) {
      return { success: false, error: 'Jurnal mengajar tidak ditemukan.' };
    }

    const wasLocked = existing.teacherNotes?.includes('[LOCKED]');
    if (wasLocked && !isLocked) {
      return {
        success: false,
        error: 'Jurnal ini telah dikunci dan dipublikasikan. Tidak dapat diubah kembali.',
      };
    }

    const normalizedDate = normalizeDateOnly(journalDate);

    const notesWithLock =
      isLocked && teacherNotes && !teacherNotes.includes('[LOCKED]')
        ? `[LOCKED] ${teacherNotes}`
        : isLocked && !teacherNotes
        ? '[LOCKED]'
        : teacherNotes;

    await db.$transaction(async (tx) => {
      // 1. Update ClassJournal header
      await tx.classJournal.update({
        where: { id: journalId },
        data: {
          classId,
          subjectId,
          teacherId,
          scheduleId: scheduleId || null,
          journalDate: normalizedDate,
          periodStart,
          periodEnd,
          topicMaterial,
          teacherNotes: notesWithLock || null,
        },
      });

      // 2. Upsert Attendances
      for (const a of attendances) {
        await tx.subjectAttendance.upsert({
          where: {
            journalId_studentId: {
              journalId,
              studentId: a.studentId,
            },
          },
          create: {
            journalId,
            studentId: a.studentId,
            status: a.status,
            engagementBadge: a.engagementBadge,
            note: a.note?.trim() || null,
          },
          update: {
            status: a.status,
            engagementBadge: a.engagementBadge,
            note: a.note?.trim() || null,
          },
        });
      }

      // 3. Reconcile Documentations
      if (documentations) {
        await tx.documentation.deleteMany({
          where: { journalId },
        });

        for (const doc of documentations) {
          await tx.documentation.create({
            data: {
              journalId,
              imageUrl: doc.imageUrl,
              caption: doc.caption?.trim() || null,
              visibility: doc.visibility,
              taggedStudentIds:
                doc.taggedStudentIds && doc.taggedStudentIds.length > 0
                  ? doc.taggedStudentIds
                  : undefined,
              fileSizeKb: doc.fileSizeKb,
            },
          });
        }
      }

      // 4. Update or Create Assessment
      if (assessment) {
        const existingAssessment = await tx.assessment.findFirst({
          where: { journalId },
        });

        const targetAssessmentId = existingAssessment
          ? existingAssessment.id
          : (
              await tx.assessment.create({
                data: {
                  classId,
                  subjectId,
                  teacherId,
                  journalId,
                  title: assessment.title,
                  category: assessment.category,
                  assessmentDate: normalizedDate,
                  maxScore: assessment.maxScore,
                },
              })
            ).id;

        if (existingAssessment) {
          await tx.assessment.update({
            where: { id: targetAssessmentId },
            data: {
              title: assessment.title,
              category: assessment.category,
              maxScore: assessment.maxScore,
            },
          });
        }

        if (assessment.grades && assessment.grades.length > 0) {
          for (const g of assessment.grades) {
            await tx.studentGrade.upsert({
              where: {
                assessmentId_studentId: {
                  assessmentId: targetAssessmentId,
                  studentId: g.studentId,
                },
              },
              create: {
                assessmentId: targetAssessmentId,
                studentId: g.studentId,
                score: clampScore(g.score, 0, assessment.maxScore),
                teacherFeedback: g.teacherFeedback?.trim() || null,
              },
              update: {
                score: clampScore(g.score, 0, assessment.maxScore),
                teacherFeedback: g.teacherFeedback?.trim() || null,
              },
            });
          }
        }
      }
    });

    const bolosCount = await checkAndDispatchBolos({
      classId,
      subjectId,
      teacherId,
      journalDate: normalizedDate,
      periodStart,
      periodEnd,
      attendances,
    });

    revalidatePath('/teacher/dashboard');
    revalidatePath(`/teacher/journal/${journalId}`);

    return {
      success: true,
      data: {
        journalId,
        isLocked: Boolean(isLocked),
        bolosCount,
      },
      message: isLocked
        ? 'Jurnal mengajar berhasil diperbarui dan dikunci.'
        : 'Jurnal mengajar berhasil diperbarui.',
    };
  } catch (err) {
    console.error('Error in updateJournalAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memperbarui jurnal mengajar.',
    };
  }
}

// ==============================================================================
// 5. LOCK JOURNAL ACTION
// ==============================================================================

export async function lockJournalAction(
  journalId: string
): Promise<ServerActionResult<{ journalId: string; isLocked: true; bolosCount: number }>> {
  try {
    const journal = await db.classJournal.findUnique({
      where: { id: journalId },
      include: {
        subjectAttendances: true,
      },
    });

    if (!journal) {
      return { success: false, error: 'Jurnal mengajar tidak ditemukan.' };
    }

    const currentNotes = journal.teacherNotes || '';
    const updatedNotes = currentNotes.includes('[LOCKED]')
      ? currentNotes
      : currentNotes.trim()
      ? `[LOCKED] ${currentNotes.trim()}`
      : '[LOCKED]';

    await db.classJournal.update({
      where: { id: journalId },
      data: {
        teacherNotes: updatedNotes,
      },
    });

    // Check for bolos
    const bolosCount = await checkAndDispatchBolos({
      classId: journal.classId,
      subjectId: journal.subjectId,
      teacherId: journal.teacherId,
      journalDate: journal.journalDate,
      periodStart: journal.periodStart,
      periodEnd: journal.periodEnd,
      attendances: journal.subjectAttendances,
    });

    revalidatePath(`/teacher/journal/${journalId}`);

    return {
      success: true,
      data: {
        journalId,
        isLocked: true,
        bolosCount,
      },
      message: 'Jurnal mengajar berhasil dikunci dan dipublikasikan.',
    };
  } catch (err) {
    console.error('Error in lockJournalAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengunci jurnal.',
    };
  }
}

// ==============================================================================
// 6. GET JOURNAL DETAILS ACTION
// ==============================================================================

export async function getJournalDetailsAction(journalId: string): Promise<
  ServerActionResult<{
    journal: {
      id: string;
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      kkmScore: number;
      teacherId: string;
      teacherName: string;
      scheduleId: string | null;
      journalDate: string;
      periodStart: number;
      periodEnd: number;
      topicMaterial: string;
      teacherNotes: string | null;
      isLocked: boolean;
    };
    attendances: {
      studentId: string;
      nis: string;
      fullName: string;
      status: SubjectStatus;
      engagementBadge: EngagementBadge;
      note: string | null;
    }[];
    documentations: {
      id: string;
      imageUrl: string;
      caption: string | null;
      visibility: DocVisibility;
      taggedStudentIds: string[];
      fileSizeKb: number;
    }[];
    assessment: {
      id: string;
      title: string;
      category: AssessmentCategory;
      maxScore: number;
      grades: {
        studentId: string;
        score: number;
        teacherFeedback: string | null;
      }[];
    } | null;
  }>
> {
  try {
    const journal = await db.classJournal.findUnique({
      where: { id: journalId },
      include: {
        class: {
          include: {
            students: {
              where: { status: 'ACTIVE' },
              orderBy: { fullName: 'asc' },
            },
          },
        },
        subject: true,
        teacher: true,
        subjectAttendances: true,
        documentations: true,
        assessments: {
          include: {
            grades: true,
          },
        },
      },
    });

    if (!journal) {
      return { success: false, error: 'Jurnal mengajar tidak ditemukan.' };
    }

    const attendanceMap = new Map<string, (typeof journal.subjectAttendances)[0]>();
    for (const a of journal.subjectAttendances) {
      attendanceMap.set(a.studentId, a);
    }

    const attendances = journal.class.students.map((student) => {
      const recorded = attendanceMap.get(student.id);
      return {
        studentId: student.id,
        nis: student.nis,
        fullName: student.fullName,
        status: recorded?.status || SubjectStatus.HADIR,
        engagementBadge: recorded?.engagementBadge || EngagementBadge.GOOD,
        note: recorded?.note || null,
      };
    });

    const isLocked = Boolean(journal.teacherNotes?.includes('[LOCKED]'));

    const linkedAssessment = journal.assessments[0];
    const assessmentData = linkedAssessment
      ? {
          id: linkedAssessment.id,
          title: linkedAssessment.title,
          category: linkedAssessment.category,
          maxScore: Number(linkedAssessment.maxScore),
          grades: linkedAssessment.grades.map((g) => ({
            studentId: g.studentId,
            score: Number(g.score),
            teacherFeedback: g.teacherFeedback,
          })),
        }
      : null;

    return {
      success: true,
      data: {
        journal: {
          id: journal.id,
          classId: journal.classId,
          className: journal.class.className,
          subjectId: journal.subjectId,
          subjectName: journal.subject.subjectName,
          kkmScore: Number(journal.subject.kkmScore),
          teacherId: journal.teacherId,
          teacherName: journal.teacher.fullName,
          scheduleId: journal.scheduleId,
          journalDate: journal.journalDate.toISOString().split('T')[0],
          periodStart: journal.periodStart,
          periodEnd: journal.periodEnd,
          topicMaterial: journal.topicMaterial,
          teacherNotes: journal.teacherNotes,
          isLocked,
        },
        attendances,
        documentations: journal.documentations.map((d) => ({
          id: d.id,
          imageUrl: d.imageUrl,
          caption: d.caption,
          visibility: d.visibility,
          taggedStudentIds: Array.isArray(d.taggedStudentIds)
            ? (d.taggedStudentIds as string[])
            : [],
          fileSizeKb: d.fileSizeKb,
        })),
        assessment: assessmentData,
      },
    };
  } catch (err) {
    console.error('Error in getJournalDetailsAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memuat detail jurnal.',
    };
  }
}
