import * as React from 'react';
import { redirect } from 'next/navigation';
import db from '@/lib/db';
import { getParentSession, getActiveStudentIdFromCookie } from '@/lib/session';
import { Award, CheckCircle, AlertTriangle, Sparkles, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface GradesReportPageProps {
  searchParams: Promise<{
    studentId?: string;
  }>;
}

export default async function GradesReportPage({
  searchParams,
}: GradesReportPageProps) {
  const session = await getParentSession();
  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  let targetStudentId = params.studentId;
  if (!targetStudentId) {
    targetStudentId = (await getActiveStudentIdFromCookie()) || undefined;
  }

  const parentLinks = await db.parentStudentLink.findMany({
    where: { parentId: session.parentId },
    include: {
      student: {
        include: { class: true },
      },
    },
  });

  if (parentLinks.length === 0) {
    redirect('/login');
  }

  const activeLink =
    parentLinks.find((l) => l.studentId === targetStudentId) || parentLinks[0];
  const activeStudent = activeLink.student;

  // Fetch grades with assessment and subject details
  const grades = await db.studentGrade.findMany({
    where: { studentId: activeStudent.id },
    include: {
      assessment: {
        include: {
          subject: true,
          teacher: true,
        },
      },
    },
    orderBy: {
      assessment: {
        assessmentDate: 'desc',
      },
    },
  });

  // Calculate stats
  const totalAssessments = grades.length;
  let totalScore = 0;
  let passedCount = 0;

  // Group grades by subject
  const subjectMap = new Map<
    string,
    {
      subjectName: string;
      subjectCode: string;
      kkm: number;
      grades: typeof grades;
    }
  >();

  for (const g of grades) {
    const isPassed = Number(g.score) >= Number(g.assessment.subject.kkmScore);
    totalScore += Number(g.score);
    if (isPassed) passedCount++;

    const subId = g.assessment.subjectId;
    const existing = subjectMap.get(subId);
    if (!existing) {
      subjectMap.set(subId, {
        subjectName: g.assessment.subject.subjectName,
        subjectCode: g.assessment.subject.subjectCode,
        kkm: Number(g.assessment.subject.kkmScore),
        grades: [g],
      });
    } else {
      existing.grades.push(g);
    }
  }

  const overallAverage =
    totalAssessments > 0 ? (totalScore / totalAssessments).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Laporan Hasil Belajar Siswa
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Penilaian akademik ananda{' '}
              <strong className="text-slate-800">
                {activeStudent.fullName}
              </strong>{' '}
              (Kelas {activeStudent.class.className})
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3.5 sm:p-4 bg-white text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Rata-Rata Nilai
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-blue-600 mt-1">
            {overallAverage}
          </p>
        </Card>

        <Card className="p-3.5 sm:p-4 bg-white text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Ketuntasan KKM
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 mt-1">
            {totalAssessments > 0
              ? `${Math.round((passedCount / totalAssessments) * 100)}%`
              : '—'}
          </p>
        </Card>

        <Card className="p-3.5 sm:p-4 bg-white text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Total Penilaian
          </p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-800 mt-1">
            {totalAssessments} Tugas
          </p>
        </Card>
      </div>

      {/* Grade List Grouped by Subject */}
      {subjectMap.size === 0 ? (
        <EmptyState
          icon={<Award className="w-6 h-6 text-purple-600" />}
          title="Belum Ada Nilai Tersedia"
          description={`Belum ada data penilaian formal atau tugas yang diunggah untuk ananda ${activeStudent.fullName}.`}
        />
      ) : (
        <div className="space-y-4">
          {Array.from(subjectMap.values()).map((subjectGroup) => {
            const subAvg = (
              subjectGroup.grades.reduce((acc, cur) => acc + Number(cur.score), 0) /
              subjectGroup.grades.length
            ).toFixed(1);

            return (
              <Card key={subjectGroup.subjectCode} className="p-4 sm:p-5 bg-white space-y-3">
                {/* Subject Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {subjectGroup.subjectName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">
                      KKM: <strong className="font-mono">{subjectGroup.kkm}</strong>
                    </span>
                    <span className="text-xs font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-full">
                      Rata-Rata: {subAvg}
                    </span>
                  </div>
                </div>

                {/* Assessments Rows */}
                <div className="divide-y divide-slate-100">
                  {subjectGroup.grades.map((grade) => (
                    <div
                      key={grade.id}
                      className="py-2.5 flex items-center justify-between text-xs gap-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {grade.assessment.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {grade.assessment.category} •{' '}
                          {new Date(grade.assessment.assessmentDate).toLocaleDateString(
                            'id-ID',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}
                        </p>
                        {grade.teacherFeedback && (
                          <p className="text-[11px] text-slate-600 italic mt-1">
                            &quot;{grade.teacherFeedback}&quot;
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold font-mono text-slate-900">
                          {Number(grade.score).toFixed(0)}
                          <span className="text-slate-400 text-xs font-normal">
                            /{Number(grade.assessment.maxScore).toFixed(0)}
                          </span>
                        </span>
                        <div className="mt-0.5">
                          {Number(grade.score) >= Number(grade.assessment.subject.kkmScore) ? (
                            <Badge status="hadir" size="sm">
                              TUNTAS
                            </Badge>
                          ) : (
                            <Badge status="terlambat" size="sm">
                              REMEDIAL
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
