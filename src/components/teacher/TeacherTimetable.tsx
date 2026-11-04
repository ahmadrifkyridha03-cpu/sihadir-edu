'use client';

import * as React from 'react';
import Link from 'next/link';
import { TeacherScheduleItem } from '@/actions/teacher';
import { QuickRosterModal } from './QuickRosterModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Calendar,
  Clock,
  BookOpen,
  CheckCircle,
  FileEdit,
  Users,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeacherTimetableProps {
  schedules: TeacherScheduleItem[];
  teacherId: string;
  todayDateStr: string;
}

export function TeacherTimetable({
  schedules,
  teacherId,
  todayDateStr,
}: TeacherTimetableProps) {
  const [selectedRosterClass, setSelectedRosterClass] = React.useState<{
    classId: string;
    className: string;
  } | null>(null);

  if (schedules.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="w-6 h-6 text-blue-600" />}
        title="Tidak Ada Jadwal Mengajar Hari Ini"
        description="Anda tidak memiliki jadwal tatap muka di kelas untuk hari ini. Waktu dapat digunakan untuk evaluasi penilaian atau koordinasi akademik."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {schedules.map((schedule) => {
          const { isActive, isPast, isUpcoming, progressPercent, elapsedMinutes, totalDuration } =
            schedule.progressState;

          const journalCreated = Boolean(schedule.journalToday);

          const newJournalUrl = `/journal/new?scheduleId=${schedule.id}&classId=${schedule.class.id}&subjectId=${schedule.subject.id}&teacherId=${teacherId}&periodStart=${schedule.periodStart}&periodEnd=${schedule.periodEnd}&date=${todayDateStr}`;

          return (
            <Card
              key={schedule.id}
              className={cn(
                'p-4 sm:p-5 transition-all duration-200 bg-white relative flex flex-col justify-between',
                isActive &&
                  'border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20 bg-emerald-50/10'
              )}
            >
              <div>
                {/* Header row: Period time + Live status badge */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700 font-mono">
                      {schedule.periodLabel} ({schedule.timeRangeStr})
                    </span>
                  </div>

                  <div>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        Sedang Berlangsung
                      </span>
                    ) : isPast ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Selesai
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        Belum Mulai
                      </span>
                    )}
                  </div>
                </div>

                {/* Animated elapsed progress bar for active period */}
                {isActive && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
                      <span>Progres Jam Pelajaran</span>
                      <span>
                        Menit ke-{elapsedMinutes} dari {totalDuration}m ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Subject and Class Details */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {schedule.subject.subjectName}
                    </h3>
                    <Badge status="navy" size="sm">
                      Kelas {schedule.class.className}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kode: {schedule.subject.subjectCode} • KKM: {schedule.subject.kkmScore}
                  </p>
                </div>

                {/* Journal today indicator */}
                {journalCreated && schedule.journalToday && (
                  <div className="mt-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Jurnal Pertemuan Terdata:</p>
                      <p className="text-[11px] text-blue-800 mt-0.5 line-clamp-1">
                        &quot;{schedule.journalToday.topicMaterial}&quot;
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedRosterClass({
                      classId: schedule.class.id,
                      className: schedule.class.className,
                    })
                  }
                  className="text-xs gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Presensi Gerbang
                </Button>

                {journalCreated && schedule.journalToday ? (
                  <Link href={`/journal/${schedule.journalToday.id}`}>
                    <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                      <FileEdit className="w-3.5 h-3.5" />
                      Buka Jurnal
                    </Button>
                  </Link>
                ) : (
                  <Link href={newJournalUrl}>
                    <Button
                      variant={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      className="text-xs gap-1.5 font-bold"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      1-Tap Jurnal
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Roster Modal */}
      {selectedRosterClass && (
        <QuickRosterModal
          isOpen={Boolean(selectedRosterClass)}
          onClose={() => setSelectedRosterClass(null)}
          classNameStr={selectedRosterClass.className}
          classId={selectedRosterClass.classId}
          targetDate={todayDateStr}
        />
      )}
    </div>
  );
}
