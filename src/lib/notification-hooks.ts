import { db } from '@/lib/db';
import {
  WaNotifType,
  WaStatus,
  GateStatus,
  ApprovalStatus,
  type GateAttendance,
  type Student,
  type Class,
  type Subject,
  type Teacher,
  type Parent,
  type LeaveRequest,
} from '@prisma/client';
import { formatWibTime, formatIndoDate } from './timezone';

/**
 * Resolves Spintax format strings (e.g. "{Assalamu'alaikum|Selamat Pagi|Halo}")
 * by randomly choosing one variation. Helps prevent anti-spam rate limiting by WhatsApp.
 */
export function resolveSpintax(template: string): string {
  return template.replace(/\{([^{}]+)\}/g, (_, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)].trim();
  });
}

export const notificationHooks = {
  /**
   * Hook A: Enqueues WhatsApp notification when a gate scan is recorded.
   * - If TERLAMBAT: High-priority immediate alert to parents (`WaNotifType.GATE_LATE`).
   * - If HADIR: Instant alert (`WaNotifType.GATE_IN`) if `WA_ENABLE_INSTANT_NORMAL_ATTENDANCE` is true.
   */
  async onGateScanRecorded(params: {
    gateRecord: GateAttendance;
    student: Student & { class: Class };
    parentPhone?: string | null;
  }): Promise<void> {
    try {
      const { gateRecord, student } = params;
      let targetPhone = params.parentPhone;

      if (!targetPhone) {
        const link = await db.parentStudentLink.findFirst({
          where: { studentId: student.id, receiveWaNotif: true },
          include: { parent: true },
        });
        targetPhone = link?.parent.phoneWa;
      }

      if (!targetPhone) {
        console.warn(
          `[onGateScanRecorded] No active parent WhatsApp phone for student: ${student.fullName}`
        );
        return;
      }

      const scanTime = formatWibTime(gateRecord.checkInTime);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sihadir.sch.id';

      // 1. TERLAMBAT Alert
      if (gateRecord.status === GateStatus.TERLAMBAT) {
        const template = resolveSpintax(`{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu,
Kami menginformasikan bahwa ananda:
👤 Nama: *${student.fullName}* (${student.class.className})
🕒 Waktu Tiba: *${scanTime} WIB*
⚠️ Status: *TERLAMBAT (+${gateRecord.lateMinutes} menit)*

Mohon motivasi dan arahan kepada ananda agar dapat tiba di sekolah tepat waktu sebelum pukul 07:00 WIB.
🔗 Pantau kehadiran siswa: ${appUrl}/parent-dashboard`);

        await db.waNotificationLog.create({
          data: {
            studentId: student.id,
            targetPhone,
            notifType: WaNotifType.GATE_LATE,
            messageBody: template,
            status: WaStatus.QUEUED,
            scheduledAt: new Date(),
          },
        });
      }

      // 2. HADIR On-Time Alert (conditional)
      else if (
        gateRecord.status === GateStatus.HADIR &&
        process.env.WA_ENABLE_INSTANT_NORMAL_ATTENDANCE === 'true'
      ) {
        const template = resolveSpintax(`{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu,
Alhamdulillah, ananda:
👤 Nama: *${student.fullName}* (${student.class.className})
🕒 Waktu Tiba: *${scanTime} WIB*
✅ Status: *HADIR TEPAT WAKTU*

Ananda telah tiba di sekolah dan siap mengikuti kegiatan pembelajaran.
🔗 Info kegiatan sekolah: ${appUrl}/parent-dashboard`);

        await db.waNotificationLog.create({
          data: {
            studentId: student.id,
            targetPhone,
            notifType: WaNotifType.GATE_IN,
            messageBody: template,
            status: WaStatus.QUEUED,
            scheduledAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('[notificationHooks.onGateScanRecorded] Failed to enqueue:', err);
    }
  },

  /**
   * Hook B: Fired when truancy (Bolos) is detected:
   * Student scanned at gate (HADIR / TERLAMBAT), but was marked ALPA_BOLOS in classroom journal.
   */
  async onBolosDetected(params: {
    student: Student & { class: Class };
    classInfo: Class;
    subject: Subject;
    teacher: Teacher;
    periodStart: number;
    periodEnd: number;
    parentPhone?: string | null;
  }): Promise<void> {
    try {
      const { student, classInfo, subject, teacher, periodStart, periodEnd } = params;
      let targetPhone = params.parentPhone;

      if (!targetPhone) {
        const link = await db.parentStudentLink.findFirst({
          where: { studentId: student.id, receiveWaNotif: true },
          include: { parent: true },
        });
        targetPhone = link?.parent.phoneWa;
      }

      if (!targetPhone) {
        console.warn(`[onBolosDetected] No parent WhatsApp phone for student: ${student.fullName}`);
        return;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sihadir.sch.id';
      const template = resolveSpintax(`🚨 *PERINGATAN KHUSUS: KETIDAKHADIRAN DI KELAS (BOLOS)* 🚨
{Assalamu'alaikum|Selamat Siang|Halo} Bapak/Ibu orang tua/wali dari:
👤 Nama: *${student.fullName}* (${classInfo.className})

Kami menginformasikan bahwa ananda tercatat *HADIR di gerbang sekolah pagi ini*, namun *TIDAK BERADA DI KELAS* pada:
📘 Mata Pelajaran: *${subject.subjectName}* (Jam ke-${periodStart}-${periodEnd})
👨‍🏫 Guru Pengajar: *${teacher.fullName}*

Mohon segera mengonfirmasi dan berkoordinasi dengan pihak sekolah atau Wali Kelas.
🔗 Hubungi sekolah: ${appUrl}/parent-dashboard`);

      await db.waNotificationLog.create({
        data: {
          studentId: student.id,
          targetPhone,
          notifType: WaNotifType.ABSENT_ALERT,
          messageBody: template,
          status: WaStatus.QUEUED,
          scheduledAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[notificationHooks.onBolosDetected] Failed to enqueue:', err);
    }
  },

  /**
   * Hook C: Fired when a student leave request status is updated (APPROVED / REJECTED).
   * Note: Maps to `WaNotifType.ABSENT_ALERT` to strictly adhere to the 5 schema enum values.
   */
  async onLeaveStatusChanged(params: {
    leaveRequest: LeaveRequest;
    student: Student & { class?: Class };
    parent: Parent;
    status: ApprovalStatus;
    notes?: string;
  }): Promise<void> {
    try {
      const { leaveRequest, student, parent, status, notes } = params;
      const targetPhone = parent.phoneWa;

      if (!targetPhone) {
        console.warn(`[onLeaveStatusChanged] No phone for parent: ${parent.fullName}`);
        return;
      }

      const isApproved = status === ApprovalStatus.APPROVED;
      const startDateStr = formatIndoDate(leaveRequest.startDate);
      const endDateStr = formatIndoDate(leaveRequest.endDate);
      const rangeStr =
        startDateStr === endDateStr ? startDateStr : `${startDateStr} s.d. ${endDateStr}`;

      const template = isApproved
        ? resolveSpintax(`{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu ${parent.fullName},
Pemberitahuan: Permohonan izin siswa telah *DISETUJUI*.
👤 Siswa: *${student.fullName}*
📝 Jenis: *${leaveRequest.leaveType}*
📅 Rentang: ${rangeStr}
${notes ? `📌 Catatan Guru: ${notes}\n` : ''}
Data presensi gerbang sekolah telah otomatis disesuaikan. Terima kasih.`)
        : resolveSpintax(`{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu ${parent.fullName},
Pemberitahuan: Permohonan izin siswa *TIDAK DISETUJUI* / *DITOLAK*.
👤 Siswa: *${student.fullName}*
📝 Jenis: *${leaveRequest.leaveType}*
📅 Rentang: ${rangeStr}
${notes ? `📌 Alasan Penolakan: ${notes}\n` : ''}
Silakan hubungi Wali Kelas ananda untuk koordinasi lebih lanjut.`);

      await db.waNotificationLog.create({
        data: {
          studentId: student.id,
          targetPhone,
          notifType: WaNotifType.ABSENT_ALERT,
          messageBody: template,
          status: WaStatus.QUEUED,
          scheduledAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[notificationHooks.onLeaveStatusChanged] Failed to enqueue:', err);
    }
  },
};
