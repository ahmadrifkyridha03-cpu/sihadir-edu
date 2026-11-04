import React from 'react';
import { db } from '@/lib/db';
import { generateAttendanceMatrixRecap } from '@/lib/analytics/recap-matrix';
import { getSchoolProfile } from '@/lib/export/school-config';
import { formatIndoDate } from '@/lib/timezone';
import { Printer, ArrowLeft } from 'lucide-react';

interface PrintPageProps {
  searchParams: Promise<{
    classId?: string;
    month?: string;
    year?: string;
    semester?: string;
  }>;
}

export default async function PrintRecapAttendancePage({
  searchParams,
}: PrintPageProps) {
  const resolvedParams = await searchParams;
  const classes = await db.class.findMany({
    orderBy: { className: 'asc' },
  });

  const selectedClassId = resolvedParams.classId || classes[0]?.id || '';
  const now = new Date();
  const selectedYear = resolvedParams.year ? parseInt(resolvedParams.year, 10) : now.getFullYear();
  const selectedMonth = resolvedParams.month ? parseInt(resolvedParams.month, 10) : now.getMonth() + 1;
  const selectedSemester = resolvedParams.semester ? (parseInt(resolvedParams.semester, 10) as 1 | 2) : 1;

  if (!selectedClassId) {
    return <div className="p-8 text-center">Kelas tidak ditemukan</div>;
  }

  const matrix = await generateAttendanceMatrixRecap({
    classId: selectedClassId,
    periodType: 'MONTHLY',
    year: selectedYear,
    month: selectedMonth,
    semester: selectedSemester,
  });

  const school = getSchoolProfile();

  return (
    <div className="bg-white min-h-screen text-black p-4 sm:p-8 font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 10mm 10mm;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8pt;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .signature-block {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Floating Toolbar (Hidden when printing) */}
      <div className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-300">
        <a
          href={`/recap-attendance?classId=${selectedClassId}&month=${selectedMonth}&year=${selectedYear}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </a>
        <button
          onClick={() => {
            // Note: client print trigger
          }}
          // We can use an inline script for window.print() or native anchor
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          id="print-btn"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Dokumen (Ctrl+P)</span>
        </button>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('print-btn')?.addEventListener('click', function() {
              window.print();
            });
          `,
        }}
      />

      {/* Official Indonesian Kop Surat */}
      <div className="text-center mb-3">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
          {school.governingBody} • {school.educationDepartment}
        </h3>
        <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase mt-0.5">
          {school.schoolName}
        </h1>
        <p className="text-[10px] text-slate-600">
          {school.address} • Telp: {school.phone} • Pos-el: {school.email} • NPSN: {school.npsn}
        </p>
        {/* Double rule border */}
        <div className="mt-2 border-b-2 border-black" />
        <div className="mt-0.5 border-b border-black" />
      </div>

      {/* Document Header & Metadata */}
      <div className="text-center mb-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">
          REKAPITULASI PRESENSI SISWA — {matrix.period.label.toUpperCase()}
        </h2>
      </div>

      <div className="grid grid-cols-3 text-xs mb-3 font-medium">
        <div>
          <p>Kelas / Fase: <b>{matrix.classInfo.className}</b></p>
          <p>Tahun Pelajaran: <b>{matrix.classInfo.academicYear?.yearName || '-'}</b></p>
        </div>
        <div className="text-center">
          <p>Wali Kelas: <b>{matrix.classInfo.homeroomTeacher?.fullName || '-'}</b></p>
          <p>Semester: <b>{matrix.classInfo.academicYear?.semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}</b></p>
        </div>
        <div className="text-right">
          <p>Hari Efektif: <b>{matrix.period.elapsedEffectiveDays} Hari</b> (Total {matrix.period.totalEffectiveDays} Hari)</p>
          <p>Kehadiran Rata-rata: <b>{matrix.classStats.averageAttendanceRate}%</b></p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100 text-center font-bold">
              <th className="border border-black p-1 w-6">No</th>
              <th className="border border-black p-1 w-16">NIS</th>
              <th className="border border-black p-1 text-left px-2">Nama Siswa</th>
              <th className="border border-black p-1 w-6">L/P</th>
              {matrix.days.map((day) => (
                <th
                  key={day.date}
                  className={`border border-black p-0.5 w-5 ${
                    !day.isEffective ? 'bg-slate-200 text-slate-400' : ''
                  }`}
                >
                  {day.dayNumber}
                </th>
              ))}
              <th className="border border-black p-1 w-6">H</th>
              <th className="border border-black p-1 w-6">S</th>
              <th className="border border-black p-1 w-6">I</th>
              <th className="border border-black p-1 w-6">A</th>
              <th className="border border-black p-1 w-6">T</th>
              <th className="border border-black p-1 w-10">%</th>
            </tr>
          </thead>
          <tbody>
            {matrix.students.map((student, idx) => (
              <tr key={student.studentId} className="text-center">
                <td className="border border-black p-1">{idx + 1}</td>
                <td className="border border-black p-1 font-mono">{student.nis}</td>
                <td className="border border-black p-1 text-left px-2 font-medium truncate max-w-[150px]">
                  {student.fullName}
                </td>
                <td className="border border-black p-1">{student.gender}</td>

                {matrix.days.map((day) => {
                  const code = student.dailyStatuses[day.date] || ' ';
                  let bg = '';
                  if (code === 'H') bg = 'bg-emerald-100 text-emerald-900 font-bold';
                  else if (code === 'T') bg = 'bg-amber-100 text-amber-900 font-bold';
                  else if (code === 'S') bg = 'bg-purple-100 text-purple-900';
                  else if (code === 'I') bg = 'bg-sky-100 text-sky-900';
                  else if (code === 'A') bg = 'bg-rose-100 text-rose-900 font-bold';
                  else if (code === 'B') bg = 'bg-red-200 text-red-900 font-extrabold';
                  else if (code === '-') bg = 'bg-slate-100 text-slate-400';

                  return (
                    <td key={day.date} className={`border border-black p-0.5 ${bg}`}>
                      {code}
                    </td>
                  );
                })}

                <td className="border border-black p-1 font-bold">{student.summary.hadirCount}</td>
                <td className="border border-black p-1">{student.summary.sakitCount}</td>
                <td className="border border-black p-1">{student.summary.izinCount}</td>
                <td className="border border-black p-1 font-bold">{student.summary.alpaCount}</td>
                <td className="border border-black p-1">{student.summary.terlambatCount}</td>
                <td className="border border-black p-1 font-bold">{student.summary.attendanceRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      <div className="signature-block mt-8 flex justify-between items-start text-xs font-medium px-8">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p className="font-bold">Kepala {school.schoolName}</p>
          <div className="h-20" />
          <p className="font-bold underline">{school.principalName}</p>
          <p>NIP. {school.principalNip}</p>
        </div>

        <div className="text-center">
          <p>{school.city}, {formatIndoDate(matrix.period.endDate)}</p>
          <p className="font-bold">Wali Kelas {matrix.classInfo.className}</p>
          <div className="h-20" />
          <p className="font-bold underline">
            {matrix.classInfo.homeroomTeacher?.fullName || 'Wali Kelas'}
          </p>
          <p>NIP. {matrix.classInfo.homeroomTeacher?.nip || '-'}</p>
        </div>
      </div>
    </div>
  );
}
