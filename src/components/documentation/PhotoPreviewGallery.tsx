'use client';

import React, { useState } from 'react';
import { DocVisibility } from '@prisma/client';
import {
  Maximize2,
  X,
  Users,
  Lock,
  Tag,
  Trash2,
} from 'lucide-react';
import { PreparedPhotoItem } from './PhotoUploader';
import { cn } from '@/lib/utils';

export interface StudentOption {
  id: string;
  fullName: string;
  nis: string;
}

export interface PhotoPreviewGalleryProps {
  photos: PreparedPhotoItem[];
  onChange: (photos: PreparedPhotoItem[]) => void;
  availableStudents?: StudentOption[];
  readOnly?: boolean;
  className?: string;
}

export function PhotoPreviewGallery({
  photos,
  onChange,
  availableStudents = [],
  readOnly = false,
  className,
}: PhotoPreviewGalleryProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<PreparedPhotoItem | null>(null);

  const updatePhoto = (id: string, patch: Partial<PreparedPhotoItem>) => {
    onChange(
      photos.map((p) => {
        if (p.id !== id) return p;
        return { ...p, ...patch };
      })
    );
  };

  const removePhoto = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  const toggleStudentTag = (photoId: string, studentId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    const currentTags = photo.taggedStudentIds || [];
    const nextTags = currentTags.includes(studentId)
      ? currentTags.filter((id) => id !== studentId)
      : [...currentTags, studentId];

    updatePhoto(photoId, { taggedStudentIds: nextTags });
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, idx) => {
          const isTaggedOnly = photo.visibility === DocVisibility.TAGGED_STUDENTS_ONLY;

          return (
            <div
              key={photo.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
            >
              {/* Image Preview & Lightbox Trigger */}
              <div className="relative aspect-16/10 bg-slate-100 overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.base64}
                  alt={photo.caption || `Dokumentasi ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />

                {/* Floating Lightbox Open Button */}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/70 text-white hover:bg-slate-900 active:scale-95 transition-all opacity-90 group-hover:opacity-100"
                  title="Perbesar foto"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Delete Button */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/90 text-white hover:bg-rose-700 active:scale-95 transition-all shadow-xs"
                    title="Hapus foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Size Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/70 text-white text-[11px] font-mono">
                  {photo.compressedSizeKb} KB ({photo.savingsPercent}%)
                </div>
              </div>

              {/* Form Controls */}
              <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
                {/* Caption Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Keterangan Kegiatan
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    maxLength={255}
                    value={photo.caption}
                    onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
                    placeholder="Contoh: Diskusi kelompok materi aljabar..."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[38px]"
                  />
                </div>

                {/* Visibility Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Visibilitas Linimasa Orang Tua
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        updatePhoto(photo.id, { visibility: DocVisibility.CLASS_PUBLIC })
                      }
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border font-medium transition-all active:scale-[0.97] min-h-[38px]',
                        photo.visibility === DocVisibility.CLASS_PUBLIC
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Semua Kelas</span>
                    </button>

                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        updatePhoto(photo.id, {
                          visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
                        })
                      }
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border font-medium transition-all active:scale-[0.97] min-h-[38px]',
                        photo.visibility === DocVisibility.TAGGED_STUDENTS_ONLY
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Siswa Tertentu</span>
                    </button>
                  </div>
                </div>

                {/* Tagged Students Picker (if TAGGED_STUDENTS_ONLY) */}
                {isTaggedOnly && availableStudents.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-600" />
                        Tandai Siswa ({photo.taggedStudentIds?.length || 0})
                      </span>
                    </div>

                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-lg p-1.5 bg-slate-50/50">
                      {availableStudents.map((st) => {
                        const isTagged = photo.taggedStudentIds?.includes(st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => toggleStudentTag(photo.id, st.id)}
                            className={cn(
                              'w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between transition-colors',
                              isTagged
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : 'hover:bg-slate-100 text-slate-700'
                            )}
                          >
                            <span className="truncate">{st.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1">
                              {st.nis}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.base64}
              alt={lightboxPhoto.caption || 'Foto Dokumentasi'}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
            />
            {lightboxPhoto.caption && (
              <p className="text-white text-sm mt-3 text-center bg-black/60 px-4 py-2 rounded-lg">
                {lightboxPhoto.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
