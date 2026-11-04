'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { DocVisibility } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import type { ServerActionResult } from '@/types/database';

export const documentationPhotoItemSchema = z.object({
  imageUrl: z.string().min(1, 'Payload foto tidak boleh kosong'),
  caption: z
    .string()
    .trim()
    .max(255, 'Keterangan foto maksimal 255 karakter')
    .optional()
    .nullable(),
  visibility: z.nativeEnum(DocVisibility).default(DocVisibility.CLASS_PUBLIC),
  taggedStudentIds: z.array(z.string().uuid()).optional().default([]),
  fileSizeKb: z
    .number()
    .int('Ukuran file harus dalam integer KB')
    .positive('Ukuran file harus lebih besar dari 0 KB')
    .max(
      250,
      'File ditolak: ukuran melebihi batas maksimal server 250 KB (wajib kompresi WebP di browser)'
    ),
});

export const uploadJournalDocumentationSchema = z.object({
  journalId: z.string().uuid('ID Jurnal mengajar tidak valid'),
  photos: z
    .array(documentationPhotoItemSchema)
    .min(1, 'Minimal 1 foto dokumentasi harus diunggah')
    .max(5, 'Maksimal 5 foto dokumentasi per sesi jurnal'),
  uploadedBy: z.string().uuid('ID Pengunggah tidak valid').optional().nullable(),
});

export type UploadJournalDocumentationInput = z.infer<typeof uploadJournalDocumentationSchema>;

export interface UploadJournalDocumentationResult {
  savedCount: number;
  documentationIds: string[];
  message: string;
}

/**
 * Server Action to upload and persist 1 to 5 compressed classroom photos
 * linked to a teaching journal session.
 */
export async function uploadJournalDocumentationAction(
  input: UploadJournalDocumentationInput
): Promise<ServerActionResult<UploadJournalDocumentationResult>> {
  try {
    const parsed = uploadJournalDocumentationSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Data foto dokumentasi yang dikirimkan tidak valid.',
        fieldErrors,
      };
    }

    const { journalId, photos } = parsed.data;

    // Verify journal exists
    const journal = await db.classJournal.findUnique({
      where: { id: journalId },
    });

    if (!journal) {
      return {
        success: false,
        error: `Jurnal mengajar dengan ID ${journalId} tidak ditemukan.`,
      };
    }

    // Atomic insert of all documentation photos
    const createdIds: string[] = [];

    await db.$transaction(async (tx) => {
      for (const p of photos) {
        const doc = await tx.documentation.create({
          data: {
            journalId,
            imageUrl: p.imageUrl,
            caption: p.caption?.trim() || null,
            visibility: p.visibility,
            taggedStudentIds: p.taggedStudentIds && p.taggedStudentIds.length > 0
              ? p.taggedStudentIds
              : undefined,
            fileSizeKb: p.fileSizeKb,
          },
        });
        createdIds.push(doc.id);
      }
    });

    revalidatePath(`/teacher/journal/${journalId}`);

    return {
      success: true,
      data: {
        savedCount: createdIds.length,
        documentationIds: createdIds,
        message: `${createdIds.length} foto dokumentasi berhasil disimpan.`,
      },
      message: `${createdIds.length} foto dokumentasi berhasil disimpan.`,
    };
  } catch (err) {
    console.error('Error in uploadJournalDocumentationAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan dokumentasi kelas.',
    };
  }
}

/**
 * Server Action to delete a documentation photo record.
 */
export async function deleteDocumentationAction(
  documentationId: string
): Promise<ServerActionResult<{ deleted: boolean }>> {
  try {
    const doc = await db.documentation.findUnique({
      where: { id: documentationId },
    });

    if (!doc) {
      return {
        success: false,
        error: 'Foto dokumentasi tidak ditemukan.',
      };
    }

    await db.documentation.delete({
      where: { id: documentationId },
    });

    revalidatePath(`/teacher/journal/${doc.journalId}`);

    return {
      success: true,
      data: { deleted: true },
      message: 'Foto dokumentasi berhasil dihapus.',
    };
  } catch (err) {
    console.error('Error in deleteDocumentationAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghapus foto dokumentasi.',
    };
  }
}

/**
 * Server Action to fetch all documentation records for a class journal.
 */
export async function getJournalDocumentationsAction(
  journalId: string
): Promise<
  ServerActionResult<
    {
      id: string;
      imageUrl: string;
      caption: string | null;
      visibility: DocVisibility;
      taggedStudentIds: string[];
      fileSizeKb: number;
      createdAt: string;
    }[]
  >
> {
  try {
    const docs = await db.documentation.findMany({
      where: { journalId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = docs.map((d) => ({
      id: d.id,
      imageUrl: d.imageUrl,
      caption: d.caption,
      visibility: d.visibility,
      taggedStudentIds: Array.isArray(d.taggedStudentIds)
        ? (d.taggedStudentIds as string[])
        : [],
      fileSizeKb: d.fileSizeKb,
      createdAt: d.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: formatted,
    };
  } catch (err) {
    console.error('Error in getJournalDocumentationsAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memuat dokumentasi.',
    };
  }
}
