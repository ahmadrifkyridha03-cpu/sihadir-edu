import React from 'react';
import { db } from '@/lib/db';
import { evaluateClassEarlyWarning } from '@/lib/analytics/early-warning';
import { dispatchEwsWhatsAppAlertAction } from '@/actions/analytics';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  PhoneCall,
  FileCheck,
  Calendar,
  Clock,
  BookX,
  Send,
  HelpCircle,
} from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    classId?: string;
    month?: string;
    year?: string;
  }>;
}

export default async function EarlyWarningPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const classes = await db.class.findMany({
    orderBy: { className: 'asc' },
    include: { academicYear: true },
  });

  const selectedClassId = resolvedParams.classId || classes[0]?.id || '';
  const now = new Date();
  const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year, 10) : now.getFullYear();
  const selectedMonth = resolvedParams.month ? parseInt(resolvedParams.month, 10) : now.getMonth() + 1;

  let ewsResult = null;
  let errorMsg = null;

  if (selectedClassId) {
    try {
      ewsResult = await evaluateClassEarlyWarning({
        classId: selectedClassId,
        year: selectedYear,
        month: selectedMonth,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-rose-600" />
            <span>Early Warning System (EWS)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Deteksi dini siswa berisiko drop-out, bolos berulang, dan ketidakhadiran beruntun (5 Invarian Kritis)
          </p>
        </div>

        {/* Filter Toolbar */}
        <form method="GET" className="flex items-center gap-2">
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.className}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            Filter
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {ewsResult && (
        <>
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Risiko Kritis (Merah)
                </span>
                <p className="text-3xl font-black text-rose-700 mt-1">
                  {ewsResult.counts.critical} Siswa
                </p>
                <p className="text-xs text-rose-500 mt-0.5">
                  Tindakan darurat &lt;24 jam (SP 2 / Home Visit)
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertOctagon className="w-7 h-7" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Peringatan (Kuning)
                </span>
                <p className="text-3xl font-black text-amber-700 mt-1">
                  {ewsResult.counts.warning} Siswa
                </p>
                <p className="text-xs text-amber-500 mt-0.5">
                  Konseling Wali Kelas &amp; Notifikasi Ortu
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-7 h-7" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Kondisi Normal (Hijau)
                </span>
                <p className="text-3xl font-black text-emerald-700 mt-1">
                  {ewsResult.counts.normal} Siswa
                </p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  Memenuhi standar kehadiran &gt;90%
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-7 h-7" />
              </div>
            </div>
          </div>

          {/* Student Risk Cards */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
              Daftar Siswa dalam Pemantauan ({ewsResult.students.length} Siswa Terdaftar)
            </h2>

            {ewsResult.students.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                Tidak ada data siswa untuk kelas ini.
              </div>
            ) : (
              ewsResult.students.map((student) => {
                const isCritical = student.riskLevel === 'CRITICAL';
                const isWarning = student.riskLevel === 'WARNING';
                const cardBorder = isCritical
                  ? 'border-rose-300 bg-rose-50/20'
                  : isWarning
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200 bg-white';

                const badgeBg = isCritical
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : isWarning
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                return (
                  <div
                    key={student.studentId}
                    className={`rounded-2xl border p-5 shadow-sm transition-all ${cardBorder}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Left: Student Identity & Risk Badge */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 text-xs font-black rounded-full border ${badgeBg}`}
                          >
                            {student.riskLevel === 'CRITICAL'
                              ? '🚨 KRITIS'
                              : student.riskLevel === 'WARNING'
                              ? '⚠️ PERINGATAN'
                              : '✅ NORMAL'}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400">
                            Skor Risiko: {student.riskScore}/100
                          </span>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            Kehadiran: {student.attendanceRate}%
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-slate-900">
                            {student.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono">
                            NIS: {student.nis} | NISN: {student.nisn} | Kelas: {student.className}
                          </p>
                        </div>

                        {/* Invariants Triggered */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {student.invariants
                            .filter((inv) => inv.triggered)
                            .map((inv) => (
                              <span
                                key={inv.id}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                                  inv.severity === 'CRITICAL'
                                    ? 'bg-rose-100/80 text-rose-900 border-rose-200'
                                    : 'bg-amber-100/80 text-amber-900 border-amber-200'
                                }`}
                              >
                                {inv.description}
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Right: Detailed Metric Counters */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/80 p-3 rounded-xl border border-slate-200/80 text-center">
                        <div className="p-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Alpa Beruntun
                          </span>
                          <p
                            className={`text-lg font-black ${
                              student.metrics.consecutiveAlpaDays >= 3
                                ? 'text-rose-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {student.metrics.consecutiveAlpaDays} Hari
                          </p>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Alpa Bulanan
                          </span>
                          <p
                            className={`text-lg font-black ${
                              student.metrics.monthlyAlpaCount >= 3
                                ? 'text-rose-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {student.metrics.monthlyAlpaCount} Hari
                          </p>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Terlambat
                          </span>
                          <p
                            className={`text-lg font-black ${
                              student.metrics.lateArrivalCount >= 5
                                ? 'text-rose-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {student.metrics.lateArrivalCount}x ({student.metrics.totalLateMinutes}m)
                          </p>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Bolos Kelas
                          </span>
                          <p
                            className={`text-lg font-black ${
                              student.metrics.bolosCount > 0
                                ? 'text-rose-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {student.metrics.bolosCount}x
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actionable SOP Guidance & WhatsApp Dispatch Box */}
                    {student.counselingSop && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 p-3.5 rounded-xl">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-800">
                              SOP Penanganan ({student.counselingSop.roleResponsible}):
                            </span>
                            <span className="text-xs font-semibold text-blue-700">
                              {student.counselingSop.primaryAction}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Dokumen Resmi Wajib: <b>{student.counselingSop.officialDocumentRequired}</b>
                          </p>
                        </div>

                        {/* WhatsApp Alert Button */}
                        <form
                          action={async () => {
                            'use server';
                            await dispatchEwsWhatsAppAlertAction({
                              studentId: student.studentId,
                              customMessage: student.counselingSop?.waPayload
                                ? undefined
                                : undefined,
                            });
                          }}
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>1-Tap Peringatan WA Ortu</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
