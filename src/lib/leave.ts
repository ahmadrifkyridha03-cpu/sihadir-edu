import { db } from '@/lib/db';
import {
  LeaveType,
  GateStatus,
  SubjectStatus,
  ApprovalStatus,
  Role,
  type LeaveRequest,
} from '@prisma/client';
import { normalizeDateOnly } from './timezone';
import { notificationHooks } from './notification-hooks';
import type { ServerActionResult } from '@/types/database';

/**
 * Returns an array of calendar Dates from start to end (inclusive),
 * excluding non-school days (Sundays).
 */
export function getSchoolDaysInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = normalizeDateOnly(startDate);
  const stop = normalizeDateOnly(endDate);

  while (current <= stop) {
    // 0 is Sunday in JS Date
    if (current.getUTCDay() !== 0) {
      dates.push(new Date(current.getTime()));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Validates whether the given user has rights to approve/reject a student's leave.
 * Reviewer must be the class homeroom teacher (Wali Kelas) or a System Admin.
 */
export async function assertReviewerAuthorization(
  reviewerUserId: string,
  studentClassId: string
): Promise<{
  authorized: boolean;
  reviewerTeacherId: string | null;
  error?: string;
}> {
  const reviewerUser = await db.user.findUnique({
    where: { id: reviewerUserId },
    include: { teacher: true },
  });

  if (!reviewerUser) {
    return {
      authorized: false,
      reviewerTeacherId: null,
      error: 'Data pengguna peninjau tidak ditemukan.',
    };
  }

  // System Admin has supervisory authority over all classes
  if (reviewerUser.role === Role.ADMIN) {
    return {
      authorized: true,
      reviewerTeacherId: reviewerUser.teacher?.id ?? null,
    };
  }

  // Teacher role must be the homeroom teacher of the student's class
  if (reviewerUser.role === Role.TEACHER) {
    if (!reviewerUser.teacher) {
      return {
        authorized: false,
        reviewerTeacherId: null,
        error: 'Profil guru tidak ditemukan untuk akun ini.',
      };
    }

    const targetClass = await db.class.findUnique({
      where: { id: studentClassId },
      select: { homeroomTeacherId: true, className: true },
    });

    if (targetClass?.homeroomTeacherId !== reviewerUser.teacher.id) {
      return {
        authorized: false,
        reviewerTeacherId: reviewerUser.teacher.id,
        error: `Akses ditolak: Anda bukan Wali Kelas dari rombel ${targetClass?.className ?? 'siswa ini'}.`,
      };
    }

    return {
      authorized: true,
      reviewerTeacherId: reviewerUser.teacher.id,
    };
  }

  return {
    authorized: false,
    reviewerTeacherId: null,
    error: 'Akses ditolak: Peran Anda tidak memiliki wewenang verifikasi permohonan izin.',
  };
}

/**
 * Approves a leave request, atomically upserts GateAttendance records across all dates,
 * retroactively synchronizes any existing SubjectAttendance records from ALPA_BOLOS,
 * and triggers a non-blocking WhatsApp alert to parents.
 */
export async function approveLeaveRequest(
  requestId: string,
  reviewerUserId: string,
  notes?: string
): Promise<ServerActionResult<LeaveRequest>> {
  try {
    // 1. Fetch request with student and parent details
    const request = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        student: {
          include: {
            class: true,
            parentLinks: {
              where: { receiveWaNotif: true },
              include: { parent: true },
            },
          },
        },
        parent: true,
      },
    });

    if (!request) {
      return { success: false, error: 'Data permohonan izin tidak ditemukan.' };
    }

    if (request.approvalStatus === ApprovalStatus.APPROVED) {
      return {
        success: false,
        error: 'Permohonan izin ini sudah disetujui sebelumnya.',
      };
    }

    // 2. Authorize reviewer
    const auth = await assertReviewerAuthorization(reviewerUserId, request.student.classId);
    if (!auth.authorized) {
      return { success: false, error: auth.error ?? 'Akses verifikasi izin ditolak.' };
    }

    const targetGateStatus =
      request.leaveType === LeaveType.SAKIT ? GateStatus.SAKIT : GateStatus.IZIN;
    const targetSubjectStatus =
      request.leaveType === LeaveType.SAKIT ? SubjectStatus.SAKIT : SubjectStatus.IZIN;

    const schoolDates = getSchoolDaysInRange(request.startDate, request.endDate);
    const auditTag = auth.reviewerTeacherId
      ? `LEAVE_APPROVAL:${auth.reviewerTeacherId}`
      : `LEAVE_APPROVAL:ADMIN_${reviewerUserId}`;

    // 3. Execute atomic transaction
    const updatedRequest = await db.$transaction(async (tx) => {
      // 3a. Update LeaveRequest status
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          approvedById: auth.reviewerTeacherId,
        },
      });

      // 3b. Upsert GateAttendance for all school dates in the range
      for (const d of schoolDates) {
        await tx.gateAttendance.upsert({
          where: {
            studentId_attendanceDate: {
              studentId: request.studentId,
              attendanceDate: d,
            },
          },
          create: {
            studentId: request.studentId,
            attendanceDate: d,
            status: targetGateStatus,
            checkInTime: null,
            checkOutTime: null,
            lateMinutes: 0,
            scannedBy: auditTag,
          },
          update: {
            status: targetGateStatus,
            scannedBy: auditTag,
          },
        });

        // 3c. Retroactively synchronize any existing SubjectAttendance on date d
        // Resolves false-positive bolos alerts if teacher marked ALPA_BOLOS before leave approval
        const journalsOnDate = await tx.classJournal.findMany({
          where: {
            classId: request.student.classId,
            journalDate: d,
          },
          select: { id: true },
        });

        if (journalsOnDate.length > 0) {
          const journalIds = journalsOnDate.map((j) => j.id);
          await tx.subjectAttendance.updateMany({
            where: {
              journalId: { in: journalIds },
              studentId: request.studentId,
              status: SubjectStatus.ALPA_BOLOS,
            },
            data: {
              status: targetSubjectStatus,
              note: notes
                ? `Disetujui izin: ${notes}`
                : 'Disetujui dari permohonan izin/sakit resmi',
            },
          });
        }
      }

      return updated;
    });

    // 4. Non-blocking WhatsApp Notification Hook
    void notificationHooks.onLeaveStatusChanged({
      leaveRequest: updatedRequest,
      student: request.student,
      parent: request.parent,
      status: ApprovalStatus.APPROVED,
      notes,
    });

    return {
      success: true,
      data: updatedRequest,
      message: `Permohonan ${request.leaveType} ananda ${request.student.fullName} berhasil disetujui. Presensi gerbang telah diperbarui.`,
    };
  } catch (error) {
    console.error('Error approving leave request:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan internal saat memproses persetujuan izin.',
    };
  }
}

