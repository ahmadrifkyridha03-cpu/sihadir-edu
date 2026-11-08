'use client';

import Link from 'next/link';
import {
  QrCode,
  GraduationCap,
  Users,
  BarChart3,
  CheckCircle2,
  Clock,
  Mail,
  AlertTriangle,
  XCircle,
  Sparkles,
  LogIn,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl space-y-8 text-center animate-enter-snappy">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            SiHadir-Edu v0.1.0 • Next.js 15 + Tailwind CSS
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
            Sistem Informasi Absensi & Penilaian Terpadu
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted">
            Solusi presensi dual-layer anti-titip absen, dokumentasi kelas terkompresi WebP,
            penilaian harian KKM, dan notifikasi WhatsApp terintegrasi.
          </p>
        </div>

        {/* Semantic Status Badge Preview */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
            Semantic Attendance Status Tokens
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-hadir-bg px-3 py-1 text-xs font-semibold text-status-hadir-fg">
              <CheckCircle2 className="h-3.5 w-3.5" />
              HADIR (06:48 WIB)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-terlambat-bg px-3 py-1 text-xs font-semibold text-status-terlambat-fg">
              <Clock className="h-3.5 w-3.5" />
              TERLAMBAT (+15m)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-izin-bg px-3 py-1 text-xs font-semibold text-status-izin-fg">
              <Mail className="h-3.5 w-3.5" />
              IZIN (Disetujui)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-sakit-bg px-3 py-1 text-xs font-semibold text-status-sakit-fg">
              <AlertTriangle className="h-3.5 w-3.5" />
              SAKIT (Surat Dokter)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-alpa-bg px-3 py-1 text-xs font-semibold text-status-alpa-fg">
              <XCircle className="h-3.5 w-3.5" />
              ALPA / BOLOS
            </span>
          </div>
        </div>

        {/* Core Portals Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {/* Gate Scanner */}
          <Link
            href="/gate-scanner"
            className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Kiosk Scanner</h3>
              <p className="mt-1 text-xs text-muted">
                Pindai kartu QR siswa kedatangan gerbang dengan verifikasi foto anti-titip absen.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:underline btn-press touch-target">
              Buka Scanner →
            </span>
          </Link>

          {/* Teacher Portal */}
          <Link
            href="/dashboard"
            className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Portal Guru</h3>
              <p className="mt-1 text-xs text-muted">
                Jurnal kelas cepat, validasi presensi, 4 badge keaktifan, dan foto kompresi &lt;180KB.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:underline btn-press touch-target">
              Buka Jadwal →
            </span>
          </Link>

          {/* Parent Portal */}
          <Link
            href="/parent-dashboard"
            className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Portal Orang Tua</h3>
              <p className="mt-1 text-xs text-muted">
                Timeline harian 3-Detik Paham, child switcher multi-anak, nilai harian & izin sakit.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:underline btn-press touch-target">
              Buka Portal →
            </span>
          </Link>

          {/* Admin & Recap */}
          <Link
            href="/recap-attendance"
            className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Rekap & EWS</h3>
              <p className="mt-1 text-xs text-muted">
                Matriks 1-31 hari, kalkulasi % kehadiran, alert EWS alpa beruntun, dan export Excel/PDF.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:underline btn-press touch-target">
              Buka Rekap →
            </span>
          </Link>
        </div>

        {/* Quick Actions Footer */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover btn-press touch-target"
          >
            <LogIn className="h-4 w-4" />
            Masuk / Login Sistem
          </Link>
          <Link
            href="/qr-cards"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-slate-50 btn-press touch-target"
          >
            <CreditCard className="h-4 w-4 text-primary" />
            Cetak Kartu QR Siswa
          </Link>
          <Link
            href="/early-warning"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-slate-50 btn-press touch-target"
          >
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Monitor EWS
          </Link>
        </div>
      </div>
    </main>
  );
}
