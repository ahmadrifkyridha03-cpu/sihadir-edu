'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  RefreshCw,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { recordGateScan, recordManualGateScan, type GateScanResponse } from '@/actions/gate-scanner';
import { FaceVerificationPopup } from '@/components/attendance/FaceVerificationPopup';
import { soundFeedback } from '@/lib/audio-cues';

interface RecentScanItem {
  id: string;
  studentName: string;
  className: string;
  nis: string;
  status: string;
  timeFormatted: string;
  isLate: boolean;
  lateMinutes: number;
}

export default function GateScannerPage() {
  const [activeScanResult, setActiveScanResult] = useState<GateScanResponse | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wibTimeStr, setWibTimeStr] = useState('--:--:-- WIB');
  const [scannerStatus, setScannerStatus] = useState<'STANDBY' | 'SCANNING' | 'PROCESSING'>('STANDBY');

  // Manual fallback input dialog
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Camera scanner reference
  const html5QrCodeRef = useRef<any>(null);
  const scannerContainerId = 'gate-qr-reader-viewport';

  // Live WIB Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const time = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setWibTimeStr(`${time} WIB`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Process Scan Function
  const processScan = useCallback(
    async (code: string) => {
      if (isProcessing) return;

      setIsProcessing(true);
      setScannerStatus('PROCESSING');

      try {
        const result = await recordGateScan(code);
        setActiveScanResult(result);

        if (result.success && result.student && result.attendance) {
          const isLate = result.attendance.status === 'TERLAMBAT';
          const isCheckout = result.attendance.scanType === 'CHECK_OUT';

          // Play audio
          soundFeedback.playSuccess();

          // Add to recent feed
          const nowStr = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date());

          setRecentScans((prev) => [
            {
              id: `${result.student!.id}-${Date.now()}`,
              studentName: result.student!.fullName,
              className: result.student!.className,
              nis: result.student!.nis,
              status: isCheckout ? 'PULANG' : isLate ? 'TERLAMBAT' : 'HADIR',
              timeFormatted: nowStr,
              isLate,
              lateMinutes: result.attendance!.lateMinutes,
            },
            ...prev.slice(0, 9),
          ]);

          if (isLate) {
            toast.warning(`Terlambat (+${result.attendance.lateMinutes} menit): ${result.student.fullName}`);
          } else if (isCheckout) {
            toast.info(`Scan Pulang: ${result.student.fullName}`);
          } else {
            toast.success(`Hadir Tepat Waktu: ${result.student.fullName}`);
          }
        } else {
          // Failure or Cooldown
          if (result.code === 'COOLDOWN_ACTIVE') {
            soundFeedback.playWarning();
            toast.warning(result.message);
          } else {
            soundFeedback.playError();
            toast.error(result.message);
          }
        }
      } catch (err) {
        console.error('Scan processing error:', err);
        soundFeedback.playError();
        toast.error('Terjadi kesalahan saat memproses data scan.');
      } finally {
        setIsProcessing(false);
        setScannerStatus('SCANNING');
      }
    },
    [isProcessing]
  );

  // Hardware USB Barcode Scanner Wedge Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in manual input box
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Hotkey F2 for manual modal
      if (e.key === 'F2') {
        e.preventDefault();
        setShowManualModal(true);
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Hardware barcode scanners transmit characters in rapid succession (< 80ms)
      if (timeDiff > 80) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 8) {
          e.preventDefault();
          const scannedCode = buffer.trim();
          buffer = '';
          void processScan(scannedCode);
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processScan]);

  // Camera Viewfinder Lifecycle via dynamic import
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            void processScan(decodedText);
          },
          () => {
            // Frame scan miss, normal operation
          }
        );

        if (isMounted) {
          setScannerStatus('SCANNING');
        }
      } catch (err) {
        console.warn('Camera initialization notice:', err);
        if (isMounted) {
          setScannerStatus('STANDBY');
        }
      }
    }

    void initCamera();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch(() => {})
          .then(() => {
            if (html5QrCodeRef.current) {
              html5QrCodeRef.current.clear();
            }
          });
      }
    };
  }, [processScan]);

  // Audio Toggle
  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundFeedback.setMuted(nextMuted);
    toast.info(nextMuted ? 'Suara scanner dimatikan' : 'Suara scanner diaktifkan');
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Manual Scan Submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setIsManualSubmitting(true);
    try {
      const res = await recordManualGateScan(manualInput.trim(), 'KIOSK_MANUAL_INPUT');
      setActiveScanResult(res);
      if (res.success && res.student && res.attendance) {
        soundFeedback.playSuccess();
        toast.success(`Hadir manual: ${res.student.fullName}`);
        setShowManualModal(false);
        setManualInput('');
      } else {
        soundFeedback.playError();
        toast.error(res.message);
      }
    } catch {
      soundFeedback.playError();
      toast.error('Gagal mencatat absensi manual.');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* 1. Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            🏫
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>SiHadir-Edu</span>
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded font-semibold">
                GATE SCANNER KIOSK
              </span>
            </h1>
          </div>
        </div>

        {/* Live Clock & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 rounded-lg text-emerald-400 font-mono text-sm sm:text-base font-bold tabular-nums border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>{wibTimeStr}</span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={isMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-slate-300 transition-all border border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Layar Penuh"
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-slate-300 transition-all border border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {/* Manual Input Fallback */}
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-slate-200 text-xs sm:text-sm font-semibold rounded-lg border border-slate-700 min-h-[44px]"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Input Manual (F2)</span>
            <span className="sm:hidden">Manual</span>
          </button>
        </div>
      </header>

      {/* 2. Main High-Contrast Dual-Pane View */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-6">
        {/* LEFT PANE: Camera Viewfinder & Hardware Scanner Wedge HUD (cols 12 -> 6) */}
        <section className="lg:col-span-6 flex flex-col space-y-4">
          <div className="relative flex-1 min-h-[360px] sm:min-h-[440px] bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden flex flex-col justify-between p-4 shadow-xl">
            {/* Viewfinder Target Container */}
            <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden rounded-xl bg-black">
              {/* html5-qrcode viewport element */}
              <div
                id={scannerContainerId}
                className="w-full h-full max-w-md max-h-md flex items-center justify-center"
              />

              {/* Laser Animation Bar */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-48 border-2 border-dashed border-emerald-400/50 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
              </div>
            </div>

            {/* Viewfinder Footer Status Indicator */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 px-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isProcessing
                      ? 'bg-amber-400 animate-ping'
                      : scannerStatus === 'SCANNING'
                        ? 'bg-emerald-400'
                        : 'bg-slate-500'
                  }`}
                />
                <span className="font-semibold text-slate-300">
                  {isProcessing
                    ? 'Memproses data scan...'
                    : scannerStatus === 'SCANNING'
                      ? 'Kamera & Barcode USB Siap'
                      : 'Menghubungkan Scanner...'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Wedge USB Aktif
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Face Verification Overlay & Recent Scans Feed (cols 12 -> 6) */}
        <section className="lg:col-span-6 flex flex-col space-y-4">
          {/* Face Verification Card */}
          <div className="flex-1 min-h-[360px]">
            <FaceVerificationPopup
              scanResult={activeScanResult}
              onDismiss={() => setActiveScanResult(null)}
              autoDismissMs={4000}
            />
          </div>

          {/* Recent Scans Feed */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-blue-400" />
              <span>Riwayat Pemindaian Terkini</span>
            </h3>

            {recentScans.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Belum ada data scan tercatat pagi ini.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">
                        {item.studentName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.className} • NIS: {item.nis}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase mb-0.5 ${
                          item.status === 'PULANG'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : item.isLate
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {item.isLate ? `⏰ +${item.lateMinutes}m` : item.status}
                      </span>
                      <p className="text-[10px] font-mono text-slate-400">
                        {item.timeFormatted}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Manual NIS Fallback Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100">
            <h3 className="text-lg font-bold text-white mb-1">
              Input Presensi Manual (Tanpa Kartu)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Gunakan opsi ini jika kartu QR siswa rusak, hilang, atau tertinggal di rumah.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nomor Induk Siswa (NIS)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Contoh: 26101 atau 26102"
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-lg min-h-[44px]"
                >
                  Batal (ESC)
                </button>
                <button
                  type="submit"
                  disabled={isManualSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md min-h-[44px]"
                >
                  {isManualSubmitting ? 'Memproses...' : 'Catat Kehadiran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
