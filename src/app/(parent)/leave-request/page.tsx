import * as React from 'react';
import { redirect } from 'next/navigation';
import db from '@/lib/db';
import { getParentSession, getActiveStudentIdFromCookie } from '@/lib/session';
import { LeaveRequestForm } from '@/components/parent/LeaveRequestForm';
import { CalendarCheck, History, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeaveRequestPageProps {
  searchParams: Promise<{
    studentId?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function LeaveRequestPage({
  searchParams,
}: LeaveRequestPageProps) {
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

  // Query leave submission history for this student
  const pastLeaves = await db.leaveRequest.findMany({
    where: {
      studentId: activeStudent.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Permohonan Izin / Sakit
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Pengajuan izin resmi ananda{' '}
              <strong className="text-slate-800">
                {activeStudent.fullName}
              </strong>{' '}
              (Kelas {activeStudent.class.className})
            </p>
          </div>
        </div>
      </div>

      {/* Main Submission Form */}
      <LeaveRequestForm
        parentId={session.parentId}
        studentId={activeStudent.id}
        studentName={activeStudent.fullName}
        className={activeStudent.class.className}
      />

      {/* Past Submissions History */}
      <div className="space-y-3 pt-4">
        <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          Riwayat Pengajuan Izin
        </h2>

        {pastLeaves.length === 0 ? (
          <Card className="p-4 text-center text-xs text-slate-400 bg-white/70">
            Belum ada riwayat permohonan izin untuk ananda ini.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {pastLeaves.map((leave) => {
              const startStr = new Date(leave.startDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const endStr = new Date(leave.endDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <Card
                  key={leave.id}
                  className="p-3.5 sm:p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        status={leave.leaveType === 'SAKIT' ? 'sakit' : 'izin'}
                        size="sm"
                      >
                        {leave.leaveType}
                      </Badge>

                      <span className="text-xs font-semibold text-slate-700">
                        {startStr === endStr ? startStr : `${startStr} s/d ${endStr}`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                      {leave.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {leave.approvalStatus === 'APPROVED' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Disetujui
                      </span>
                    )}
                    {leave.approvalStatus === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3.5 h-3.5" />
                        Ditolak
                      </span>
                    )}
                    {leave.approvalStatus === 'PENDING' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                        <Clock className="w-3.5 h-3.5" />
                        Menunggu Wali Kelas
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
