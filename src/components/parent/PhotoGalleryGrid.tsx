'use client';

import * as React from 'react';
import { DocVisibility } from '@prisma/client';
import { ParentGalleryItem } from '@/actions/parent-gallery';
import { Image as ImageIcon, Lock, Globe, X, Calendar, User, BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PhotoGalleryGridProps {
  items: ParentGalleryItem[];
  studentName: string;
}

export function PhotoGalleryGrid({ items, studentName }: PhotoGalleryGridProps) {
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>('ALL');
  const [activePhoto, setActivePhoto] = React.useState<ParentGalleryItem | null>(null);

  // Extract unique subjects for filter tabs
  const subjects = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.journal.subject.id, item.journal.subject.subjectName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (selectedSubjectId === 'ALL') return items;
    return items.filter((item) => item.journal.subject.id === selectedSubjectId);
  }, [items, selectedSubjectId]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="w-6 h-6 text-blue-600" />}
        title="Belum Ada Dokumentasi Kelas"
        description={`Belum ada dokumentasi foto kegiatan kelas yang diunggah untuk kelas ananda ${studentName}.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Subject Filter Pills */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedSubjectId('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98]',
              selectedSubjectId === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            Semua Mata Pelajaran ({items.length})
          </button>
          {subjects.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubjectId(sub.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98]',
                selectedSubjectId === sub.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActivePhoto(item)}
            className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all text-left flex flex-col active:scale-[0.98]"
          >
            {/* Image Aspect Box */}
            <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.caption || 'Dokumentasi pembelajaran'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />

              {/* Visibility Badge Pill on top left */}
              <div className="absolute top-2 left-2">
                {item.visibility === DocVisibility.CLASS_PUBLIC ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-900/80 text-white backdrop-blur-xs">
                    <Globe className="w-2.5 h-2.5" />
                    Publik Kelas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-900/80 text-white backdrop-blur-xs">
                    <Lock className="w-2.5 h-2.5" />
                    Khusus Ananda
                  </span>
                )}
              </div>
            </div>

            {/* Metadata Bottom Card */}
            <div className="p-2.5 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-blue-600 truncate">
                  {item.journal.subject.subjectName}
                </p>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2 mt-0.5">
                  {item.caption || item.journal.topicMaterial}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100 font-mono">
                <span>{item.journal.journalDate}</span>
                <span>{item.fileSizeKb} KB</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 animate-enter-snappy"
        >
          {/* Lightbox Top Bar */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                {activePhoto.journal.subject.subjectName} — Jam ke-{activePhoto.journal.periodStart}-{activePhoto.journal.periodEnd}
              </h3>
              <p className="text-xs text-white/70 mt-0.5">
                Guru: {activePhoto.journal.teacher.fullName} • {activePhoto.journal.journalDate}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="p-2 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Tutup foto"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Image Container */}
          <div className="flex-1 flex items-center justify-center py-4 overflow-hidden">
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.caption || 'Foto kelas'}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>

          {/* Lightbox Bottom Info Bar */}
          <div className="bg-slate-900/90 text-white p-3.5 rounded-2xl max-w-2xl mx-auto w-full border border-white/10 text-center">
            {activePhoto.caption && (
              <p className="text-xs sm:text-sm font-medium mb-1">
                {activePhoto.caption}
              </p>
            )}
            <p className="text-[11px] text-white/60">
              Materi: {activePhoto.journal.topicMaterial} • Kompresi WebP: {activePhoto.fileSizeKb} KB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
