'use client';

import * as React from 'react';
import {
  DailyActivityTimeline,
  ActivityFeedItem,
  ActivityPhoto,
} from '@/lib/activity-feed';
import {
  Clock,
  BookOpen,
  DoorOpen,
  CalendarCheck,
  Award,
  Sparkles,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  timelineDays: DailyActivityTimeline[];
  studentName: string;
}

export function ActivityTimeline({
  timelineDays,
  studentName,
}: ActivityTimelineProps) {
  const [selectedPhoto, setSelectedPhoto] = React.useState<ActivityPhoto | null>(
    null
  );

  if (!timelineDays || timelineDays.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="w-6 h-6 text-blue-600" />}
        title="Belum Ada Catatan Aktivitas"
        description={`Belum ada data kehadiran atau jurnal pembelajaran tercatat untuk ananda ${studentName}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {timelineDays.map((day) => (
        <div key={day.date} className="space-y-3">
          {/* Day Date Header */}
          <div className="flex items-center justify-between sticky top-14 z-20 bg-slate-50/90 backdrop-blur-xs py-2 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                {day.formattedDate}
              </h3>
              {day.isToday && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Hari Ini
                </span>
              )}
            </div>

            {day.daySummary.gateStatus !== 'BELUM_HADIR' && (
              <span className="text-xs font-semibold text-slate-500 font-mono">
                Masuk: {day.daySummary.checkInTime || '—'} WIB
              </span>
            )}
          </div>

          {/* Timeline Feed Items */}
          {day.timeline.length === 0 ? (
            <Card className="p-4 text-center text-xs text-slate-400 bg-white/70">
              Tidak ada kegiatan kelas atau presensi tercatat pada tanggal ini.
            </Card>
          ) : (
            <div className="relative pl-5 sm:pl-6 space-y-3 before:absolute before:left-2 sm:before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {day.timeline.map((item) => (
                <TimelineCard
                  key={item.id}
                  item={item}
                  onPhotoClick={(photo) => setSelectedPhoto(photo)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Lightbox Modal for Photo Preview */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-enter-snappy"
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Tutup foto"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-3xl max-h-[80vh] flex flex-col items-center">
            <img
              src={selectedPhoto.imageUrl}
              alt={selectedPhoto.caption || 'Dokumentasi pembelajaran'}
              className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            {selectedPhoto.caption && (
              <p className="mt-3 text-xs sm:text-sm text-white/90 text-center max-w-lg px-4 bg-black/40 py-1.5 rounded-lg">
                {selectedPhoto.caption}
              </p>
            )}
            <p className="text-[11px] text-white/50 mt-1">
              Ukuran: {selectedPhoto.fileSizeKb} KB WebP
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineCard({
  item,
  onPhotoClick,
}: {
  item: ActivityFeedItem;
  onPhotoClick: (photo: ActivityPhoto) => void;
}) {
  // Determine dot color & icon based on item type
  let DotIcon = BookOpen;
  let dotBg = 'bg-blue-600 text-white';

  if (item.type === 'GATE_CHECK_IN') {
    DotIcon = Clock;
    dotBg =
      item.statusBadge.variant === 'warning'
        ? 'bg-amber-600 text-white'
        : 'bg-emerald-600 text-white';
  } else if (item.type === 'GATE_CHECK_OUT') {
    DotIcon = DoorOpen;
    dotBg = 'bg-slate-600 text-white';
  } else if (item.type === 'LEAVE_RECORD') {
    DotIcon = CalendarCheck;
    dotBg = 'bg-sky-600 text-white';
  } else if (item.type === 'FORMAL_ASSESSMENT') {
    DotIcon = Award;
    dotBg = 'bg-purple-600 text-white';
  }

  return (
    <div className="relative">
      {/* Node Dot */}
      <div
        className={cn(
          'absolute -left-5 sm:-left-6 top-3 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-slate-50 shrink-0 shadow-xs',
          dotBg
        )}
      >
        <DotIcon className="w-2.5 h-2.5" />
      </div>

      {/* Main Content Card */}
      <Card className="p-3.5 sm:p-4 bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {item.timeFormatted}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  item.statusBadge.variant === 'success' &&
                    'bg-emerald-50 text-emerald-800 border-emerald-200',
                  item.statusBadge.variant === 'warning' &&
                    'bg-amber-50 text-amber-900 border-amber-200',
                  item.statusBadge.variant === 'danger' &&
                    'bg-rose-50 text-rose-800 border-rose-200',
                  item.statusBadge.variant === 'info' &&
                    'bg-sky-50 text-sky-800 border-sky-200',
                  item.statusBadge.variant === 'neutral' &&
                    'bg-slate-100 text-slate-700 border-slate-200'
                )}
              >
                {item.statusBadge.label}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 tracking-tight mt-1">
              {item.title}
            </h4>

            {item.subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
            )}
          </div>
        </div>

        {/* Classroom Session Details */}
        {item.type === 'CLASS_SESSION' && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            {/* Topic & Teacher Note */}
            {item.details.teacherNotes && (
              <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 flex items-start gap-2 border border-slate-100">
                <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">
                    Catatan Pembelajaran Guru:{' '}
                  </span>
                  <span>{item.details.teacherNotes}</span>
                </div>
              </div>
            )}

            {/* Engagement Badge Pill */}
            {item.details.engagementLabel && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Partisipasi Siswa:</span>
                <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                  <span>{item.details.engagementIcon}</span>
                  <span>{item.details.engagementLabel}</span>
                </span>
                {item.details.studentNote && (
                  <span className="text-[11px] text-slate-500 italic">
                    — &quot;{item.details.studentNote}&quot;
                  </span>
                )}
              </div>
            )}

            {/* Attached Assessment info */}
            {item.details.assessment && (
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 flex items-center justify-between">
                <div>
                  <span className="font-bold">
                    Penilaian: {item.details.assessment.title}
                  </span>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    KKM {item.details.assessment.kkmScore} • Kategori{' '}
                    {item.details.assessment.category}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono">
                    {item.details.assessment.score} / {item.details.assessment.maxScore}
                  </span>
                  <span
                    className={cn(
                      'block text-[10px] font-bold',
                      item.details.assessment.isPassed
                        ? 'text-emerald-700'
                        : 'text-amber-800'
                    )}
                  >
                    {item.details.assessment.isPassed ? 'TUNTAS KKM' : 'REMEDIAL'}
                  </span>
                </div>
              </div>
            )}

            {/* Documentation Photos Grid */}
            {item.details.photos && item.details.photos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  Dokumentasi Pembelajaran ({item.details.photos.length} Foto)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {item.details.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => onPhotoClick(photo)}
                      className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 active:scale-[0.98] transition-transform text-left"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption || 'Foto kelas'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                          <p className="text-[10px] text-white font-medium truncate">
                            {photo.caption}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
