import * as React from 'react';
import { getTeacherDashboardData } from '@/actions/teacher';
import { TeacherTimetable } from '@/components/teacher/TeacherTimetable';
import { HomeroomPendingLeaves } from '@/components/teacher/HomeroomPendingLeaves';
import { TeacherJournalSummary } from '@/components/teacher/TeacherJournalSummary';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Calendar,
  BookOpen,
  Award,
  Sparkles,
  UserCheck,
  Plus,
} from 'lucide-react';

export default async function TeacherDashboardPage() {
  const result = await getTeacherDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-bold text-slate-800">
          {result.error || 'Gagal memuat jadwal mengajar guru.'}
        </p>
      </div>
    );
  }

  const { teacher, homeroomClass, todayInfo, schedules, pendingLeaves, recentJournals } =
    result.data;

  return (
    <div className="space-y-6">
      {/* Teacher Profile & Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
            {teacher.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                {teacher.fullName}
              </h1>
              {homeroomClass && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Wali Kelas {homeroomClass.className}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              NIP: {teacher.nip || '—'} • Mata Pelajaran: {teacher.specialty || 'Pengajar'}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <span className="text-xs font-bold text-slate-800 block">
            {todayInfo.indoDateFormatted}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Tahun Ajaran 2026/2027
          </span>
        </div>
      </div>

      {/* Homeroom Teacher Pending Leaves Review Section */}
      {homeroomClass && pendingLeaves.length > 0 && (
        <HomeroomPendingLeaves
          pendingLeaves={pendingLeaves}
          homeroomClassName={homeroomClass.className}
          reviewerUserId={teacher.userId}
        />
      )}

      {/* Teaching Timetable (8-Period Matrix) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Jadwal Mengajar Hari Ini
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {schedules.length} Sesi Terjadwal
          </span>
        </div>

        <TeacherTimetable
          schedules={schedules}
          teacherId={teacher.id}
          todayDateStr={todayInfo.dateStr}
        />
      </section>

      {/* Recent Class Journals Summary */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600" />
            Riwayat Jurnal Terakhir
          </h2>
          <Link href="/journal/new">
            <Button size="sm" variant="outline" className="text-xs gap-1">
              <Plus className="w-3.5 h-3.5" />
              Buat Jurnal Baru
            </Button>
          </Link>
        </div>

        <TeacherJournalSummary journals={recentJournals} />
      </section>
    </div>
  );
}
