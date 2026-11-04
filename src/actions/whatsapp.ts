'use server';

import { db } from '@/lib/db';
import {
  processWaNotificationQueue,
  getWaGatewayClient,
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  formatWaMessage,
  TEMPLATE_GATE_IN,
  type ProcessQueueResult,
} from '@/lib/whatsapp';
import { WaNotifType, WaStatus } from '@prisma/client';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Server Action to trigger processing of queued WhatsApp notifications.
 */
export async function processWaQueueAction(options?: {
  batchSize?: number;
  minJitterSec?: number;
  maxJitterSec?: number;
}): Promise<ActionResponse<ProcessQueueResult>> {
  try {
    const result = await processWaNotificationQueue({
      batchSize: options?.batchSize || 10,
      minJitterSec: options?.minJitterSec,
      maxJitterSec: options?.maxJitterSec,
    });

    return {
      success: true,
      message: `Berhasil memproses antrean: ${result.sentCount} terkirim, ${result.failedCount} gagal.`,
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal memproses antrean WhatsApp',
      error: errorMsg,
    };
  }
}

/**
 * Server Action to send an instant test message to a specified phone number.
 */
export async function testSendWhatsAppAction(params: {
  phone: string;
  customMessage?: string;
}): Promise<ActionResponse<{ messageId?: string; sentTo: string }>> {
  try {
    const normalized = normalizeIndonesianPhone(params.phone);
    if (!isValidIndonesianPhone(normalized)) {
      return {
        success: false,
        message: 'Nomor WhatsApp tidak valid. Gunakan format Indonesia (misal: 081234567890).',
      };
    }

    const client = getWaGatewayClient();
    const message =
      params.customMessage ||
      formatWaMessage(TEMPLATE_GATE_IN, {
        parent_name: 'Bapak/Ibu Penguji',
        student_name: 'Siswa Contoh',
        class: 'X-IPA-1',
        time: '06:55 WIB',
        portal_link: process.env.NEXT_PUBLIC_APP_URL || 'https://sihadir.sch.id',
        school_name: 'SMA Negeri 1 Harapan Bangsa',
      });

    const result = await client.sendMessage({
      targetPhone: normalized,
      message,
      notifType: WaNotifType.GATE_IN,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Gagal mengirim pesan: ${result.error || 'Unknown gateway error'}`,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `Pesan uji coba berhasil dikirim ke ${normalized} via provider ${result.provider}.`,
      data: {
        messageId: result.messageId,
        sentTo: normalized,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Terjadi kesalahan internal saat mengirim pesan uji coba.',
      error: errorMsg,
    };
  }
}

/**
 * Server Action to fetch notification logs with pagination and filters.
 */
export async function getNotificationLogsAction(params?: {
  status?: WaStatus;
  notifType?: WaNotifType;
  studentId?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: {
      status?: WaStatus;
      notifType?: WaNotifType;
      studentId?: string;
    } = {};

    if (params?.status) where.status = params.status;
    if (params?.notifType) where.notifType = params.notifType;
    if (params?.studentId) where.studentId = params.studentId;

    const [total, logs] = await Promise.all([
      db.waNotificationLog.count({ where }),
      db.waNotificationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { scheduledAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              nis: true,
              nisn: true,
              class: { select: { className: true } },
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal mengambil log notifikasi WhatsApp',
      error: errorMsg,
    };
  }
}

/**
 * Server Action to retry a failed notification.
 */
export async function retryFailedNotificationAction(
  logId: string
): Promise<ActionResponse<void>> {
  try {
    const record = await db.waNotificationLog.findUnique({
      where: { id: logId },
    });

    if (!record) {
      return {
        success: false,
        message: 'Log notifikasi tidak ditemukan',
      };
    }

    await db.waNotificationLog.update({
      where: { id: logId },
      data: {
        status: WaStatus.QUEUED,
        scheduledAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Notifikasi berhasil dijadwalkan ulang dalam antrean.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Gagal menjadwalkan ulang notifikasi',
      error: errorMsg,
    };
  }
}
