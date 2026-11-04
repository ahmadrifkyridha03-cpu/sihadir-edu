'use client';

import React, { useEffect, useState } from 'react';
import { User, CheckCircle2, Clock, AlertTriangle, ShieldAlert, LogOut } from 'lucide-react';
import type { GateScanResponse } from '@/actions/gate-scanner';

interface FaceVerificationPopupProps {
  scanResult: GateScanResponse | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function FaceVerificationPopup({
  scanResult,
  onDismiss,
  autoDismissMs = 2500,
}: FaceVerificationPopupProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!scanResult) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const intervalTime = 50;
    const step = 100 / (autoDismissMs / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [scanResult, onDismiss, autoDismissMs]);

  if (!scanResult || !scanResult.student) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center mb-4 text-slate-400">
          <User className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-slate-300 mb-1">
          Menunggu Pemindaian Kartu
        </h3>
        <p className="text-xs text-slate-400 max-w-xs">
          Arahkan barcode QR siswa ke kamera scanner atau gunakan barcode scanner USB.
        </p>
      </div>
    );
  }

  const { student, attendance, code, message } = scanResult;
  const isSuccess = scanResult.success;
  const isLate = attendance?.status === 'TERLAMBAT';
  const isCheckout = code === 'CHECKOUT_RECORDED';
  const isCooldown = code === 'COOLDOWN_ACTIVE';

  // Semantic border & glow tokens
  const borderColor = isCheckout
    ? 'border-sky-500 shadow-sky-500/20'
    : isCooldown
      ? 'border-amber-500 shadow-amber-500/20'
      : isLate
        ? 'border-amber-500 shadow-amber-500/20'
        : isSuccess
          ? 'border-emerald-500 shadow-emerald-500/20'
          : 'border-rose-500 shadow-rose-500/20';

  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-between p-6 sm:p-8 bg-slate-900 rounded-2xl border-2 shadow-2xl transition-all duration-200 ${borderColor}`}
    >
      {/* Top Countdown Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
        <div
          className={`h-full transition-all linear duration-75 ${
            isSuccess ? 'bg-emerald-500' : isCooldown ? 'bg-amber-500' : 'bg-rose-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header Guard Instruction Badge */}
      <div className="w-full flex items-center justify-between gap-2 mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-full">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>VERIFIKASI WAJAH PETUGAS</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/80"
        >
          Tutup (ESC)
        </button>
      </div>

      {/* Large Student Portrait Display (>= 192px) */}
      <div className="relative mb-5">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-4 border-slate-700 bg-slate-800 shadow-xl flex items-center justify-center">
          {student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.photoUrl}
              alt={student.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <User className="w-20 h-20 mb-2 opacity-50" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Foto Profil Belum Ada
              </span>
            </div>
          )}
        </div>

        {/* Floating Status Icon Pill */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          {isCheckout ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-600 text-white text-xs font-bold rounded-full shadow-lg">
              <LogOut className="w-3.5 h-3.5" />
              SCAN PULANG
            </span>
          ) : isLate ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full shadow-lg">
              <Clock className="w-3.5 h-3.5" />
              TERLAMBAT (+{attendance?.lateMinutes}m)
            </span>
          ) : isSuccess ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              TEPAT WAKTU
            </span>
          ) : isCooldown ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              COOLDOWN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-full shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              GAGAL
            </span>
          )}
        </div>
      </div>

      {/* Student Identification Information */}
      <div className="w-full text-center space-y-1 mb-4">
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
          {student.fullName}
        </h3>
        <p className="text-sm sm:text-base font-semibold text-emerald-400">
          Kelas: {student.className}
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-slate-400 font-mono">
          <span>NIS: {student.nis}</span>
          <span>•</span>
          <span>NISN: {student.nisn}</span>
        </div>
      </div>

      {/* System Feedback Message */}
      <div className="w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-200">
          {message}
        </p>
      </div>

      {/* Security Verification Notice */}
      <p className="text-[11px] text-slate-400 text-center mt-3 font-semibold tracking-wide">
        ⚠️ PASTIKAN WAJAH SISWA SESUAI DENGAN PEMBAWA KARTU
      </p>
    </div>
  );
}
