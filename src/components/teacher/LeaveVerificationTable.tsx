'use client';

import React, { useState, useTransition } from 'react';
import { LeaveType } from '@prisma/client';
import {
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  ExternalLink,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
} from '@/actions/leave';
import { formatIndoDate } from '@/lib/timezone';
import type { LeaveRequestWithDetails } from '@/types/database';

interface LeaveVerificationTableProps {
  requests: LeaveRequestWithDetails[];
  reviewerUserId: string;
  onActionComplete?: () => void;
}

export function LeaveVerificationTable({
  requests,
  reviewerUserId,
  onActionComplete,
}: LeaveVerificationTableProps) {
  const [items, setItems] = useState<LeaveRequestWithDetails[]>(requests);
  const [isPending, startTransition] = useTransition();

  // Rejection note modal state
  const [rejectModalItem, setRejectModalItem] = useState<LeaveRequestWithDetails | null>(
    null
  );
  const [rejectNote, setRejectNote] = useState('');

  // Image lightbox preview state
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  const handleApprove = (item: LeaveRequestWithDetails) => {
    startTransition(async () => {
      const res = await approveLeaveRequestAction(item.id, reviewerUserId);
      if (res.success) {
        toast.success(
          res.message || `Izin ananda ${item.student.fullName} berhasil disetujui.`
        );
        setItems((prev) => prev.filter((r) => r.id !== item.id));
        if (onActionComplete) onActionComplete();
      } else {
        toast.error(res.error || 'Gagal menyetujui izin.');
      }
    });
  };

  const handleConfirmReject = () => {
    if (!rejectModalItem) return;

    startTransition(async () => {
      const res = await rejectLeaveRequestAction(
        rejectModalItem.id,
        reviewerUserId,
        rejectNote.trim() || undefined
      );

      if (res.success) {
        toast.success(res.message || `Permohonan izin telah ditolak.`);
        setItems((prev) => prev.filter((r) => r.id !== rejectModalItem.id));
        setRejectModalItem(null);
        setRejectNote('');
        if (onActionComplete) onActionComplete();
      } else {
        toast.error(res.error || 'Gagal menolak izin.');
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
        <h3 className="text-base font-bold text-slate-800">
          Semua Permohonan Telah Ditinjau
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Tidak ada permohonan izin atau sakit yang tertunda untuk kelas Anda saat ini.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 text-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Kotak Masuk Verifikasi Izin Siswa
          </h3>
          <p className="text-xs text-slate-500">
            {items.length} permohonan menunggu persetujuan Wali Kelas
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const isSakit = item.leaveType === LeaveType.SAKIT;
          const startDateStr = formatIndoDate(item.startDate);
          const endDateStr = formatIndoDate(item.endDate);
          const isSameDay = startDateStr === endDateStr;

          return (
            <div
              key={item.id}
              className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-slate-300"
            >
              {/* Left Column: Student & Leave Metadata */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isSakit
                        ? 'bg-violet-100 text-violet-800 border border-violet-200'
                        : 'bg-sky-100 text-sky-800 border border-sky-200'
                    }`}
                  >
                    <span>{isSakit ? '🏥 Sakit' : '📝 Izin'}</span>
                  </span>

                  <h4 className="font-bold text-sm sm:text-base text-slate-900">
                    {item.student.fullName}
                  </h4>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                    {item.student.class.className}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    NIS: {item.student.nis}
                  </span>
                </div>

                {/* Date range */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {isSameDay ? startDateStr : `${startDateStr} s.d. ${endDateStr}`}
                  </span>
                </div>

                {/* Reason description */}
                <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <strong>Alasan:</strong> {item.reason}
                </p>

                {/* Parent Contact & Attachment */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    Diajukan oleh:{' '}
                    <strong className="text-slate-700">{item.parent.fullName}</strong>
                  </span>
                  {item.attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachmentUrl(item.attachmentUrl)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lihat Lampiran Bukti</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Review Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleApprove(item)}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white text-xs font-bold rounded-lg shadow-xs transition-all disabled:opacity-50 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui</span>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setRejectModalItem(item);
                    setRejectNote('');
                  }}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-[0.97] text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition-all disabled:opacity-50 min-h-[44px]"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tolak</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Modal with feedback notes */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Tolak Permohonan Izin: {rejectModalItem.student.fullName}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Berikan alasan penolakan agar orang tua siswa mendapatkan penjelasan yang jelas.
            </p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Contoh: Dokumen surat dokter tidak terbaca dengan jelas / Jadwal ujian wajib hadir..."
              className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-sm bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Image Preview Modal */}
      {previewAttachmentUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setPreviewAttachmentUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900">
                Bukti Lampiran Izin / Surat Dokter
              </h4>
              <button
                type="button"
                onClick={() => setPreviewAttachmentUrl(null)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-100 rounded"
              >
                Tutup (ESC)
              </button>
            </div>
            <div className="w-full h-96 bg-slate-100 rounded-xl overflow-auto flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewAttachmentUrl}
                alt="Lampiran Surat Izin"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
