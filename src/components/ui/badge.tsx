import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-tight border transition-colors select-none',
  {
    variants: {
      status: {
        hadir: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
        terlambat: 'bg-amber-100 text-amber-900 border-amber-300/80',
        izin: 'bg-sky-100 text-sky-800 border-sky-300/80',
        sakit: 'bg-violet-100 text-violet-800 border-violet-300/80',
        alpa: 'bg-rose-100 text-rose-800 border-rose-300/80',
        neutral: 'bg-slate-100 text-slate-800 border-slate-200',
        navy: 'bg-navy-50 text-navy-900 border-navy-200',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
      },
    },
    defaultVariants: {
      status: 'neutral',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, status, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ status, size, className }))} {...props} />;
}
