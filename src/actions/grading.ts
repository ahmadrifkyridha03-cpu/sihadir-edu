'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { AssessmentCategory } from '@prisma/client';
import type { ServerActionResult } from '@/types/database';
import { calculateGradeStats, clampScore } from '@/lib/grading';
import { revalidatePath } from 'next/cache';

// ==============================================================================
// 1. ZOD VALIDATION SCHEMAS
// ==============================================================================

export const createAssessmentSchema = z.object({
  classId: z.string().uuid('ID Kelas rombel tidak valid'),
  subjectId: z.string().uuid('ID Mata pelajaran tidak valid'),
  teacherId: z.string().uuid('ID Guru tidak valid'),
  journalId: z.string().uuid('ID Jurnal mengajar tidak valid').optional().nullable(),
  title: z
    .string()
    .trim()
    .min(3, 'Judul penilaian minimal 3 karakter')
    .max(120, 'Judul penilaian maksimal 120 karakter'),
  category: z.nativeEnum(AssessmentCategory, {
    errorMap: () => ({ message: 'Kategori asesmen tidak valid' }),
  }),
  assessmentDate: z.string().or(z.date()).transform((val) => new Date(val)),
  maxScore: z
    .number()
    .min(10, 'Skor maksimal minimal 10')
    .max(100, 'Skor maksimal maksimal 100')
    .default(100),
});

export const studentGradeItemSchema = z.object({
  studentId: z.string().uuid('ID Siswa tidak valid'),
  score: z
    .number()
    .min(0, 'Nilai minimal 0')
    .max(100, 'Nilai maksimal 100'),
  teacherFeedback: z.string().max(255).optional().nullable(),
});

export const saveStudentGradesSchema = z.object({
  assessmentId: z.string().uuid('ID Asesmen tidak valid'),
  grades: z
    .array(studentGradeItemSchema)
    .min(1, 'Minimal terdapat 1 nilai siswa yang dikirimkan'),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type SaveStudentGradesInput = z.infer<typeof saveStudentGradesSchema>;

export interface SaveGradesResult {
  savedCount: number;
  classAverage: number;
  passingRate: number;
  remedialCount: number;
  message: string;
}

// ==============================================================================
// 2. CREATE FORMAL ASSESSMENT ACTION
// ==============================================================================

export async function createAssessmentAction(
  input: CreateAssessmentInput
): Promise<ServerActionResult<{ assessmentId: string; title: string }>> {
  try {
    const parsed = createAssessmentSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data pembuatan asesmen tidak valid.',
        fieldErrors,
      };
    }

    const { classId, subjectId, teacherId, journalId, title, category, assessmentDate, maxScore } =
      parsed.data;

    // Verify relations exist
    const [cls, subject, teacher] = await Promise.all([
      db.class.findUnique({ where: { id: classId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
      db.teacher.findUnique({ where: { id: teacherId } }),
    ]);

    if (!cls) return { success: false, error: 'Kelas rombel tidak ditemukan.' };
    if (!subject) return { success: false, error: 'Mata pelajaran tidak ditemukan.' };
    if (!teacher) return { success: false, error: 'Guru pengajar tidak ditemukan.' };

    const assessment = await db.assessment.create({
      data: {
        classId,
        subjectId,
        teacherId,
        journalId: journalId || null,
        title,
        category,
        assessmentDate,
        maxScore,
      },
    });

    revalidatePath(`/teacher/journal/${journalId || ''}`);

    return {
      success: true,
      data: {
        assessmentId: assessment.id,
        title: assessment.title,
      },
      message: 'Sesi penilaian formal berhasil dibuat.',
    };
  } catch (err) {
    console.error('Error in createAssessmentAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal membuat asesmen formal.',
    };
  }
}

// ==============================================================================
// 3. ATOMIC BATCH GRADE SAVE ACTION
// ==============================================================================

export async function saveStudentGradesAction(
  input: SaveStudentGradesInput
): Promise<ServerActionResult<SaveGradesResult>> {
  try {
    const parsed = saveStudentGradesSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data nilai yang dikirimkan tidak valid.',
        fieldErrors,
      };
    }

    const { assessmentId, grades } = parsed.data;

    // Verify assessment exists and fetch subject KKM
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        subject: true,
        class: {
          include: {
            students: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!assessment) {
      return {
        success: false,
        error: `Asesmen dengan ID ${assessmentId} tidak ditemukan.`,
      };
    }

    const kkm = Number(assessment.subject.kkmScore);

    // Atomic database transaction
    await db.$transaction(async (tx) => {
      for (const gradeItem of grades) {
        const clamped = clampScore(gradeItem.score, 0, Number(assessment.maxScore));
        await tx.studentGrade.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId,
              studentId: gradeItem.studentId,
            },
          },
          create: {
            assessmentId,
            studentId: gradeItem.studentId,
            score: clamped,
            teacherFeedback: gradeItem.teacherFeedback?.trim() || null,
          },
          update: {
            score: clamped,
            teacherFeedback: gradeItem.teacherFeedback?.trim() || null,
          },
        });
      }
    });

    // Compute batch analytics
    const scores = grades.map((g) => clampScore(g.score, 0, Number(assessment.maxScore)));
    const stats = calculateGradeStats(scores, kkm);

    return {
      success: true,
      data: {
        savedCount: grades.length,
        classAverage: stats.average,
        passingRate: stats.passingRate,
        remedialCount: stats.remedialCount,
        message: `${grades.length} nilai berhasil disimpan (${stats.passedCount} tuntas, ${stats.remedialCount} remedial).`,
      },
      message: `${grades.length} nilai siswa berhasil disimpan.`,
    };
  } catch (err) {
    console.error('Error in saveStudentGradesAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan nilai siswa.',
    };
  }
}

