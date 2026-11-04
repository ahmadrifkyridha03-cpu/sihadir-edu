'use client';

import React, { useState, useTransition } from 'react';
import { LeaveType } from '@prisma/client';
import { Calendar, FileText, Upload, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { submitLeaveRequestAction } from '@/actions/leave';

interface LeaveRequestFormProps {
  parentId: string;
  studentId: string;
  studentName: string;
  className: string;
  onSuccess?: () => void;
}

export function LeaveRequestForm({
  parentId,
  studentId,
  studentName,
  className,
  onSuccess,
}: LeaveRequestFormProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.SAKIT);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  // Compute duration in days
  const durationDays = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const requiresDoctorNote = leaveType === LeaveType.SAKIT && durationDays > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.error('Pilih tanggal mulai dan tanggal selesai izin.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }

    if (reason.trim().length < 5) {
      toast.error('Alasan izin minimal 5 karakter.');
      return;
    }

    if (requiresDoctorNote && (!attachmentUrl || attachmentUrl.trim().length === 0)) {
      toast.error('Untuk izin sakit lebih dari 1 hari, wajib menyertakan bukti Surat Dokter.');
      return;
    }

    startTransition(async () => {
      const res = await submitLeaveRequestAction({
        studentId,
        parentId,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl: attachmentUrl.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message || 'Permohonan izin berhasil diajukan!');
        setReason('');
        setAttachmentUrl('');
        setStartDate('');
        setEndDate('');
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || 'Gagal mengajukan izin.');
      }
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-sm text-slate-900">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Formulir Permohonan Izin / Sakit
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Pengajuan izin ananda <strong className="text-slate-800">{studentName}</strong> ({className}) akan langsung diteruskan ke Wali Kelas untuk ditinjau.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Leave Type Selector (44px touch targets) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Jenis Permohonan
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLeaveType(LeaveType.SAKIT)}
              className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border font-bold text-sm transition-all active:scale-[0.97] ${
                leaveType === LeaveType.SAKIT
                  ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                  : 'bg-violet-50/50 border-violet-200 text-violet-800 hover:bg-violet-100'
              }`}
            >
              <span>🏥</span>
              <span>Sakit (S)</span>
            </button>
            <button
              type="button"
              onClick={() => setLeaveType(LeaveType.IZIN)}
              className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border font-bold text-sm transition-all active:scale-[0.97] ${
                leaveType === LeaveType.IZIN
                  ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                  : 'bg-sky-50/50 border-sky-200 text-sky-800 hover:bg-sky-100'
              }`}
            >
              <span>📝</span>
              <span>Izin Resmi (I)</span>
            </button>
          </div>
        </div>

        {/* 2. Date Range Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tanggal Mulai
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tanggal Selesai
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Duration badge */}
        {durationDays > 0 && (
          <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              Durasi izin: <strong>{durationDays} hari kalender</strong>
            </span>
          </div>
        )}

        {/* 3. Reason Textarea */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Alasan Ketidakhadiran (Minimal 5 karakter)
          </label>
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Mengalami demam tinggi dan flu berat sejak semalam, disarankan istirahat oleh dokter..."
            className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 4. Attachment (Doctor Note / Permit Letter) */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Foto Bukti Lampiran / Surat Dokter
            {requiresDoctorNote && (
              <span className="text-rose-600 font-bold ml-1">*Wajib (&gt;1 hari sakit)</span>
            )}
          </label>
          <div className="relative">
            <Upload className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/sihadir/... (URL Bukti Foto)"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          {requiresDoctorNote && (
            <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Sesuai aturan sekolah, izin sakit lebih dari 1 hari wajib menyertakan foto surat dokter.
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all min-h-[44px]"
        >
          <Send className="w-4 h-4" />
          <span>{isPending ? 'Mengirim Permohonan...' : 'Kirim Permohonan Izin'}</span>
        </button>
      </form>
    </div>
  );
}
