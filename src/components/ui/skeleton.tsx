import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-slate-200/80 after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite_linear] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent',
        className
      )}
      {...props}
    />
  );
}

// Preset Layout Mirrors to prevent CLS
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}
