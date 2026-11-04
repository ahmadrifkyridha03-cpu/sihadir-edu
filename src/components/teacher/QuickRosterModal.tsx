'use client';

import * as React from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { getClassroomRosterAction } from '@/actions/attendance';
import { ClassroomRosterPayload, EnrichedStudentAttendanceItem } from '@/lib/attendance';
import { Users, AlertTriangle, CheckCircle, Clock, CalendarCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuickRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  classNameStr: string;
  classId: string;
  targetDate: string;
}

export function QuickRosterModal({
  isOpen,
  onClose,
  classNameStr,
  classId,
  targetDate,
}: QuickRosterModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [roster, setRoster] = React.useState<ClassroomRosterPayload | null>(null);

  React.useEffect(() => {
    if (isOpen && classId) {
      setLoading(true);
      getClassroomRosterAction('temp-preview', classId, targetDate)
        .then((res) => {
          if (res.success && res.data) {
            setRoster(res.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, classId, targetDate]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Presensi Gerbang: Kelas ${classNameStr}`}
      description={`Rekap kedatangan gerbang pagi hari ini (${targetDate})`}
    >
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-xs">Memuat data presensi gerbang...</p>
        </div>
      ) : !roster || roster.students.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Belum ada data siswa untuk kelas ini.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary counters */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs py-2 px-1 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
              <p className="text-sm font-bold text-slate-800 font-mono">
                {roster.totalStudents}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 font-bold uppercase">Hadir</p>
              <p className="text-sm font-bold text-emerald-700 font-mono">
                {roster.stats.hadir}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-amber-600 font-bold uppercase">Terlambat</p>
              <p className="text-sm font-bold text-amber-800 font-mono">
                {roster.stats.late}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-rose-600 font-bold uppercase">Belum</p>
              <p className="text-sm font-bold text-rose-700 font-mono">
                {roster.stats.unscanned}
              </p>
            </div>
          </div>

          {/* Student rows */}
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
            {roster.students.map((student: EnrichedStudentAttendanceItem) => {
              const isPotentialBolos = student.isPotentialBolos;

              return (
                <div
                  key={student.studentId}
                  className={cn(
                    'pt-2 pb-1.5 flex items-center justify-between gap-3 text-xs',
                    isPotentialBolos && 'bg-rose-50/70 p-2 rounded-xl border border-rose-200'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        student.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 leading-tight">
                        {student.fullName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        NIS {student.nis}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isPotentialBolos ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                        <AlertTriangle className="w-3 h-3" />
                        🚨 Potensi Bolos!
                      </span>
                    ) : student.gateStatus === 'HADIR' ? (
                      <Badge status="hadir" size="sm">
                        Hadir ({student.checkInTime ? student.checkInTime.substring(11, 16) : 'Gerbang'})
                      </Badge>
                    ) : student.gateStatus === 'TERLAMBAT' ? (
                      <Badge status="terlambat" size="sm">
                        Terlambat (+{student.lateMinutes}m)
                      </Badge>
                    ) : student.hasApprovedLeave ? (
                      <Badge status="izin" size="sm">
                        {student.leaveType || 'Izin'}
                      </Badge>
                    ) : (
                      <Badge status="neutral" size="sm">
                        Belum Pindai
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
