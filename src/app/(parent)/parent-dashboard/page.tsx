import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/db';
import { getParentSession, getActiveStudentIdFromCookie } from '@/lib/session';
import { getStudentActivityTimeline } from '@/lib/activity-feed';
import { StatusSummaryBanner } from '@/components/parent/StatusSummaryBanner';
import { ActivityTimeline } from '@/components/parent/ActivityTimeline';
import { CalendarCheck, Image as ImageIcon, Award, Sparkles } from 'lucide-react';

interface ParentDashboardProps {
  searchParams: Promise<{
    studentId?: string;
  }>;
}

export default async function ParentDashboardPage({
  searchParams,
}: ParentDashboardProps) {
  const session = await getParentSession();
  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;

  // Determine active student
  let targetStudentId = params.studentId;
  if (!targetStudentId) {
    targetStudentId = (await getActiveStudentIdFromCookie()) || undefined;
  }

  // Fetch parent links to verify permission
  const parentLinks = await db.parentStudentLink.findMany({
    where: { parentId: session.parentId },
    include: {
      student: {
        include: {
          class: true,
        },
      },
    },
  });

  if (parentLinks.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-bold text-slate-800">
          Tidak ada data siswa terkait.
        </p>
      </div>
    );
  }

  const validLink =
    parentLinks.find((l) => l.studentId === targetStudentId) || parentLinks[0];
  const activeStudent = validLink.student;

  // Fetch comprehensive activity timeline for active student
  const timelineDays = await getStudentActivityTimeline(activeStudent.id, {
    limitDays: 7,
  });

  const todayTimeline = timelineDays.find((d) => d.isToday) || timelineDays[0];
  const todaySummary = todayTimeline?.daySummary || {
    gateStatus: 'BELUM_HADIR' as const,
    checkInTime: null,
    checkOutTime: null,
    lateMinutes: 0,
    classesTotal: 0,
    classesAttended: 0,
    starsEarned: 0,
  };

  // Check today's active session if available
  const activeSessionItem = todayTimeline?.timeline.find(
    (item) => item.type === 'CLASS_SESSION'
  );
  const activeSubject = activeSessionItem
    ? {
        subjectName: activeSessionItem.details.subjectName || '',
        teacherName: activeSessionItem.details.teacherName || '',
        periodText: activeSessionItem.details.periodText,
        topicMaterial: activeSessionItem.details.topicMaterial,
      }
    : null;

  // Check today's leave record
  const leaveItem = todayTimeline?.timeline.find(
    (item) => item.type === 'LEAVE_RECORD'
  );
  const leaveInfo = leaveItem
    ? {
        leaveType: leaveItem.title,
        status: leaveItem.statusBadge.label,
        reason: leaveItem.subtitle || '',
      }
    : null;

  const studentQueryParam = `?studentId=${activeStudent.id}`;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Halo, {session.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Memantau pembelajaran{' '}
            <strong className="text-slate-800 font-semibold">
              {activeStudent.fullName}
            </strong>{' '}
            (Kelas {activeStudent.class.className})
          </p>
        </div>
      </div>

      {/* The 3-Second Rule Status Banner */}
      <StatusSummaryBanner
        studentName={activeStudent.fullName}
        daySummary={todaySummary}
        activeSubject={activeSubject}
        leaveInfo={leaveInfo}
      />

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Link
          href={`/leave-request${studentQueryParam}`}
          className="flex flex-col sm:flex-row items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 active:scale-[0.98] transition-all text-center sm:text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              Ajukan Izin
            </p>
            <p className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
              Sakit atau keperluan keluarga
            </p>
          </div>
        </Link>

        <Link
          href={`/documentations${studentQueryParam}`}
          className="flex flex-col sm:flex-row items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 active:scale-[0.98] transition-all text-center sm:text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              Galeri Foto
            </p>
            <p className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
              Dokumentasi aktivitas kelas
            </p>
          </div>
        </Link>

        <Link
          href={`/grades-report${studentQueryParam}`}
          className="flex flex-col sm:flex-row items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 active:scale-[0.98] transition-all text-center sm:text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              Rapor Nilai
            </p>
            <p className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
              Cek ketuntasan KKM & nilai
            </p>
          </div>
        </Link>
      </div>

      {/* Activity Timeline Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Catatan Aktivitas & Pembelajaran (7 Hari Terakhir)
          </h2>
        </div>

        <ActivityTimeline
          timelineDays={timelineDays}
          studentName={activeStudent.fullName}
        />
      </section>
    </div>
  );
}
