'use client';

import * as React from 'react';
import { approveLeaveRequestAction, rejectLeaveRequestAction } from '@/actions/leave';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Bell,
  CheckCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
} from 'lucide-react';

interface PendingLeaveItem {
  id: string;
  studentName: string;
  studentNis: string;
  className: string;
  leaveType: string;
  startDateStr: string;
  endDateStr: string;
  reason: string;
  attachmentUrl: string | null;
}

interface HomeroomPendingLeavesProps {
  pendingLeaves: PendingLeaveItem[];
  homeroomClassName: string;
  reviewerUserId: string;
}

export function HomeroomPendingLeaves({
  pendingLeaves: initialLeaves,
  homeroomClassName,
  reviewerUserId,
}: HomeroomPendingLeavesProps) {
  const [leaves, setLeaves] = React.useState<PendingLeaveItem[]>(initialLeaves);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = React.useState<string | null>(null);

  if (leaves.length === 0) {
    return null;
  }

  const handleApprove = async (id: string, studentName: string) => {
    setProcessingId(id);
    try {
      const res = await approveLeaveRequestAction(id, reviewerUserId, 'Disetujui oleh Wali Kelas');
      if (res.success) {
        toast.success(`Permohonan izin ${studentName} berhasil disetujui`);
        setLeaves((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(res.error || 'Gagal menyetujui izin');
      }
    } catch {
      toast.error('Terjadi kesalahan saat memproses persetujuan');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, studentName: string) => {
    const reason = window.prompt(`Masukkan alasan penolakan izin untuk ${studentName}:`);
    if (reason === null) return; // User cancelled prompt

    setProcessingId(id);
    try {
      const res = await rejectLeaveRequestAction(id, reviewerUserId, reason || 'Ditolak');
      if (res.success) {
        toast.info(`Permohonan izin ${studentName} ditolak`);
        setLeaves((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(res.error || 'Gagal menolak izin');
      }
    } catch {
      toast.error('Terjadi kesalahan saat memproses penolakan');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="p-4 sm:p-5 bg-amber-50/50 border border-amber-200/90 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950">
              Permohonan Izin Menunggu Verifikasi (Wali Kelas {homeroomClassName})
            </h3>
            <p className="text-[11px] text-amber-800">
              Ada {leaves.length} permohonan izin dari orang tua yang memerlukan konfirmasi Anda.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {leaves.map((leave) => {
          const isBusy = processingId === leave.id;

          return (
            <div
              key={leave.id}
              className="p-3.5 rounded-xl bg-white border border-amber-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    status={leave.leaveType === 'SAKIT' ? 'sakit' : 'izin'}
                    size="sm"
                  >
                    {leave.leaveType}
                  </Badge>
                  <span className="text-xs font-bold text-slate-900">
                    {leave.studentName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (NIS {leave.studentNis})
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    • {leave.startDateStr === leave.endDateStr ? leave.startDateStr : `${leave.startDateStr} s/d ${leave.endDateStr}`}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  Alasan: &quot;{leave.reason}&quot;
                </p>

                {leave.attachmentUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachmentUrl(leave.attachmentUrl)}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Lihat Surat Dokter / Lampiran
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => handleReject(leave.id, leave.studentName)}
                  className="text-xs text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Tolak
                </Button>

                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => handleApprove(leave.id, leave.studentName)}
                  className="text-xs font-bold"
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Setujui
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox for Doctor Note Preview */}
      {previewAttachmentUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-enter-snappy"
        >
          <button
            type="button"
            onClick={() => setPreviewAttachmentUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Tutup lampiran"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewAttachmentUrl}
            alt="Lampiran surat izin"
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </Card>
  );
}
