'use client';

import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Loader2, Sparkles, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage, formatFileSize, CompressionResult } from '@/lib/compression';
import { DocVisibility } from '@prisma/client';
import { cn } from '@/lib/utils';

export interface PreparedPhotoItem {
  id: string;
  file: File;
  base64: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  savingsPercent: number;
  caption: string;
  visibility: DocVisibility;
  taggedStudentIds: string[];
}

export interface PhotoUploaderProps {
  photos: PreparedPhotoItem[];
  onChange: (photos: PreparedPhotoItem[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
  className?: string;
}

export function PhotoUploader({
  photos,
  onChange,
  maxPhotos = 5,
  disabled = false,
  className,
}: PhotoUploaderProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksimal ${maxPhotos} foto dokumentasi per sesi jurnal.`);
      return;
    }

    const filesToProcess = Array.from(fileList).slice(0, remainingSlots);
    setIsCompressing(true);
    setCompressionStatus(`Mengompresi ${filesToProcess.length} foto...`);

    const newItems: PreparedPhotoItem[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setCompressionStatus(`Mengompresi foto ${i + 1} dari ${filesToProcess.length}...`);

      try {
        const result: CompressionResult = await compressImage(file, {
          maxWidth: 1280,
          maxHeight: 1280,
          maxSizeBytes: 180 * 1024,
        });

        newItems.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: result.file,
          base64: result.base64,
          originalSizeKb: result.originalSizeKb,
          compressedSizeKb: result.compressedSizeKb,
          savingsPercent: result.savingsPercent,
          caption: '',
          visibility: DocVisibility.CLASS_PUBLIC,
          taggedStudentIds: [],
        });

        toast.success(
          `Foto ${i + 1} terkompresi: ${formatFileSize(file.size)} → ${formatFileSize(
            result.file.size
          )} (${result.savingsPercent}% lebih hemat)`
        );
      } catch (err) {
        console.error('Error compressing photo:', err);
        toast.error(`Gagal mengompresi foto ${file.name}`);
      }
    }

    setIsCompressing(false);
    setCompressionStatus(null);

    if (newItems.length > 0) {
      onChange([...photos, newItems[0], ...newItems.slice(1)]);
    }

    // Reset input elements
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || isCompressing || photos.length >= maxPhotos}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || isCompressing || photos.length >= maxPhotos}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Buttons Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || isCompressing || photos.length >= maxPhotos}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] min-h-[44px]',
            photos.length >= maxPhotos
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
          )}
        >
          <Camera className="w-4 h-4" />
          <span>Ambil Kamera Belakang</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled || isCompressing || photos.length >= maxPhotos}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] min-h-[44px]',
            photos.length >= maxPhotos
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
          )}
        >
          <ImageIcon className="w-4 h-4 text-slate-600" />
          <span>Pilih dari Galeri</span>
        </button>

        <span className="text-xs text-slate-500 ml-auto">
          {photos.length} / {maxPhotos} Foto
        </span>
      </div>

      {/* Compression In-Progress Banner */}
      {isCompressing && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs sm:text-sm text-blue-900 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
          <span>{compressionStatus || 'Sedang mengompresi gambar ke WebP...'}</span>
        </div>
      )}

      {/* Uploaded Photos Quick Row */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
          {photos.map((item, idx) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all hover:shadow-xs"
            >
              {/* Image Preview */}
              <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.base64}
                  alt={`Dokumentasi ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removePhoto(item.id)}
                  title="Hapus foto"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 text-white hover:bg-rose-600 transition-colors active:scale-90"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Compression Ratio Badge */}
              <div className="p-2 bg-white space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>{item.savingsPercent}% lebih hemat</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {item.originalSizeKb} KB → {item.compressedSizeKb} KB
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !isCompressing && (
        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
          <Camera className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs sm:text-sm font-medium text-slate-700">
            Belum ada foto kegiatan belajar diunggah
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Foto otomatis dikompresi ke WebP (&le;180 KB) hemat kuota dan cepat.
          </p>
        </div>
      )}
    </div>
  );
}
