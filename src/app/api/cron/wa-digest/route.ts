import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  enqueueWhatsAppNotification,
  TEMPLATE_DAILY_DIGEST,
  normalizeIndonesianPhone,
} from '@/lib/whatsapp';
import { getWibNow, formatWibTime, formatIndoDate } from '@/lib/timezone';
import { WaNotifType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = getWibNow().wibDate;
    const students = await db.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        class: true,
        parentLinks: {
          where: { receiveWaNotif: true },
          include: { parent: true },
        },
        gateAttendances: {
          where: { attendanceDate: today },
        },
        subjectAttendances: {
          where: {
            journal: { journalDate: today },
          },
          include: {
            journal: {
              include: { subject: true },
            },
          },
        },
      },
    });

    let enqueuedCount = 0;
    const dateStr = formatIndoDate(today);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sihadir.sch.id';

    for (const student of students) {
      const activeParentLink = student.parentLinks[0];
      if (!activeParentLink?.parent?.phoneWa) continue;

      const gate = student.gateAttendances[0];
      const checkInTime = gate?.checkInTime ? `${formatWibTime(gate.checkInTime)} WIB` : '-';
      const checkOutTime = gate?.checkOutTime ? `${formatWibTime(gate.checkOutTime)} WIB` : '-';

      const subjectsSummary =
        student.subjectAttendances.length > 0
          ? student.subjectAttendances
              .map(
                (sa) =>
                  `• ${sa.journal.subject.subjectName}: ${sa.status} (${sa.engagementBadge})`
              )
              .join('\n')
          : '• Tidak ada jadwal KBM tercatat hari ini.';

      await enqueueWhatsAppNotification({
        studentId: student.id,
        targetPhone: normalizeIndonesianPhone(activeParentLink.parent.phoneWa),
        notifType: WaNotifType.DAILY_DIGEST,
        template: TEMPLATE_DAILY_DIGEST,
        variables: {
          parent_name: activeParentLink.parent.fullName,
          student_name: student.fullName,
          class: student.class.className,
          date: dateStr,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          subjects_summary: subjectsSummary,
          portal_link: `${appUrl}/parent-dashboard`,
          school_name: 'SMA Negeri 1 Harapan Bangsa',
        },
      });

      enqueuedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Enqueued ${enqueuedCount} daily digests`,
      enqueuedCount,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
