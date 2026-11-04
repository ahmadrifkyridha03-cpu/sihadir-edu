'use client';

import React, { useState, useRef, useTransition, useMemo } from 'react';
import {
  Save,
  Sparkles,
  ClipboardPaste,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { KkmIndicator } from './KkmIndicator';
import { saveStudentGradesAction } from '@/actions/grading';
import { calculateGradeStats, clampScore } from '@/lib/grading';
import { cn } from '@/lib/utils';

export interface GridStudentRow {
  studentId: string;
  nis: string;
  fullName: string;
  score: number | null;
  teacherFeedback: string;
  isExistingGrade: boolean;
}

export interface FormalGradeGridProps {
  assessmentId: string;
  assessmentTitle: string;
  subjectName: string;
  kkmScore: number;
  initialStudents: GridStudentRow[];
  onSaveComplete?: () => void;
}

export function FormalGradeGrid({
  assessmentId,
  assessmentTitle,
  subjectName,
  kkmScore,
  initialStudents,
  onSaveComplete,
}: FormalGradeGridProps) {
  const [rows, setRows] = useState<GridStudentRow[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);

  // Array of input refs for keyboard navigation
  const scoreInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Filtered rows for search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(query) ||
        r.nis.toLowerCase().includes(query)
    );
  }, [rows, searchQuery]);

  // Real-time Class Statistics HUD using grading library
  const stats = useMemo(() => {
    const scores = rows.map((r) => r.score);
    return calculateGradeStats(scores, kkmScore);
  }, [rows, kkmScore]);

  // Input sanitization & clamping (0.00 to 100.00)
  const handleScoreChange = (indexInRows: number, rawValue: string) => {
    setIsDirty(true);
    setRows((prev) => {
      const next = [...prev];
      if (rawValue.trim() === '') {
        next[indexInRows] = { ...next[indexInRows], score: null };
        return next;
      }

      // Convert comma to dot and parse
      const sanitized = rawValue.replace(',', '.');
      const parsed = parseFloat(sanitized);

      if (isNaN(parsed)) {
        return next;
      }

      // Clamp between 0.00 and 100.00
      const clamped = clampScore(parsed, 0, 100);
      next[indexInRows] = { ...next[indexInRows], score: clamped };
      return next;
    });
  };

  const handleFeedbackChange = (indexInRows: number, feedback: string) => {
    setIsDirty(true);
    setRows((prev) => {
      const next = [...prev];
      next[indexInRows] = { ...next[indexInRows], teacherFeedback: feedback };
      return next;
    });
  };

  // Keyboard navigation: Enter & ArrowDown move down; ArrowUp moves up
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    renderedIdx: number
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = scoreInputRefs.current[renderedIdx + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = scoreInputRefs.current[renderedIdx - 1];
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  };

  // Spreadsheet Copy-Paste Parser (Excel / Google Sheets TSV/CSV)
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRenderedIdx: number
  ) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Split by newlines or tabs
    const rawTokens = pasteData
      .split(/\r\n|\n|\r/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // If paste data only contains a single token, let default paste behavior handle it
    if (rawTokens.length <= 1) return;

    e.preventDefault();

    setRows((prev) => {
      const next = [...prev];
      let tokenIdx = 0;

      for (let i = startRenderedIdx; i < filteredRows.length && tokenIdx < rawTokens.length; i++) {
        const studentId = filteredRows[i].studentId;
        const actualRowIdx = next.findIndex((r) => r.studentId === studentId);
        if (actualRowIdx === -1) continue;

        const token = rawTokens[tokenIdx].replace(',', '.');
        const num = parseFloat(token);
        if (!isNaN(num)) {
          next[actualRowIdx] = {
            ...next[actualRowIdx],
            score: clampScore(num, 0, 100),
          };
        }
        tokenIdx++;
      }

      toast.success(`${tokenIdx} nilai berhasil ditempel dari spreadsheet!`);
      setIsDirty(true);
      return next;
    });
  };

  // Bulk Autofill helper
  const handleBulkAutofill = (defaultScore: number) => {
    setRows((prev) =>
      prev.map((r) => (r.score === null ? { ...r, score: defaultScore } : r))
    );
    setIsDirty(true);
    toast.info(`Nilai kosong berhasil diisi ${defaultScore}`);
  };

  // Save Action with Server Action & Toast
  const handleSave = () => {
    const gradesPayload = rows
      .filter((r) => r.score !== null && !isNaN(r.score))
      .map((r) => ({
        studentId: r.studentId,
        score: r.score as number,
        teacherFeedback: r.teacherFeedback.trim() || undefined,
      }));

    if (gradesPayload.length === 0) {
      toast.error('Belum ada nilai yang diinput untuk disimpan.');
      return;
    }

    startTransition(async () => {
      const res = await saveStudentGradesAction({
        assessmentId,
        grades: gradesPayload,
      });

      if (res.success) {
        setIsDirty(false);
        toast.success(res.message || 'Nilai siswa berhasil disimpan!');
        onSaveComplete?.();
      } else {
        toast.error(res.error || 'Gagal menyimpan nilai.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Sticky Class Statistics HUD */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
              {assessmentTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mata Pelajaran: <span className="font-semibold">{subjectName}</span> • KKM Standar:{' '}
              <span className="font-mono font-bold text-slate-700">{kkmScore.toFixed(0)}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkAutofill(kkmScore)}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] rounded-lg border border-slate-300 transition-transform min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Isi KKM ({kkmScore})</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !isDirty}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white rounded-lg shadow-xs transition-all active:scale-[0.97] min-h-[44px]',
                isDirty
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-slate-400 cursor-not-allowed opacity-80'
              )}
            >
              <Save className="w-4 h-4" />
              <span>{isPending ? 'Menyimpan...' : 'Simpan Nilai'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Terisi</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {stats.gradedCount} / {stats.total} Siswa
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Rata-rata Kelas</span>
            <span className="font-mono font-bold text-blue-700 text-sm">
              {stats.average.toFixed(1)}
            </span>
          </div>
          <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
            <span className="text-emerald-700 block">Tuntas (&ge; {kkmScore})</span>
            <span className="font-mono font-bold text-emerald-800 text-sm">
              {stats.passedCount} ({stats.passingRate.toFixed(1)}%)
            </span>
          </div>
          <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-200">
            <span className="text-rose-700 block">Perlu Remedial</span>
            <span className="font-mono font-bold text-rose-800 text-sm">
              {stats.remedialCount} Siswa
            </span>
          </div>
        </div>
      </div>

      {/* 2. Fast Filter & Paste Instruction Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa atau NIS..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ClipboardPaste className="w-3.5 h-3.5 text-slate-400" />
          <span>Tips: Copy 1 kolom nilai dari Excel lalu paste di input baris mana saja</span>
        </div>
      </div>

      {/* 3. Formal Grade Entry Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
              <th className="py-3 px-3 w-12 text-center">No</th>
              <th className="py-3 px-3">Nama Siswa</th>
              <th className="py-3 px-3 w-32 sm:w-36">Nilai (0-100)</th>
              <th className="py-3 px-3 w-36 sm:w-44">Status KKM</th>
              <th className="py-3 px-3">Catatan / Feedback Guru</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row, renderedIdx) => {
              const actualIdx = rows.findIndex((r) => r.studentId === row.studentId);
              const isRemedial = row.score !== null && row.score < kkmScore;

              return (
                <tr
                  key={row.studentId}
                  className={cn(
                    'transition-colors duration-160',
                    isRemedial
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : 'hover:bg-slate-50/80'
                  )}
                >
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                    {renderedIdx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{row.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">NIS: {row.nis}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      ref={(el) => {
                        scoreInputRefs.current[renderedIdx] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      value={row.score !== null ? row.score : ''}
                      onChange={(e) => handleScoreChange(actualIdx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, renderedIdx)}
                      onPaste={(e) => handlePaste(e, renderedIdx)}
                      placeholder="0 - 100"
                      className={cn(
                        'w-full px-2.5 py-1.5 font-mono text-center text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 min-h-[44px]',
                        row.score === null
                          ? 'border-slate-200 bg-white'
                          : isRemedial
                          ? 'border-rose-300 bg-rose-50 text-rose-900 focus:ring-rose-400'
                          : 'border-emerald-300 bg-emerald-50/50 text-emerald-900 focus:ring-emerald-400'
                      )}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <KkmIndicator
                      score={row.score}
                      kkm={kkmScore}
                      showDelta={true}
                      showLabel={true}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      maxLength={255}
                      value={row.teacherFeedback}
                      onChange={(e) => handleFeedbackChange(actualIdx, e.target.value)}
                      placeholder="Opsional: misal 'Perlu latihan aljabar lagi'"
                      className="w-full px-2.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
