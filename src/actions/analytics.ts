'use server';

import {
  generateAttendanceMatrixRecap,
  type AttendanceMatrixRecapResult,
  type GenerateMatrixRecapParams,
} from '@/lib/analytics/recap-matrix';
import {
  evaluateClassEarlyWarning,
  type EwsClassSummaryResult,
} from '@/lib/analytics/early-warning';
import { enqueueWhatsAppNotification, formatWaMessage } from '@/lib/whatsapp';
import { db } from '@/lib/db';
import { WaNotifType } from '@prisma/client';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Server action to generate attendance matrix recap.
 */
export async function getAttendanceMatrixRecapAction(
  params: GenerateMatrixRecapParams
): Promise<ActionResponse<AttendanceMatrixRecapResult>> {
  try {
    const result = await generateAttendanceMatrixRecap(params);
    return {
      success: true,
      message: 'Berhasil memuat data rekap absensi.',
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal memuat rekap absensi.',
      error: errorMsg,
    };
  }
}

/**
 * Server action to evaluate early warning alerts for a class.
 */
export async function getEwsClassEvaluationsAction(params: {
  classId: string;
  year?: number;
  month?: number;
  semester?: 1 | 2;
  schoolDaysPerWeek?: 5 | 6;
}): Promise<ActionResponse<EwsClassSummaryResult>> {
  try {
    const result = await evaluateClassEarlyWarning(params);
    return {
      success: true,
      message: 'Berhasil memuat evaluasi Early Warning System.',
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal memuat evaluasi Early Warning System.',
      error: errorMsg,
    };
  }
}

/**
 * Server action to dispatch 1-tap WhatsApp alert for an EWS flagged student.
 */
export async function dispatchEwsWhatsAppAlertAction(params: {
  studentId: string;
  customMessage?: string;
}): Promise<ActionResponse<{ logId: string; targetPhone: string }>> {
  try {
    const student = await db.student.findUnique({
      where: { id: params.studentId },
      include: {
        class: true,
        parentLinks: {
          where: { receiveWaNotif: true },
          include: { parent: true },
        },
      },
    });

    if (!student) {
      return { success: false, message: 'Data siswa tidak ditemukan.' };
    }

    const parentLink = student.parentLinks[0];
    if (!parentLink?.parent?.phoneWa) {
      return {
        success: false,
        message: 'Nomor WhatsApp orang tua tidak terdaftar atau belum diaktifkan.',
      };
    }

    const targetPhone = parentLink.parent.phoneWa;
    const body =
      params.customMessage ||
      `Pemberitahuan Peringatan Dini: Mohon perhatian Bapak/Ibu orang tua dari ananda ${student.fullName} (${student.class.className}). Silakan hubungi pihak sekolah untuk koordinasi bimbingan presensi.`;

    const log = await enqueueWhatsAppNotification({
      studentId: student.id,
      targetPhone,
      notifType: WaNotifType.ABSENT_ALERT,
      messageBody: body,
    });

    return {
      success: true,
      message: `Peringatan WhatsApp berhasil dimasukkan ke antrean pengiriman untuk ${student.fullName}.`,
      data: {
        logId: log.id,
        targetPhone,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal mengirim peringatan WhatsApp.',
      error: errorMsg,
    };
  }
}
