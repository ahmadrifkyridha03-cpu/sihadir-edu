import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Image as ImageIcon, Award, ArrowRight } from 'lucide-react';

interface JournalSummaryItem {
  id: string;
  journalDate: string;
  className: string;
  subjectName: string;
  topicMaterial: string;
  periodStart: number;
  periodEnd: number;
  photosCount: number;
  assessmentsCount: number;
}

interface TeacherJournalSummaryProps {
  journals: JournalSummaryItem[];
}

export function TeacherJournalSummary({ journals }: TeacherJournalSummaryProps) {
  if (journals.length === 0) {
    return (
      <Card className="p-5 text-center text-xs text-slate-400 bg-white">
        Belum ada riwayat jurnal yang dibuat.
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {journals.map((journal) => (
        <Card
          key={journal.id}
          className="p-3.5 sm:p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status="navy" size="sm">
                Kelas {journal.className}
              </Badge>
              <span className="text-xs font-bold text-blue-600">
                {journal.subjectName}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                • {journal.journalDate} (Jam {journal.periodStart}-{journal.periodEnd})
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-1 line-clamp-1">
              {journal.topicMaterial}
            </p>

            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                {journal.photosCount} Foto Dokumentasi
              </span>
              {journal.assessmentsCount > 0 && (
                <span className="flex items-center gap-1 text-purple-700 font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  {journal.assessmentsCount} Penilaian Terkait
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link href={`/journal/${journal.id}`}>
              <Button variant="outline" size="sm" className="text-xs gap-1">
                Buka Jurnal
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
