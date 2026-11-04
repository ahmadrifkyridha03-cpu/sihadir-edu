import React from 'react';
import { db } from '@/lib/db';
import { generateSignedQrToken } from '@/lib/qr-token';
import { getSchoolProfile } from '@/lib/export/school-config';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Printer,
  Sparkles,
  Layers,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    classId?: string;
    layout?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function QrCardsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const classes = await db.class.findMany({
    orderBy: { className: 'asc' },
    include: { academicYear: true },
  });

  const selectedClassId = resolvedParams.classId || classes[0]?.id || '';
  const selectedLayout = resolvedParams.layout || '10_CARDS';

  const students = selectedClassId
    ? await db.student.findMany({
        where: { classId: selectedClassId, status: 'ACTIVE' },
        include: { class: { include: { academicYear: true } } },
        orderBy: { fullName: 'asc' },
      })
    : [];

  const school = getSchoolProfile();

  // Generate preview QR code for first student or dummy
  const sampleStudent = students[0] || {
    id: 'sample-std',
    nis: '26101',
    nisn: '0081234567',
    fullName: 'Budi Santoso',
    class: {
      className: classes[0]?.className || 'X-IPA-1',
      academicYear: { yearName: '2026/2027' },
    },
  };

  const sampleToken = generateSignedQrToken(sampleStudent.nis || sampleStudent.id);
  const sampleQrDataUrl = await QRCode.toDataURL(sampleToken, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });

  const cardsPerPage = selectedLayout === '10_CARDS' ? 10 : 8;
  const totalSheets = Math.ceil(students.length / cardsPerPage);

  return (
    <div className="space-y-6">
      {/* Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-7 h-7 text-blue-600" />
            <span>Cetak Kartu QR Pelajar Massal</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Format standar CR80 (85.60 mm × 53.98 mm) dengan tanda potong presisi dan token HMAC-SHA256
          </p>
        </div>

        {/* Download Action Button */}
        <a
          href={`/api/export/qr-cards?classId=${selectedClassId}&layout=${selectedLayout}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Unduh PDF Siap Cetak (A4)</span>
        </a>
      </div>

      {/* Configuration Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              Format Tata Letak (A4 Imposition)
            </label>
            <select
              name="layout"
              defaultValue={selectedLayout}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="10_CARDS">10 Kartu per Lembar (2 × 5 Grid - Paling Hemat Kertas)</option>
              <option value="8_CARDS">8 Kartu per Lembar (2 × 4 Grid - Margin Ekstra Printer Kantor)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>Perbarui Pratinjau</span>
            </button>
          </div>
        </form>
      </div>

      {/* Production Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Siswa Terdaftar
            </span>
            <p className="text-2xl font-black text-slate-900">
              {students.length} Siswa
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Kebutuhan Kertas A4
            </span>
            <p className="text-2xl font-black text-slate-900">
              {totalSheets} Lembar ({cardsPerPage} kartu/lembar)
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Keamanan Kriptografis
            </span>
            <p className="text-sm font-bold text-slate-800">
              HMAC-SHA256 Signed
            </p>
            <p className="text-[11px] text-slate-500">Anti-pemalsuan barcode</p>
          </div>
        </div>
      </div>

      {/* Live Physical Card Mockup Preview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Pratinjau Kartu Siswa Fisik (Standar CR80 ID-1)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Dimensi aktual cetak: 85.60 mm × 53.98 mm, sudut membulat 3.18 mm, rasio aspek 1.586 : 1
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            Skala 1:1 Display
          </span>
        </div>

        {/* Physical Card Representation */}
        <div className="flex justify-center p-8 bg-slate-100 rounded-2xl border border-dashed border-slate-300">
          <div
            className="w-[342px] h-[216px] bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden flex flex-col justify-between relative font-sans"
            style={{ width: '342px', height: '216px' }}
          >
            {/* Header Strip */}
            <div className="bg-blue-600 text-white px-3 py-1.5 flex items-center justify-between border-b-2 border-amber-400">
              <div>
                <h4 className="text-[10px] font-black tracking-tight leading-tight uppercase">
                  {school.schoolName}
                </h4>
                <p className="text-[8px] text-blue-200 font-medium tracking-wider">
                  KARTU TANDA PELAJAR DIGITAL
                </p>
              </div>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-blue-800 text-white">
                TA 2026/27
              </span>
            </div>

            {/* Body Content */}
            <div className="px-3 py-2 flex items-center justify-between flex-1">
              {/* Photo & Identity */}
              <div className="flex items-center gap-2.5">
                {/* Photo frame */}
                <div className="w-[72px] h-[96px] bg-slate-100 border border-slate-300 rounded flex flex-col items-center justify-center text-slate-400">
                  <span className="font-bold text-sm text-slate-500">
                    {sampleStudent.fullName
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <span className="text-[7px] text-slate-400 mt-1">PAS FOTO</span>
                </div>

                {/* Identity Info */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block">
                      Nama Siswa
                    </span>
                    <span className="text-[11px] font-black text-slate-900 block leading-tight">
                      {sampleStudent.fullName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block">
                      NIS / NISN
                    </span>
                    <span className="text-[9px] font-bold font-mono text-slate-700 block">
                      {sampleStudent.nis} / {sampleStudent.nisn}
                    </span>
                  </div>

                  <div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block">
                      Kelas
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-600 block">
                      {sampleStudent.class.className}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                <div className="w-[96px] h-[96px] p-1 bg-white border border-slate-200 rounded flex items-center justify-center">
                  <img
                    src={sampleQrDataUrl}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[7px] font-mono font-bold text-slate-500 mt-1">
                  {sampleToken}
                </span>
              </div>
            </div>

            {/* Footer Strip */}
            <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 text-center">
              <span className="text-[6.5px] font-bold text-slate-400 tracking-wider">
                SIHADIR-EDU SECURE QR • DILINDUNGI HMAC-SHA256
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
