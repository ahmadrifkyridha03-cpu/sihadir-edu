import React from 'react';
import { db } from '@/lib/db';
import { generateAttendanceMatrixRecap } from '@/lib/analytics/recap-matrix';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  XCircle,
} from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    classId?: string;
    month?: string;
    year?: string;
    semester?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function RecapAttendancePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const classes = await db.class.findMany({
    orderBy: { className: 'asc' },
    include: { academicYear: true },
  });

  const selectedClassId = resolvedParams.classId || classes[0]?.id || '';
  const now = new Date();
  const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year, 10) : now.getFullYear();
  const selectedMonth = resolvedParams.month ? parseInt(resolvedParams.month, 10) : now.getMonth() + 1;
  const selectedSemester = resolvedParams.semester ? (parseInt(resolvedParams.semester, 10) as 1 | 2) : 1;

  let matrix = null;
  let errorMsg = null;

  if (selectedClassId) {
    try {
      matrix = await generateAttendanceMatrixRecap({
        classId: selectedClassId,
        periodType: 'MONTHLY',
        year: selectedYear,
        month: selectedMonth,
        semester: selectedSemester,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }
  }

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            <span>Rekapitulasi Presensi Siswa</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Matriks absensi bulanan dan semesteran dengan integrasi Form 8355 Dapodik
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/export/excel?classId=${selectedClassId}&month=${selectedMonth}&year=${selectedYear}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </a>
          <a
            href={`/api/export/pdf?classId=${selectedClassId}&month=${selectedMonth}&year=${selectedYear}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Unduh PDF</span>
          </a>
          <a
            href={`/recap-attendance/print?classId=${selectedClassId}&month=${selectedMonth}&year=${selectedYear}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen</span>
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Pilih Kelas
            </label>
            <select
              name="classId"
              defaultValue={selectedClassId}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.academicYear?.yearName || '2026/2027'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Pilih Bulan
            </label>
            <select
              name="month"
              defaultValue={selectedMonth}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Tahun
            </label>
            <input
              type="number"
              name="year"
              defaultValue={selectedYear}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Tampilkan Rekap</span>
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {matrix && (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                % Kehadiran
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-blue-600">
                  {matrix.classStats.averageAttendanceRate}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                  Rata-rata
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Total Hadir (H)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-700 mt-2">
                {matrix.students.reduce((acc, s) => acc + s.summary.hadirCount, 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Terlambat (T)</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl font-black text-amber-700 mt-2">
                {matrix.students.reduce((acc, s) => acc + s.summary.terlambatCount, 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Sakit (S)</span>
                <AlertCircle className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-2xl font-black text-purple-700 mt-2">
                {matrix.students.reduce((acc, s) => acc + s.summary.sakitCount, 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Izin (I)</span>
                <HelpCircle className="w-4 h-4 text-sky-500" />
              </div>
              <span className="text-2xl font-black text-sky-700 mt-2">
                {matrix.students.reduce((acc, s) => acc + s.summary.izinCount, 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Alpa (A)</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-2xl font-black text-rose-700 mt-2">
                {matrix.students.reduce((acc, s) => acc + s.summary.alpaCount, 0)}
              </span>
            </div>
          </div>

          {/* Dapodik Form 8355 Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-800">
                Form 8355 Kemdikbud:
              </span>
              <span>
                Total Siswa: <b>{matrix.classStats.totalStudents}</b> (Laki-laki: <b>{matrix.classStats.countLaki}</b>, Perempuan: <b>{matrix.classStats.countPerempuan}</b>)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Kehadiran L: <b>{matrix.classStats.genderStats.laki.attendanceRate}%</b>
              </span>
              <span>
                Kehadiran P: <b>{matrix.classStats.genderStats.perempuan.attendanceRate}%</b>
              </span>
              <span>
                Hari Efektif Berlalu: <b>{matrix.period.elapsedEffectiveDays}</b> / {matrix.period.totalEffectiveDays} Hari
              </span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-2.5 border-b border-r border-slate-200 sticky left-0 bg-slate-100 z-30 w-10 text-center">
                      No
                    </th>
                    <th className="p-2.5 border-b border-r border-slate-200 sticky left-10 bg-slate-100 z-30 w-24 text-center">
                      NIS
                    </th>
                    <th className="p-2.5 border-b border-r border-slate-200 sticky left-34 bg-slate-100 z-30 min-w-[180px]">
                      Nama Siswa
                    </th>
                    <th className="p-2.5 border-b border-r border-slate-200 text-center w-10">
                      L/P
                    </th>
                    {matrix.days.map((day) => (
                      <th
                        key={day.date}
                        className={`p-1.5 border-b border-r border-slate-200 text-center w-7 ${
                          !day.isEffective ? 'bg-slate-200 text-slate-400' : ''
                        }`}
                        title={day.holidayName || `${day.dayName}, ${day.date}`}
                      >
                        <div>{day.dayNumber}</div>
                        <div className="text-[9px] font-normal opacity-75">{day.dayName}</div>
                      </th>
                    ))}
                    <th className="p-2 border-b border-r border-slate-200 text-center bg-emerald-50 text-emerald-800 w-10">
                      H
                    </th>
                    <th className="p-2 border-b border-r border-slate-200 text-center bg-purple-50 text-purple-800 w-10">
                      S
                    </th>
                    <th className="p-2 border-b border-r border-slate-200 text-center bg-sky-50 text-sky-800 w-10">
                      I
                    </th>
                    <th className="p-2 border-b border-r border-slate-200 text-center bg-rose-50 text-rose-800 w-10">
                      A
                    </th>
                    <th className="p-2 border-b border-r border-slate-200 text-center bg-amber-50 text-amber-800 w-10">
                      T
                    </th>
                    <th className="p-2 border-b border-slate-200 text-center bg-blue-50 text-blue-800 w-16">
                      % Hadir
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matrix.students.map((student, idx) => (
                    <tr
                      key={student.studentId}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-2 border-r border-slate-200 text-center sticky left-0 bg-white z-10 font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center sticky left-10 bg-white z-10 font-mono text-slate-600">
                        {student.nis}
                      </td>
                      <td className="p-2 border-r border-slate-200 sticky left-34 bg-white z-10 font-semibold text-slate-900 truncate max-w-[200px]">
                        {student.fullName}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-medium text-slate-500">
                        {student.gender}
                      </td>

                      {/* Daily status cells */}
                      {matrix.days.map((day) => {
                        const code = student.dailyStatuses[day.date] || ' ';
                        let badgeClass = 'text-slate-300';

                        if (code === 'H') {
                          badgeClass = 'bg-emerald-100 text-emerald-800 font-bold';
                        } else if (code === 'T') {
                          badgeClass = 'bg-amber-100 text-amber-800 font-bold';
                        } else if (code === 'S') {
                          badgeClass = 'bg-purple-100 text-purple-800 font-bold';
                        } else if (code === 'I') {
                          badgeClass = 'bg-sky-100 text-sky-800 font-bold';
                        } else if (code === 'A') {
                          badgeClass = 'bg-rose-100 text-rose-800 font-bold';
                        } else if (code === 'B') {
                          badgeClass = 'bg-red-200 text-red-900 font-extrabold';
                        } else if (code === '-') {
                          badgeClass = 'bg-slate-100 text-slate-400';
                        }

                        return (
                          <td
                            key={day.date}
                            className={`p-1 border-r border-slate-200 text-center ${
                              !day.isEffective ? 'bg-slate-50' : ''
                            }`}
                          >
                            <span
                              className={`inline-block w-5 h-5 leading-5 rounded text-[10px] ${badgeClass}`}
                            >
                              {code}
                            </span>
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {student.summary.hadirCount}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-purple-700 bg-purple-50/30">
                        {student.summary.sakitCount}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-sky-700 bg-sky-50/30">
                        {student.summary.izinCount}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-rose-700 bg-rose-50/30">
                        {student.summary.alpaCount}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-amber-700 bg-amber-50/30">
                        {student.summary.terlambatCount}
                      </td>
                      <td className="p-2 text-center font-black text-blue-700 bg-blue-50/40">
                        {student.summary.attendanceRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
