import * as React from 'react';
import { GateStatus } from '@prisma/client';
import { CheckCircle2, AlertTriangle, Clock, CalendarCheck, Sparkles, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface StatusSummaryBannerProps {
  studentName: string;
  daySummary: {
    gateStatus: GateStatus | 'BELUM_HADIR';
    checkInTime: string | null;
    checkOutTime: string | null;
    lateMinutes: number;
    classesTotal: number;
    classesAttended: number;
    starsEarned: number;
  };
  activeSubject?: {
    subjectName: string;
    teacherName: string;
    periodText?: string;
    topicMaterial?: string;
  } | null;
  leaveInfo?: {
    leaveType: string;
    status: string;
    reason: string;
  } | null;
}

type BadgeStatusType = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa' | 'neutral' | 'navy';

export function StatusSummaryBanner({
  studentName,
  daySummary,
  activeSubject,
  leaveInfo,
}: StatusSummaryBannerProps) {
  // Determine banner theme and primary headline
  let theme: {
    bg: string;
    border: string;
    text: string;
    badgeVariant: BadgeStatusType;
    badgeText: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    headline: string;
    subheadline: string;
  } = {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-300',
    text: 'text-emerald-950',
    badgeVariant: 'hadir',
    badgeText: 'HADIR TEPAT WAKTU',
    icon: CheckCircle2,
    iconColor: 'text-emerald-700',
    headline: `Ananda ${studentName} tercatat HADIR TEPAT WAKTU (${daySummary.checkInTime || '06:50'} WIB)`,
    subheadline: 'Tiba di sekolah sebelum bel masuk berbunyi.',
  };

  if (leaveInfo) {
    theme = {
      bg: 'bg-sky-50/90',
      border: 'border-sky-300',
      text: 'text-sky-950',
      badgeVariant: 'izin' as const,
      badgeText: `IZIN: ${leaveInfo.leaveType}`,
      icon: CalendarCheck,
      iconColor: 'text-sky-700',
      headline: `Ananda ${studentName} tercatat ${leaveInfo.leaveType === 'SAKIT' ? 'SAKIT' : 'IZIN'}`,
      subheadline: leaveInfo.reason || 'Surat permohonan izin terdata oleh sekolah.',
    };
  } else if (daySummary.gateStatus === GateStatus.TERLAMBAT) {
    theme = {
      bg: 'bg-amber-50/90',
      border: 'border-amber-300',
      text: 'text-amber-950',
      badgeVariant: 'terlambat' as const,
      badgeText: `TERLAMBAT (+${daySummary.lateMinutes}m)`,
      icon: AlertTriangle,
      iconColor: 'text-amber-800',
      headline: `Ananda ${studentName} TERLAMBAT ${daySummary.lateMinutes} MENIT`,
      subheadline: `Tiba di gerbang pada pukul ${daySummary.checkInTime || '--:--'} WIB.`,
    };
  } else if (daySummary.gateStatus === 'BELUM_HADIR') {
    theme = {
      bg: 'bg-slate-50',
      border: 'border-slate-300',
      text: 'text-slate-900',
      badgeVariant: 'neutral' as const,
      badgeText: 'BELUM SCAN GERBANG',
      icon: Clock,
      iconColor: 'text-slate-500',
      headline: `Belum Ada Catatan Pindai Masuk Gerbang`,
      subheadline: `Kartu QR ananda ${studentName} belum dipindai oleh petugas gerbang hari ini.`,
    };
  }

  const IconComponent = theme.icon;

  return (
    <div
      role="region"
      aria-label="Ringkasan Status Kehadiran Hari Ini"
      className={cn(
        'rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-150',
        theme.bg,
        theme.border
      )}
    >
      {/* Top Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-black/5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs shrink-0',
              theme.iconColor
            )}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={theme.badgeVariant} size="sm">
                {theme.badgeText}
              </Badge>
              <span className="text-[11px] font-bold text-slate-500">
                Status Hari Ini
              </span>
            </div>
            <h2 className={cn('text-sm sm:text-base font-bold tracking-tight mt-0.5', theme.text)}>
              {theme.headline}
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-600 sm:text-right hidden sm:block">
          {theme.subheadline}
        </p>
      </div>

      {/* 3-Second Quick Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 text-slate-800">
        {/* Metric 1: Scan Masuk */}
        <div className="bg-white/80 rounded-xl p-2.5 border border-black/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            🕒 Pindai Masuk
          </p>
          <p className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5">
            {daySummary.checkInTime ? `${daySummary.checkInTime} WIB` : '—'}
          </p>
        </div>

        {/* Metric 2: Scan Pulang */}
        <div className="bg-white/80 rounded-xl p-2.5 border border-black/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            🚪 Pindai Pulang
          </p>
          <p className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5">
            {daySummary.checkOutTime ? `${daySummary.checkOutTime} WIB` : 'Belum Pulang'}
          </p>
        </div>

        {/* Metric 3: Active Class / Sesi Belajar */}
        <div className="bg-white/80 rounded-xl p-2.5 border border-black/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-blue-600" />
            Sesi Belajar
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
            {activeSubject
              ? `${activeSubject.subjectName}`
              : `${daySummary.classesTotal} Jam Pelajaran`}
          </p>
        </div>

        {/* Metric 4: Keaktifan Bintang */}
        <div className="bg-white/80 rounded-xl p-2.5 border border-black/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Keaktifan
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
            {daySummary.starsEarned > 0 ? (
              <span className="text-amber-700 font-semibold">
                🌟 {daySummary.starsEarned} Bintang Aktif
              </span>
            ) : (
              <span className="text-slate-600 font-medium">✅ Mengikuti Baik</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
