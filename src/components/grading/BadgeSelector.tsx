'use client';

import React from 'react';
import { EngagementBadge } from '@prisma/client';
import { Star, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BadgeOptionConfig {
  value: EngagementBadge;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeClass: string;
  idleClass: string;
  description: string;
}

export const ENGAGEMENT_BADGE_CONFIGS: Record<EngagementBadge, BadgeOptionConfig> = {
  [EngagementBadge.ACTIVE_STAR]: {
    value: EngagementBadge.ACTIVE_STAR,
    label: 'Sangat Aktif',
    shortLabel: 'Aktif',
    icon: <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />,
    activeClass:
      'bg-amber-100/90 border-amber-400 text-amber-900 font-bold shadow-xs ring-2 ring-amber-400/40',
    idleClass: 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50/60 hover:border-amber-200',
    description: 'Aktif bertanya, menjawab, atau maju ke depan kelas',
  },
  [EngagementBadge.GOOD]: {
    value: EngagementBadge.GOOD,
    label: 'Mengikuti Baik',
    shortLabel: 'Baik',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    activeClass:
      'bg-emerald-100/90 border-emerald-400 text-emerald-900 font-bold shadow-xs ring-2 ring-emerald-400/40',
    idleClass: 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50/60 hover:border-emerald-200',
    description: 'Fokus mendengarkan dan menyelesaikan materi dengan tertib (Default)',
  },
  [EngagementBadge.LESS_FOCUS]: {
    value: EngagementBadge.LESS_FOCUS,
    label: 'Kurang Fokus',
    shortLabel: 'Kurang',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />,
    activeClass:
      'bg-orange-100/90 border-orange-400 text-orange-900 font-bold shadow-xs ring-2 ring-orange-400/40',
    idleClass: 'bg-white border-slate-200 text-slate-600 hover:bg-orange-50/60 hover:border-orange-200',
    description: 'Tampak mengantuk, pasif, atau mengobrol saat pembelajaran',
  },
  [EngagementBadge.NO_TASK]: {
    value: EngagementBadge.NO_TASK,
    label: 'Tidak Kumpul Tugas',
    shortLabel: 'No Tugas',
    icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
    activeClass:
      'bg-rose-100/90 border-rose-400 text-rose-900 font-bold shadow-xs ring-2 ring-rose-400/40',
    idleClass: 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50/60 hover:border-rose-200',
    description: 'Tidak mengumpulkan tugas harian atau lembar kerja saat pelajaran berlangsung',
  },
};

export interface BadgeSelectorProps {
  value: EngagementBadge;
  onChange: (badge: EngagementBadge) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function BadgeSelector({
  value,
  onChange,
  disabled = false,
  size = 'md',
  className,
}: BadgeSelectorProps) {
  const options = Object.values(ENGAGEMENT_BADGE_CONFIGS);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (disabled) return;
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
      e.preventDefault();
    }
    if (nextIndex !== currentIndex) {
      onChange(options[nextIndex].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Pilih badge keaktifan harian"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {options.map((opt, idx) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onClick={() => onChange(opt.value)}
            title={opt.description}
            className={cn(
              'group relative inline-flex items-center gap-1.5 rounded-lg border transition-[transform,background-color,border-color,box-shadow]',
              'duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]',
              size === 'sm'
                ? 'px-2 py-1 text-xs min-h-[36px]'
                : 'px-2.5 py-1.5 text-xs sm:text-sm min-h-[44px]',
              isSelected ? opt.activeClass : opt.idleClass,
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <span className="shrink-0 transition-transform duration-160 group-active:scale-90">
              {opt.icon}
            </span>
            <span className="tracking-tight">{opt.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
