'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Phone, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { parentLoginAction } from '@/actions/parent-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [showPin, setShowPin] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = React.useState<number | null>(null);
  const [isLocked, setIsLocked] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!phone.trim()) {
      setErrorMessage('Nomor WhatsApp wajib diisi.');
      return;
    }

    if (!pin.trim() || pin.length < 6) {
      setErrorMessage('PIN harus 6 digit angka.');
      return;
    }

    setLoading(true);
    try {
      const res = await parentLoginAction(phone, pin);
      if (res.success && res.redirectUrl) {
        toast.success('Login berhasil! Mengalihkan ke Beranda Orang Tua...');
        router.push(res.redirectUrl);
      } else {
        setErrorMessage(res.error || 'Login gagal.');
        if (typeof res.remainingAttempts === 'number') {
          setRemainingAttempts(res.remainingAttempts);
          if (res.remainingAttempts === 0) {
            setIsLocked(true);
          }
        }
        toast.error(res.error || 'Login gagal');
      }
    } catch {
      setErrorMessage('Terjadi gangguan jaringan. Silakan coba kembali.');
      toast.error('Gagal memproses login');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setPhone('081290000001');
    setPin('123456');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Institutional Header */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-900 text-white shadow-md mb-3">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          SiHadir-Edu
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Portal Informasi Absensi, Nilai & Pembelajaran Siswa
        </p>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Masuk Akun Orang Tua / Wali
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gunakan nomor WhatsApp terdaftar dan 6-digit PIN keamanan.
          </p>
        </div>

        {/* Error / Rate Limit Feedback Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-800"
          >
            <p className="font-semibold">{errorMessage}</p>
            {remainingAttempts !== null && remainingAttempts > 0 && !isLocked && (
              <p className="mt-1 text-rose-700">
                Sisa kesempatan: <strong>{remainingAttempts} kali</strong>.
              </p>
            )}
            {isLocked && (
              <p className="mt-1 text-rose-900 font-bold">
                Akun dikunci selama 15 menit untuk mencegah akses tidak sah.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone Field */}
          <div>
            <label
              htmlFor="phone-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nomor WhatsApp
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="phone-input"
                type="tel"
                inputMode="tel"
                disabled={loading || isLocked}
                placeholder="Contoh: 081290000001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Bisa diawali 08, 62, atau +62.
            </p>
          </div>

          {/* PIN Field */}
          <div>
            <label
              htmlFor="pin-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              PIN Keamanan (6 Digit Angka)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="pin-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                disabled={loading || isLocked}
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-10 pr-11 py-2.5 text-sm tracking-widest font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors min-w-[40px] justify-center"
                aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading || isLocked}
            className="w-full mt-2 font-semibold shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              <>
                Masuk ke Portal
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Demo Fast-fill button for testing */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 mb-2">Akun Contoh Pengujian (Hendra Supriyadi):</p>
          <button
            type="button"
            onClick={fillDemoAccount}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-lg transition-colors"
          >
            Isi Demo: 081290000001 (PIN: 123456)
          </button>
        </div>
      </Card>

      {/* Footer Info */}
      <p className="text-xs text-slate-400 mt-6 text-center">
        © 2026 SiHadir-Edu. Sistem Absensi & Penilaian Terpadu Sekolah.
      </p>
    </div>
  );
}
