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
  RefreshCw,
  ScanLine,
  User,
  Users,
  Check,
  X,
  Loader2,
  SwitchCamera,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  recordGateScan,
  recordManualGateScan,
  getTodayGateStats,
  searchStudentsForManualGateAction,
  type GateScanResponse,
  type GateStatsResponse,
  type ManualSearchStudentResult,
} from '@/actions/gate-scanner';
import { FaceVerificationPopup } from '@/components/attendance/FaceVerificationPopup';
import { soundFeedback } from '@/lib/audio-cues';
import { cn } from '@/lib/utils';

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

  // Camera Facing Mode Toggle (environment <-> user)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Real-time Gate Statistics HUD
  const [gateStats, setGateStats] = useState<GateStatsResponse>({
    totalScanned: 0,
    tepatWaktu: 0,
    terlambat: 0,
    checkedOut: 0,
  });

  // Manual fallback input dialog & search
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ManualSearchStudentResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudentForConfirm, setSelectedStudentForConfirm] = useState<ManualSearchStudentResult | null>(null);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Camera scanner reference
  const html5QrCodeRef = useRef<any>(null);
  const scannerContainerId = 'gate-qr-reader-viewport';

  // Fetch gate stats helper
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getTodayGateStats();
      setGateStats(stats);
    } catch {
      // Ignore background stats fetch errors
    }
  }, []);

  // Live WIB Clock & initial stats
  useEffect(() => {
    refreshStats();

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
  }, [refreshStats]);

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

          // Refresh live HUD stats
          void refreshStats();

          if (isLate) {
            toast.warning(`Terlambat (+${result.attendance.lateMinutes} menit): ${result.student.fullName}`);
          } else if (isCheckout) {
            toast.info(`Scan Pulang: ${result.student.fullName}`);
          } else {
            toast.success(`Hadir Tepat Waktu: ${result.student.fullName}`);
          }
        } else {
          soundFeedback.playError();
          toast.error(result.message || 'Pemindaian gagal.');
        }
      } catch (err) {
        console.error('Scan processing error:', err);
        soundFeedback.playError();
        toast.error('Terjadi kesalahan sistem saat memproses kartu.');
      } finally {
        setTimeout(() => {
          setIsProcessing(false);
          setScannerStatus('SCANNING');
        }, 1500);
      }
    },
    [isProcessing, refreshStats]
  );

  // USB Hardware Barcode Scanner Listener (<80ms keystroke timing)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showManualModal) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (timeDiff > 80) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 8) {
          e.preventDefault();
          const scannedToken = buffer;
          buffer = '';
          void processScan(scannedToken);
        } else {
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processScan, showManualModal]);

  // Camera Viewfinder Lifecycle
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        // Stop existing instance if running
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop();
            html5QrCodeRef.current.clear();
          } catch {
            // Ignore stop errors on restart
          }
        }

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: facingMode },
          {
            fps: 15,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            void processScan(decodedText);
          },
          () => {
            // Frame miss, normal
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
  }, [facingMode, processScan]);

  // Toggle Camera facingMode
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    toast.info(nextMode === 'user' ? 'Kamera Depan Aktif' : 'Kamera Belakang Aktif');
  };

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
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Live Manual Student Search debounced
  useEffect(() => {
    const clean = manualQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchStudentsForManualGateAction(clean);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [manualQuery]);

  // Execute manual scan for confirmed student
  const handleConfirmManualScan = async (student: ManualSearchStudentResult) => {
    setIsManualSubmitting(true);
    try {
      const res = await recordManualGateScan(student.nis, 'OPERATOR_MANUAL_KIOSK');
      setActiveScanResult(res);

      if (res.success && res.student && res.attendance) {
        soundFeedback.playSuccess();
        const nowStr = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());

        setRecentScans((prev) => [
          {
            id: `${res.student!.id}-${Date.now()}`,
            studentName: res.student!.fullName,
            className: res.student!.className,
            nis: res.student!.nis,
            status: res.attendance!.scanType === 'CHECK_OUT' ? 'PULANG' : res.attendance!.status,
            timeFormatted: nowStr,
            isLate: res.attendance!.status === 'TERLAMBAT',
            lateMinutes: res.attendance!.lateMinutes,
          },
          ...prev.slice(0, 9),
        ]);

        void refreshStats();
        toast.success(`Presensi manual berhasil: ${student.fullName}`);
        setShowManualModal(false);
        setSelectedStudentForConfirm(null);
        setManualQuery('');
      } else {
        soundFeedback.playError();
        toast.error(res.message || 'Presensi manual gagal.');
      }
    } catch {
      soundFeedback.playError();
      toast.error('Terjadi kesalahan memproses presensi manual.');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* TOP HUD BAR */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            <ScanLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                SiHadir Kiosk HUD
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Pintu Gerbang Utama
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Throughput Cepat &bull; Auto-Dismiss 2.5 Detik
            </p>
          </div>
        </div>

        {/* Center: Realtime WIB Clock */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="font-mono text-base font-bold text-slate-100 tabular-nums">
            {wibTimeStr}
          </span>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 transition-colors min-h-[44px]"
            title="Balik kamera depan / belakang"
            aria-label="Balik kamera"
          >
            <SwitchCamera className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Balik Kamera</span>
          </button>

          {/* Sound Mute/Unmute */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] rounded-xl border border-slate-700 text-slate-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={isMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
            aria-label={isMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] rounded-xl border border-slate-700 text-slate-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center hidden sm:flex"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            aria-label="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Manual Input Fallback */}
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white font-bold text-xs rounded-xl shadow-md transition-colors min-h-[44px]"
          >
            <Search className="w-4 h-4" />
            <span>Tanpa Kartu</span>
          </button>
        </div>
      </header>

      {/* DUAL-PANE 1080p HUD LAYOUT */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {/* LEFT PANE: Camera Viewfinder & Hardware Scanner Frame (cols 12 -> 6) */}
        <section className="lg:col-span-6 flex flex-col space-y-3">
          <div className="relative aspect-4/3 sm:aspect-video lg:aspect-4/3 w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center">
            {/* Html5Qrcode video container */}
            <div id={scannerContainerId} className="w-full h-full object-cover" />

            {/* Viewfinder Target Overlay Crosshair */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-56 h-56 border-2 border-blue-500/60 rounded-3xl bg-blue-500/5">
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />

                {/* Animated horizontal scanner laser line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-[bounce_2s_infinite]" />
              </div>
            </div>

            {/* Bottom Camera Info Banner */}
            <div className="absolute bottom-3 inset-x-3 px-3 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    scannerStatus === 'SCANNING'
                      ? 'bg-emerald-400 animate-pulse'
                      : scannerStatus === 'PROCESSING'
                        ? 'bg-amber-400 animate-spin'
                        : 'bg-slate-500'
                  )}
                />
                <span className="text-slate-300 font-semibold text-[11px]">
                  {scannerStatus === 'SCANNING'
                    ? `Kamera Siap (${facingMode === 'user' ? 'Depan' : 'Belakang'})`
                    : scannerStatus === 'PROCESSING'
                      ? 'Memverifikasi...'
                      : 'Menghubungkan Scanner...'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Wedge USB Aktif
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Verification Popup, HUD Stats & Live Feed (cols 12 -> 6) */}
        <section className="lg:col-span-6 flex flex-col space-y-3.5">
          {/* Gate Statistics HUD (Total, Hadir, Terlambat) */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* Total Scan */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Scan
              </p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5">
                {gateStats.totalScanned}
              </p>
            </div>

            {/* Hadir Tepat Waktu */}
            <div className="bg-slate-900 border border-emerald-950/80 rounded-2xl p-3 shadow-xs">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Tepat Waktu
              </p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {gateStats.tepatWaktu}
              </p>
            </div>

            {/* Terlambat */}
            <div className="bg-slate-900 border border-amber-950/80 rounded-2xl p-3 shadow-xs">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Terlambat
              </p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {gateStats.terlambat}
              </p>
            </div>
          </div>

          {/* Verification Card with 2.5s Auto-Dismiss */}
          <div className="flex-1 min-h-[300px]">
            <FaceVerificationPopup
              scanResult={activeScanResult}
              onDismiss={() => setActiveScanResult(null)}
              autoDismissMs={2500}
            />
          </div>

          {/* Recent Scans Feed (Top 10) */}
          <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-blue-400" />
              <span>Riwayat Pemindaian Terkini</span>
            </h3>

            {recentScans.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">
                Belum ada data scan tercatat pagi ini.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-100">
                        {item.studentName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {item.className} &bull; NIS: {item.nis}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase mb-0.5',
                          item.status === 'PULANG'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : item.isLate
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        )}
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

      {/* Manual Student Search & Confirmation Dialog (Tanpa Kartu) */}
      {showManualModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-enter-snappy"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Pencarian Siswa Tanpa Kartu
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cari berdasarkan Nama Siswa, NIS, atau NISN.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setSelectedStudentForConfirm(null);
                  setManualQuery('');
                }}
                className="p-2 text-slate-400 hover:text-white rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoFocus
                placeholder="Ketik nama atau NIS siswa..."
                value={manualQuery}
                onChange={(e) => {
                  setManualQuery(e.target.value);
                  setSelectedStudentForConfirm(null);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-h-[44px]"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                </div>
              )}
            </div>

            {/* Search Results List */}
            {!selectedStudentForConfirm && (
              <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-800 pr-1">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    {manualQuery.trim().length >= 2
                      ? 'Tidak ada siswa yang sesuai pencarian.'
                      : 'Ketik minimal 2 huruf untuk mencari data siswa.'}
                  </p>
                ) : (
                  searchResults.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudentForConfirm(student)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ring-1 ring-slate-600">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            student.fullName.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {student.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Kelas {student.className} &bull; NIS {student.nis}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                        Pilih
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Photo Confirmation Dialog */}
            {selectedStudentForConfirm && (
              <div className="p-4 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-3 animate-enter-snappy">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden ring-2 ring-blue-500">
                    {selectedStudentForConfirm.photoUrl ? (
                      <img
                        src={selectedStudentForConfirm.photoUrl}
                        alt={selectedStudentForConfirm.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      selectedStudentForConfirm.fullName.charAt(0)
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                      Konfirmasi Identitas Siswa
                    </span>
                    <h4 className="text-base font-bold text-white leading-tight mt-0.5">
                      {selectedStudentForConfirm.fullName}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Kelas {selectedStudentForConfirm.className} &bull; NIS {selectedStudentForConfirm.nis}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForConfirm(null)}
                    className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
                  >
                    Kembali ke Daftar
                  </button>
                  <button
                    type="button"
                    disabled={isManualSubmitting}
                    onClick={() => handleConfirmManualScan(selectedStudentForConfirm)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md min-h-[44px] flex items-center gap-1.5"
                  >
                    {isManualSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Konfirmasi Hadir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
