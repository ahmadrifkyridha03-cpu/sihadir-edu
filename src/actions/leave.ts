'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  LeaveType,
  ApprovalStatus,
  Role,
  type LeaveRequest,
} from '@prisma/client';
import { normalizeDateOnly } from '@/lib/timezone';
import {
  approveLeaveRequest,
  rejectLeaveRequest,
} from '@/lib/leave';
import type {
  ServerActionResult,
  LeaveRequestWithDetails,
} from '@/types/database';

const submitLeaveRequestSchema = z
  .object({
    studentId: z.string().uuid('ID Siswa tidak valid'),
    parentId: z.string().uuid('ID Orang Tua tidak valid'),
    leaveType: z.nativeEnum(LeaveType, {
      errorMap: () => ({ message: 'Pilih jenis permohonan: SAKIT atau IZIN' }),
    }),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()),
    reason: z
      .string()
      .trim()
      .min(5, 'Alasan permohonan minimal 5 karakter')
      .max(1000, 'Alasan permohonan maksimal 1000 karakter'),
    attachmentUrl: z
      .string()
      .url('URL lampiran tidak valid')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      const start = normalizeDateOnly(data.startDate).getTime();
      const end = normalizeDateOnly(data.endDate).getTime();
      return start <= end;
    },
    {
      message: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      const start = normalizeDateOnly(data.startDate);
      const end = normalizeDateOnly(data.endDate);
      const diffDays =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays <= 14;
    },
    {
      message:
        'Permohonan izin mandiri maksimal 14 hari berturut-turut. Untuk cuti panjang, hubungi pihak kurikulum sekolah.',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      const start = normalizeDateOnly(data.startDate);
      const end = normalizeDateOnly(data.endDate);
      const diffDays =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      // SAKIT > 1 day requires doctor's note attachment per PRD
      if (data.leaveType === LeaveType.SAKIT && diffDays > 1) {
        return Boolean(data.attachmentUrl && data.attachmentUrl.trim().length > 0);
      }
      return true;
    },
    {
      message:
        'Untuk permohonan Sakit lebih dari 1 hari, wajib melampirkan foto Surat Keterangan Dokter.',
      path: ['attachmentUrl'],
    }
  );

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;

/**
 * Server Action to submit a new student leave request from the Parent Portal.
 */
export async function submitLeaveRequestAction(
  input: SubmitLeaveRequestInput
): Promise<ServerActionResult<LeaveRequest>> {
  try {
    const parsed = submitLeaveRequestSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: 'Formulir permohonan izin belum lengkap atau tidak valid.',
        fieldErrors,
      };
    }

    const data = parsed.data;
    const normalizedStart = normalizeDateOnly(data.startDate);
    const normalizedEnd = normalizeDateOnly(data.endDate);

    // 1. Authorize parent relation to student
    const link = await db.parentStudentLink.findUnique({
      where: {
        parentId_studentId: {
          parentId: data.parentId,
          studentId: data.studentId,
        },
      },
    });

    if (!link) {
      return {
        success: false,
        error: 'Akses ditolak: Anda tidak terdaftar sebagai orang tua/wali resmi dari siswa ini.',
      };
    }

    // 2. Check for overlapping active leave requests
    const overlapping = await db.leaveRequest.findFirst({
      where: {
        studentId: data.studentId,
        approvalStatus: { in: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] },
        startDate: { lte: normalizedEnd },
        endDate: { gte: normalizedStart },
      },
    });

    if (overlapping) {
      return {
        success: false,
        error: `Sudah terdapat permohonan ${overlapping.leaveType} yang aktif (${overlapping.approvalStatus}) pada rentang tanggal tersebut.`,
      };
    }

    // 3. Create leave request
    const created = await db.leaveRequest.create({
      data: {
        studentId: data.studentId,
        parentId: data.parentId,
        leaveType: data.leaveType,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl ? data.attachmentUrl.trim() : null,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });

    return {
      success: true,
      data: created,
      message: `Permohonan ${created.leaveType} berhasil diajukan dan sedang menunggu verifikasi Wali Kelas.`,
    };
  } catch (err) {
    console.error('Error submitting leave request:', err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan internal saat mengajukan permohonan izin.',
    };
  }
}

/**
 * Server Action for Homeroom Teacher / Admin to approve a student leave request.
 * Triggers multi-day gate synchronization and retroactive subject attendance update.
 */
export async function approveLeaveRequestAction(
  requestId: string,
  reviewerUserId: string,
  notes?: string
): Promise<ServerActionResult<LeaveRequest>> {
  return approveLeaveRequest(requestId, reviewerUserId, notes);
}

/**
 * Server Action for Homeroom Teacher / Admin to reject a student leave request.
 */
export async function rejectLeaveRequestAction(
  requestId: string,
  reviewerUserId: string,
  notes?: string
): Promise<ServerActionResult<LeaveRequest>> {
  return rejectLeaveRequest(requestId, reviewerUserId, notes);
}

/**
 * Server Action to retrieve pending leave requests for a reviewer.
 * Filters by assigned class for homeroom teachers, or returns all for admins.
 */
export async function getPendingLeaveRequestsAction(
  reviewerUserId?: string
): Promise<ServerActionResult<LeaveRequestWithDetails[]>> {
  try {
    let classIdFilter: string | undefined = undefined;

    if (reviewerUserId) {
      const user = await db.user.findUnique({
        where: { id: reviewerUserId },
        include: { teacher: true },
      });

      if (user && user.role === Role.TEACHER && user.teacher) {
        const homeroomClass = await db.class.findFirst({
          where: { homeroomTeacherId: user.teacher.id },
          select: { id: true },
        });

        if (homeroomClass) {
          classIdFilter = homeroomClass.id;
        }
      }
    }

    const requests = await db.leaveRequest.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        ...(classIdFilter ? { student: { classId: classIdFilter } } : {}),
      },
      include: {
        student: {
          include: {
            class: true,
          },
        },
        parent: true,
        approvedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: requests,
    };
  } catch (err) {
    console.error('Error fetching pending leave requests:', err);
    return {
      success: false,
      error: 'Gagal memuat daftar permohonan izin.',
    };
  }
}

/**
 * Retrieves leave history for a specific student.
 */
export async function getStudentLeaveHistoryAction(
  studentId: string
): Promise<ServerActionResult<LeaveRequestWithDetails[]>> {
  try {
    const history = await db.leaveRequest.findMany({
      where: { studentId },
      include: {
        student: {
          include: {
            class: true,
          },
        },
        parent: true,
        approvedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: history,
    };
  } catch (err) {
    console.error('Error fetching student leave history:', err);
    return {
      success: false,
      error: 'Gagal memuat riwayat izin siswa.',
    };
  }
}
