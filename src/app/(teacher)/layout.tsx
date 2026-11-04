import * as React from 'react';
import Link from 'next/link';
import { Calendar, BookOpen, QrCode, Home, ShieldCheck } from 'lucide-react';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 select-none group"
          >
            <div className="w-8 h-8 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors">
              <ShieldCheck className="w-5 h-5 text-blue-400 group-hover:text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none block">
                SiHadir Guru
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Portal Presensi & Jurnal Mengajar
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            >
              Jadwal Hari Ini
            </Link>
            <Link
              href="/journal/new"
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            >
              Buat Jurnal
            </Link>
            <Link
              href="/gate-scanner"
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            >
              Scanner Gerbang
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors ml-2"
            >
              Beranda
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation for Teachers */}
      <nav
        aria-label="Navigasi Guru"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe sm:hidden"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center justify-center flex-1 h-full text-slate-600 hover:text-blue-600 active:scale-[0.95] transition-all gap-1"
          >
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-[10px] font-bold">Jadwal</span>
          </Link>

          <Link
            href="/journal/new"
            className="flex flex-col items-center justify-center flex-1 h-full text-slate-600 hover:text-blue-600 active:scale-[0.95] transition-all gap-1"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-medium">Jurnal</span>
          </Link>

          <Link
            href="/gate-scanner"
            className="flex flex-col items-center justify-center flex-1 h-full text-slate-600 hover:text-blue-600 active:scale-[0.95] transition-all gap-1"
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px] font-medium">Kiosk</span>
          </Link>

          <Link
            href="/"
            className="flex flex-col items-center justify-center flex-1 h-full text-slate-600 hover:text-blue-600 active:scale-[0.95] transition-all gap-1"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Menu</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
