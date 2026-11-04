'use server';

import db from '@/lib/db';
import { DocVisibility } from '@prisma/client';
import { isPhotoVisibleToStudent } from '@/lib/activity-feed';
import { getParentSession } from '@/lib/session';

export interface ParentGalleryOptions {
  subjectId?: string;
  limit?: number;
  offset?: number;
}

export interface ParentGalleryItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  visibility: DocVisibility;
  fileSizeKb: number;
  createdAt: string;
  journal: {
    id: string;
    journalDate: string;
    topicMaterial: string;
    periodStart: number;
    periodEnd: number;
    subject: {
      id: string;
      subjectName: string;
      subjectCode: string;
    };
    teacher: {
      id: string;
      fullName: string;
    };
  };
  isTaggedSpecifically: boolean;
}

/**
 * Server Action for fetching student classroom photos with strict relational privacy scoping:
 * - CLASS_PUBLIC: visible to all parents of the student's class
 * - TAGGED_STUDENTS_ONLY: visible only if the active student is tagged
 * - Photos of other classes are never leaked
 */
export async function getParentGalleryAction(
  studentId: string,
  options?: ParentGalleryOptions
): Promise<{ success: boolean; error?: string; data?: ParentGalleryItem[] }> {
  const session = await getParentSession();
  if (!session) {
    return { success: false, error: 'Sesi telah berakhir. Silakan login kembali.' };
  }

  // Verify parent link to this student
  const link = await db.parentStudentLink.findFirst({
    where: {
      parentId: session.parentId,
      studentId: studentId,
    },
  });

  if (!link) {
    return { success: false, error: 'Akses ditolak: Siswa tidak terhubung dengan akun ini.' };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true },
  });

  if (!student) {
    return { success: false, error: 'Siswa tidak ditemukan.' };
  }

  const rawDocs = await db.documentation.findMany({
    where: {
      journal: {
        classId: student.classId,
        ...(options?.subjectId ? { subjectId: options.subjectId } : {}),
      },
    },
    include: {
      journal: {
        include: {
          subject: true,
          teacher: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 40,
    skip: options?.offset || 0,
  });

  // Strict Privacy Filter
  const visibleItems: ParentGalleryItem[] = [];

  for (const doc of rawDocs) {
    if (isPhotoVisibleToStudent(doc, student.id)) {
      let isTagged = false;
      if (doc.taggedStudentIds) {
        try {
          const tagged = Array.isArray(doc.taggedStudentIds)
            ? (doc.taggedStudentIds as string[])
            : JSON.parse(String(doc.taggedStudentIds));
          isTagged = Array.isArray(tagged) && tagged.includes(student.id);
        } catch {
          isTagged = false;
        }
      }

      visibleItems.push({
        id: doc.id,
        imageUrl: doc.imageUrl,
        caption: doc.caption,
        visibility: doc.visibility,
        fileSizeKb: doc.fileSizeKb,
        createdAt: doc.createdAt.toISOString(),
        journal: {
          id: doc.journal.id,
          journalDate: doc.journal.journalDate.toISOString().split('T')[0],
          topicMaterial: doc.journal.topicMaterial,
          periodStart: doc.journal.periodStart,
          periodEnd: doc.journal.periodEnd,
          subject: {
            id: doc.journal.subject.id,
            subjectName: doc.journal.subject.subjectName,
            subjectCode: doc.journal.subject.subjectCode,
          },
          teacher: {
            id: doc.journal.teacher.id,
            fullName: doc.journal.teacher.fullName,
          },
        },
        isTaggedSpecifically: isTagged,
      });
    }
  }

  return { success: true, data: visibleItems };
}
