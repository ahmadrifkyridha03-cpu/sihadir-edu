'use client';

import React, { useState, useTransition, useMemo } from 'react';
import {
  SubjectStatus,
  EngagementBadge,
  Gender,
  GateStatus,
  LeaveType,
} from '@prisma/client';
import {
  CheckCheck,
  RotateCcw,
  Search,
  AlertTriangle,
  Clock,
  FileText,
  Save,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveSubjectAttendanceAction } from '@/actions/attendance';
import type {
  EnrichedStudentAttendanceItem,
  ClassroomRosterPayload,
} from '@/lib/attendance';

interface ClassroomAttendanceRosterProps {
  initialData: ClassroomRosterPayload;
  onSaveSuccess?: () => void;
}

export function ClassroomAttendanceRoster({
  initialData,
  onSaveSuccess,
}: ClassroomAttendanceRosterProps) {
  // Local state for all student records
  const [students, setStudents] = useState<EnrichedStudentAttendanceItem[]>(
    initialData.students
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | SubjectStatus>('ALL');
  const [isPending, startTransition] = useTransition();
  const [activeNoteModalStudent, setActiveNoteModalStudent] = useState<string | null>(null);

  // Live Summary Calculation
  const stats = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpaBolos = 0;
    let potentialBolos = 0;

    for (const s of students) {
      if (s.subjectStatus === SubjectStatus.HADIR) hadir++;
      else if (s.subjectStatus === SubjectStatus.SAKIT) sakit++;
      else if (s.subjectStatus === SubjectStatus.IZIN) izin++;
      else if (s.subjectStatus === SubjectStatus.ALPA_BOLOS) {
        alpaBolos++;
        if (s.gateStatus === GateStatus.HADIR || s.gateStatus === GateStatus.TERLAMBAT) {
          potentialBolos++;
        }
      }
    }
    return { hadir, sakit, izin, alpaBolos, potentialBolos };
  }, [students]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.nis.includes(searchQuery);

      if (!matchesSearch) return false;
      if (activeFilter === 'ALL') return true;
      return student.subjectStatus === activeFilter;
    });
  }, [students, searchQuery, activeFilter]);

  // Status Change Handler
  const handleStatusChange = (studentId: string, newStatus: SubjectStatus) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        const isPotentialBolos =
          (s.gateStatus === GateStatus.HADIR || s.gateStatus === GateStatus.TERLAMBAT) &&
          newStatus === SubjectStatus.ALPA_BOLOS;
        return {
          ...s,
          subjectStatus: newStatus,
          isPotentialBolos,
        };
      })
    );
  };

  // Engagement Badge Change Handler
  const handleBadgeChange = (studentId: string, badge: EngagementBadge) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, engagementBadge: badge } : s))
    );
  };

  // Note Change Handler
  const handleNoteChange = (studentId: string, note: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, note: note || null } : s))
    );
  };

  // Batch Action: Mark All Present (preserves approved leaves)
  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.hasApprovedLeave) return s;
        return {
          ...s,
          subjectStatus: SubjectStatus.HADIR,
          isPotentialBolos: false,
        };
      })
    );
    toast.success('Semua siswa (kecuali yang izin/sakit) ditandai Hadir.');
  };

  // Batch Action: Reset to Gate Pre-fill
  const handleResetToGate = () => {
    setStudents(initialData.students);
    toast.info('Data presensi di-reset ke rekap gerbang pagi.');
  };

  // Save Mutation
  const handleSave = () => {
    startTransition(async () => {
      const attendances = students.map((s) => ({
        studentId: s.studentId,
        status: s.subjectStatus,
        engagementBadge: s.engagementBadge,
        note: s.note || undefined,
      }));

      const res = await saveSubjectAttendanceAction({
        journalId: initialData.journalId,
        classId: initialData.classId,
        attendances,
      });

      if (res.success) {
        if (res.data.bolosIncidents && res.data.bolosIncidents.length > 0) {
          toast.warning(
            `Presensi tersimpan! Terdeteksi ${res.data.bolosIncidents.length} siswa bolos: ${res.data.bolosIncidents.map((b) => b.fullName).join(', ')}`,
            { duration: 6000 }
          );
        } else {
          toast.success('Presensi kelas berhasil disimpan!');
        }
        if (onSaveSuccess) onSaveSuccess();
      } else {
        toast.error(`Gagal menyimpan: ${res.error}`);
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24 text-slate-900">
      {/* 1. Header Information & Sticky Summary Banner */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm p-3 sm:p-4 rounded-b-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Presensi Kelas: {initialData.className}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {initialData.subjectName} • Jam ke-{initialData.periodStart}-{initialData.periodEnd} • {initialData.totalStudents} Siswa
            </p>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? 'Menyimpan...' : 'Simpan Presensi'}</span>
          </button>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === SubjectStatus.HADIR ? 'ALL' : SubjectStatus.HADIR)}
            className={`py-1.5 rounded-lg border transition-all ${
              activeFilter === SubjectStatus.HADIR
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Hadir: <span className="text-sm font-bold">{stats.hadir}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === SubjectStatus.SAKIT ? 'ALL' : SubjectStatus.SAKIT)}
            className={`py-1.5 rounded-lg border transition-all ${
              activeFilter === SubjectStatus.SAKIT
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100'
            }`}
          >
            Sakit: <span className="text-sm font-bold">{stats.sakit}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === SubjectStatus.IZIN ? 'ALL' : SubjectStatus.IZIN)}
            className={`py-1.5 rounded-lg border transition-all ${
              activeFilter === SubjectStatus.IZIN
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
            }`}
          >
            Izin: <span className="text-sm font-bold">{stats.izin}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === SubjectStatus.ALPA_BOLOS ? 'ALL' : SubjectStatus.ALPA_BOLOS)}
            className={`py-1.5 rounded-lg border transition-all ${
              activeFilter === SubjectStatus.ALPA_BOLOS
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            Alpa/Bolos: <span className="text-sm font-bold">{stats.alpaBolos}</span>
          </button>
        </div>

        {/* Bolos Anomaly Alert Banner */}
        {stats.potentialBolos > 0 && (
          <div className="mt-2.5 flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-300 rounded-lg text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p>
              <strong>Peringatan Bolos ({stats.potentialBolos} Siswa):</strong> Ada siswa tercatat hadir di gerbang pagi namun ditandai Alpa di jam pelajaran ini.
            </p>
          </div>
        )}
      </div>

      {/* 2. Fast Batch Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row gap-2 px-2 sm:px-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIS siswa..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.97] text-emerald-800 text-xs font-semibold border border-emerald-300 rounded-lg transition-transform min-h-[44px]"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>Semua Hadir</span>
          </button>
          <button
            type="button"
            onClick={handleResetToGate}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] text-slate-700 text-xs font-medium border border-slate-300 rounded-lg transition-transform min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reset Gerbang</span>
          </button>
        </div>
      </div>

      {/* 3. Student Roster Cards List */}
      <div className="space-y-3 px-2 sm:px-0">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
            Tidak ada siswa yang cocok dengan filter atau pencarian.
          </div>
        ) : (
          filteredStudents.map((student, idx) => {
            const hasNote = Boolean(student.note);
            const isBolos = student.isPotentialBolos;

            return (
              <div
                key={student.studentId}
                className={`p-3 sm:p-4 rounded-xl border transition-all ${
                  isBolos
                    ? 'bg-rose-50/40 border-rose-300 shadow-rose-100 shadow-sm'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                {/* Row 1: Student Identity & Gate Metadata */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">
                      {idx + 1}.
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-slate-900 leading-snug">
                        {student.fullName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>NIS: {student.nis}</span>
                        <span>•</span>
                        <span>{student.gender === Gender.L ? 'Laki-laki' : 'Perempuan'}</span>

                        {/* Gate Scan Indicators */}
                        {student.isLate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                            <Clock className="w-3 h-3" />
                            Terlambat {student.lateMinutes}m
                          </span>
                        )}
                        {student.isUnscannedGate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            Belum Scan Gerbang
                          </span>
                        )}
                        {student.hasApprovedLeave && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded font-medium">
                            <FileText className="w-3 h-3" />
                            {student.leaveType === LeaveType.SAKIT ? 'Surat Sakit' : 'Surat Izin'}
                          </span>
                        )}
                        {isBolos && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold uppercase tracking-wider animate-pulse">
                            ⚠️ Anomali Bolos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setActiveNoteModalStudent(student.studentId)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-transform active:scale-[0.97] min-h-[36px] ${
                      hasNote
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {hasNote ? 'Edit Catatan' : '+ Catatan'}
                    </span>
                  </button>
                </div>

                {/* Row 2: 4-Button Attendance Toggles (44px touch targets) */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
                  {/* Hadir Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.studentId, SubjectStatus.HADIR)}
                    className={`min-h-[44px] flex items-center justify-center font-bold text-xs sm:text-sm rounded-lg border active:scale-[0.97] transition-all ${
                      student.subjectStatus === SubjectStatus.HADIR
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50/40 border-emerald-200 text-emerald-800 hover:bg-emerald-100/50'
                    }`}
                  >
                    Hadir
                  </button>

                  {/* Sakit Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.studentId, SubjectStatus.SAKIT)}
                    className={`min-h-[44px] flex items-center justify-center font-bold text-xs sm:text-sm rounded-lg border active:scale-[0.97] transition-all ${
                      student.subjectStatus === SubjectStatus.SAKIT
                        ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
                        : 'bg-violet-50/40 border-violet-200 text-violet-800 hover:bg-violet-100/50'
                    }`}
                  >
                    Sakit
                  </button>

                  {/* Izin Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.studentId, SubjectStatus.IZIN)}
                    className={`min-h-[44px] flex items-center justify-center font-bold text-xs sm:text-sm rounded-lg border active:scale-[0.97] transition-all ${
                      student.subjectStatus === SubjectStatus.IZIN
                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                        : 'bg-sky-50/40 border-sky-200 text-sky-800 hover:bg-sky-100/50'
                    }`}
                  >
                    Izin
                  </button>

                  {/* Alpa / Bolos Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.studentId, SubjectStatus.ALPA_BOLOS)}
                    className={`min-h-[44px] flex items-center justify-center font-bold text-xs sm:text-sm rounded-lg border active:scale-[0.97] transition-all ${
                      student.subjectStatus === SubjectStatus.ALPA_BOLOS
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-rose-50/40 border-rose-200 text-rose-800 hover:bg-rose-100/50'
                    }`}
                  >
                    Bolos/A
                  </button>
                </div>

                {/* Row 3: Tier 1 Daily Engagement Badges (1 Tap) */}
                {student.subjectStatus === SubjectStatus.HADIR && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">
                      Keaktifan:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBadgeChange(student.studentId, EngagementBadge.ACTIVE_STAR)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border active:scale-[0.97] transition-all min-h-[32px] ${
                        student.engagementBadge === EngagementBadge.ACTIVE_STAR
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>🌟</span>
                      <span>Aktif</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBadgeChange(student.studentId, EngagementBadge.GOOD)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border active:scale-[0.97] transition-all min-h-[32px] ${
                        student.engagementBadge === EngagementBadge.GOOD
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>✅</span>
                      <span>Baik</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBadgeChange(student.studentId, EngagementBadge.LESS_FOCUS)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border active:scale-[0.97] transition-all min-h-[32px] ${
                        student.engagementBadge === EngagementBadge.LESS_FOCUS
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>⚠️</span>
                      <span>Kurang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBadgeChange(student.studentId, EngagementBadge.NO_TASK)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border active:scale-[0.97] transition-all min-h-[32px] ${
                        student.engagementBadge === EngagementBadge.NO_TASK
                          ? 'bg-rose-100 border-rose-400 text-rose-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>❌</span>
                      <span>No Tugas</span>
                    </button>
                  </div>
                )}

                {/* Inline Note Preview if present */}
                {hasNote && (
                  <div className="mt-2 text-xs bg-blue-50 text-blue-900 p-2 rounded-lg border border-blue-200">
                    <strong>Catatan Guru:</strong> {student.note}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Quick Note Drawer / Modal */}
      {activeNoteModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Catatan Siswa: {students.find((s) => s.studentId === activeNoteModalStudent)?.fullName}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Catatan ini dapat dibaca oleh orang tua di linimasa belajar harian.
            </p>
            <textarea
              defaultValue={students.find((s) => s.studentId === activeNoteModalStudent)?.note || ''}
              id="student-note-input"
              rows={3}
              maxLength={255}
              placeholder="Contoh: Sangat antusias mengerjakan latihan aljabar di papan tulis..."
              className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveNoteModalStudent(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('student-note-input') as HTMLTextAreaElement;
                  handleNoteChange(activeNoteModalStudent, el.value.trim());
                  setActiveNoteModalStudent(null);
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
