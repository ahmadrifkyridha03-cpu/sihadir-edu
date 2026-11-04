'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateKkm, DEFAULT_KKM_SCORE } from '@/lib/grading';

export interface KkmIndicatorProps {
  score: number | string | null | undefined;
  kkm?: number | string | null | undefined;
  showDelta?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onRemedialClick?: () => void;
}

export function KkmIndicator({
  score,
  kkm = DEFAULT_KKM_SCORE,
  showDelta = false,
  showLabel = true,
  size = 'md',
  className,
  onRemedialClick,
}: KkmIndicatorProps) {
  const result = evaluateKkm(score, kkm ?? DEFAULT_KKM_SCORE);

  if (!result.isGraded || result.score === null) {
    return (
      <span className={cn('text-xs text-slate-400 italic', className)}>
        Belum dinilai
      </span>
    );
  }

  const { isPassed, delta, formattedDelta } = result;

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-md border font-mono tabular-nums transition-colors duration-160',
          size === 'sm' && 'px-1.5 py-0.5 text-[11px]',
          size === 'md' && 'px-2 py-0.5 text-xs',
          size === 'lg' && 'px-2.5 py-1 text-sm font-semibold',
          isPassed
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        )}
      >
        {isPassed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        )}

        {showLabel && (
          <span className="font-sans font-medium">
            {isPassed ? 'Tuntas' : 'Remedial'}
          </span>
        )}

        {showDelta && (
          <span
            className={cn(
              'inline-flex items-center text-[10px] ml-0.5',
              isPassed ? 'text-emerald-700' : 'text-rose-700 font-bold'
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {formattedDelta}
          </span>
        )}
      </div>

      {!isPassed && onRemedialClick && (
        <button
          type="button"
          onClick={onRemedialClick}
          className="text-[11px] text-blue-600 hover:text-blue-800 underline active:scale-[0.97] transition-transform min-h-[32px] px-1 py-0.5"
        >
          Input Remedi
        </button>
      )}
    </div>
  );
}
