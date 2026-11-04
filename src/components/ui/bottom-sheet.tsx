'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: BottomSheetProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-hidden="true"
      />

      {/* Surface: Bottom Sheet on Mobile, Centered Modal on Tablet/Desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={cn(
          'relative z-10 w-full bg-white text-slate-900 shadow-2xl transition-all duration-200 ease-out',
          // Mobile Drawer styling
          'rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 pb-safe animate-slide-up',
          // Desktop Modal override
          'sm:rounded-2xl sm:max-w-lg sm:p-6 sm:m-4 sm:animate-enter-snappy'
        )}
      >
        {/* Mobile Drag Pill */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="sheet-title" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-2 -mr-1 -mt-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-2">{children}</div>
      </div>
    </div>
  );
}
