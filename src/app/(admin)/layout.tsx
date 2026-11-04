import React from 'react';
import Link from 'next/navigation';
import {
  FileSpreadsheet,
  AlertTriangle,
  QrCode,
  GraduationCap,
  CalendarCheck,
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                SiHadir<span className="text-blue-600">-Edu</span>
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                Admin Panel
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <a
              href="/recap-attendance"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Rekap Presensi</span>
            </a>
            <a
              href="/early-warning"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Early Warning (EWS)</span>
            </a>
            <a
              href="/qr-cards"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Cetak Kartu QR</span>
            </a>
            <a
              href="/gate-scanner"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Kiosk Gate</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