/**
 * Rejects a leave request and triggers a WhatsApp notification to the parent.
 */
export async function rejectLeaveRequest(
  requestId: string,
  reviewerUserId: string,
  notes?: string
): Promise<ServerActionResult<LeaveRequest>> {
  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        student: {
          include: {
            class: true,
            parentLinks: {
              where: { receiveWaNotif: true },
              include: { parent: true },
            },
          },
        },
        parent: true,
      },
    });

    if (!request) {
      return { success: false, error: 'Data permohonan izin tidak ditemukan.' };
    }

    const auth = await assertReviewerAuthorization(reviewerUserId, request.student.classId);
    if (!auth.authorized) {
      return { success: false, error: auth.error ?? 'Akses penolakan izin ditolak.' };
    }

    const updatedRequest = await db.leaveRequest.update({
      where: { id: requestId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedById: auth.reviewerTeacherId,
      },
    });

    // Non-blocking WhatsApp Notification Hook
    void notificationHooks.onLeaveStatusChanged({
      leaveRequest: updatedRequest,
      student: request.student,
      parent: request.parent,
      status: ApprovalStatus.REJECTED,
      notes,
    });

    return {
      success: true,
      data: updatedRequest,
      message: `Permohonan ${request.leaveType} ananda ${request.student.fullName} telah ditolak.`,
    };
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menolak permohonan izin.',
    };
  }
}