// ==============================================================================
// 4. FETCH ASSESSMENT WITH CLASS ROSTER & EXISTING GRADES
// ==============================================================================

export async function getAssessmentWithRosterAction(
  assessmentId: string
): Promise<
  ServerActionResult<{
    assessment: {
      id: string;
      title: string;
      category: AssessmentCategory;
      assessmentDate: string;
      maxScore: number;
      className: string;
      subjectName: string;
      kkmScore: number;
    };
    students: {
      studentId: string;
      nis: string;
      fullName: string;
      score: number | null;
      teacherFeedback: string;
      isExistingGrade: boolean;
    }[];
  }>
> {
  try {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        subject: true,
        class: {
          include: {
            students: {
              where: { status: 'ACTIVE' },
              orderBy: { fullName: 'asc' },
            },
          },
        },
        grades: true,
      },
    });

    if (!assessment) {
      return {
        success: false,
        error: `Asesmen tidak ditemukan.`,
      };
    }

    // Build map of existing grades
    const gradeMap = new Map<string, { score: number; feedback: string | null }>();
    for (const g of assessment.grades) {
      gradeMap.set(g.studentId, {
        score: Number(g.score),
        feedback: g.teacherFeedback,
      });
    }

    const roster = assessment.class.students.map((student) => {
      const existing = gradeMap.get(student.id);
      return {
        studentId: student.id,
        nis: student.nis,
        fullName: student.fullName,
        score: existing ? existing.score : null,
        teacherFeedback: existing?.feedback || '',
        isExistingGrade: Boolean(existing),
      };
    });

    return {
      success: true,
      data: {
        assessment: {
          id: assessment.id,
          title: assessment.title,
          category: assessment.category,
          assessmentDate: assessment.assessmentDate.toISOString().split('T')[0],
          maxScore: Number(assessment.maxScore),
          className: assessment.class.className,
          subjectName: assessment.subject.subjectName,
          kkmScore: Number(assessment.subject.kkmScore),
        },
        students: roster,
      },
    };
  } catch (err) {
    console.error('Error in getAssessmentWithRosterAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memuat daftar nilai asesmen.',
    };
  }
}

// ==============================================================================
// 5. DELETE ASSESSMENT ACTION
// ==============================================================================

export async function deleteAssessmentAction(
  assessmentId: string
): Promise<ServerActionResult<{ deleted: boolean }>> {
  try {
    await db.assessment.delete({
      where: { id: assessmentId },
    });
    return {
      success: true,
      data: { deleted: true },
      message: 'Asesmen berhasil dihapus.',
    };
  } catch (err) {
    console.error('Error in deleteAssessmentAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghapus asesmen.',
    };
  }
}
