'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  SubjectStatus,
  EngagementBadge,
  AssessmentCategory,
  DocVisibility,
} from '@prisma/client';
import {
  Calendar,
  BookOpen,
  User,
  Clock,
  Layers,
  Sparkles,
  Save,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { BadgeSelector } from '@/components/grading/BadgeSelector';
import { KkmIndicator } from '@/components/grading/KkmIndicator';
import { PhotoUploader, PreparedPhotoItem } from '@/components/documentation/PhotoUploader';
import { PhotoPreviewGallery } from '@/components/documentation/PhotoPreviewGallery';
import { createJournalAction, updateJournalAction, lockJournalAction } from '@/actions/journal';
import { cn } from '@/lib/utils';
import { clampScore } from '@/lib/grading';

export interface ClassOption {
  id: string;
  className: string;
  gradeLevel: number;
}

export interface SubjectOption {
  id: string;
  subjectName: string;
  subjectCode: string;
  kkmScore: number;
}

export interface TeacherOption {
  id: string;
  fullName: string;
}

export interface StudentOption {
  id: string;
  fullName: string;
  nis: string;
  classId: string;
}

export interface StudentAttendanceRow {
  studentId: string;
  fullName: string;
  nis: string;
  status: SubjectStatus;
  engagementBadge: EngagementBadge;
  note: string;
}

export interface TeacherJournalFormProps {
  mode: 'create' | 'edit';
  journalId?: string;
  isLocked?: boolean;
  classes: ClassOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  students: StudentOption[];
  initialHeader?: {
    classId: string;
    subjectId: string;
    teacherId: string;
    journalDate: string;
    meetingNo: number;
    periodStart: number;
    periodEnd: number;
    topicMaterial: string;
    teacherNotes: string;
  };
  initialAttendances?: {
    studentId: string;
    status: SubjectStatus;
    engagementBadge: EngagementBadge;
    note: string | null;
  }[];
  initialPhotos?: PreparedPhotoItem[];
  initialAssessment?: {
    id?: string;
    title: string;
    category: AssessmentCategory;
    maxScore: number;
    grades: {
      studentId: string;
      score: number;
      teacherFeedback?: string | null;
    }[];
  } | null;
}

export function TeacherJournalForm({
  mode,
  journalId,
  isLocked = false,
  classes,
  subjects,
  teachers,
  students,
  initialHeader,
  initialAttendances,
  initialPhotos = [],
  initialAssessment,
}: TeacherJournalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Header State
  const [classId, setClassId] = useState(
    initialHeader?.classId || classes[0]?.id || ''
  );
  const [subjectId, setSubjectId] = useState(
    initialHeader?.subjectId || subjects[0]?.id || ''
  );
  const [teacherId, setTeacherId] = useState(
    initialHeader?.teacherId || teachers[0]?.id || ''
  );
  const [journalDate, setJournalDate] = useState(
    initialHeader?.journalDate || new Date().toISOString().split('T')[0]
  );
  const [meetingNo, setMeetingNo] = useState(initialHeader?.meetingNo || 1);
  const [periodStart, setPeriodStart] = useState(initialHeader?.periodStart || 1);
  const [periodEnd, setPeriodEnd] = useState(initialHeader?.periodEnd || 2);
  const [topicMaterial, setTopicMaterial] = useState(
    initialHeader?.topicMaterial || ''
  );
  const [teacherNotes, setTeacherNotes] = useState(
    initialHeader?.teacherNotes || ''
  );

  // Active Subject KKM
  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === subjectId) || subjects[0];
  }, [subjects, subjectId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === classId);
  }, [students, classId]);

  // Attendance Map
  const [attendances, setAttendances] = useState<StudentAttendanceRow[]>(() => {
    const existingMap = new Map<string, NonNullable<typeof initialAttendances>[number]>();
    if (initialAttendances) {
      for (const a of initialAttendances) {
        existingMap.set(a.studentId, a);
      }
    }

    return classStudents.map((st) => {
      const recorded = existingMap.get(st.id);
      return {
        studentId: st.id,
        fullName: st.fullName,
        nis: st.nis,
        status: recorded?.status || SubjectStatus.HADIR,
        engagementBadge: recorded?.engagementBadge || EngagementBadge.GOOD,
        note: recorded?.note || '',
      };
    });
  });

  // Re-sync attendance roster if class selection changes in create mode
  useEffect(() => {
    if (mode === 'create') {
      setAttendances(
        classStudents.map((st) => ({
          studentId: st.id,
          fullName: st.fullName,
          nis: st.nis,
          status: SubjectStatus.HADIR,
          engagementBadge: EngagementBadge.GOOD,
          note: '',
        }))
      );
    }
  }, [classId, classStudents, mode]);

  // Documentation Photos
  const [photos, setPhotos] = useState<PreparedPhotoItem[]>(initialPhotos);

  // Formal Assessment Accordion State
  const [showAssessment, setShowAssessment] = useState(Boolean(initialAssessment));
  const [assessmentTitle, setAssessmentTitle] = useState(
    initialAssessment?.title || ''
  );
  const [assessmentCategory, setAssessmentCategory] = useState<AssessmentCategory>(
    initialAssessment?.category || AssessmentCategory.TUGAS
  );
  const [maxScore, setMaxScore] = useState(initialAssessment?.maxScore || 100);
  const [assessmentGrades, setAssessmentGrades] = useState<
    Record<string, { score: number | null; feedback: string }>
  >(() => {
    const map: Record<string, { score: number | null; feedback: string }> = {};
    if (initialAssessment?.grades) {
      for (const g of initialAssessment.grades) {
        map[g.studentId] = {
          score: g.score,
          feedback: g.teacherFeedback || '',
        };
      }
    }
    return map;
  });

  // UI Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteStudentId, setActiveNoteStudentId] = useState<string | null>(null);
  const [confirmLockModal, setConfirmLockModal] = useState(false);

  // Stats calculation
  const attendanceStats = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    for (const a of attendances) {
      if (a.status === SubjectStatus.HADIR) hadir++;
      else if (a.status === SubjectStatus.SAKIT) sakit++;
      else if (a.status === SubjectStatus.IZIN) izin++;
      else if (a.status === SubjectStatus.ALPA_BOLOS) alpa++;
    }
    return { hadir, sakit, izin, alpa, total: attendances.length };
  }, [attendances]);

  // Filtered rows for search
  const filteredAttendances = useMemo(() => {
    if (!searchQuery.trim()) return attendances;
    const q = searchQuery.toLowerCase();
    return attendances.filter(
      (a) => a.fullName.toLowerCase().includes(q) || a.nis.includes(q)
    );
  }, [attendances, searchQuery]);

  // Quick Action: Mark All Present
  const handleMarkAllHadir = () => {
    if (isLocked) return;
    setAttendances((prev) =>
      prev.map((a) =>
        a.status === SubjectStatus.SAKIT || a.status === SubjectStatus.IZIN
          ? a
          : { ...a, status: SubjectStatus.HADIR }
      )
    );
    toast.success('Semua siswa ditandai Hadir.');
  };

  // Submit Handler (Draft or Lock)
  const executeSave = (lockOnSave: boolean) => {
    if (!topicMaterial.trim() || topicMaterial.trim().length < 3) {
      toast.error('Topik pembelajaran wajib diisi minimal 3 karakter.');
      return;
    }

    if (attendances.length === 0) {
      toast.error('Daftar siswa dalam kelas tidak boleh kosong.');
      return;
    }

    startTransition(async () => {
      // Build Assessment payload if active
      let assessmentPayload = undefined;
      if (showAssessment && assessmentTitle.trim()) {
        const gradesList = Object.entries(assessmentGrades)
          .filter(([_, data]) => data.score !== null && !isNaN(data.score))
          .map(([stId, data]) => ({
            studentId: stId,
            score: data.score as number,
            teacherFeedback: data.feedback.trim() || undefined,
          }));

        assessmentPayload = {
          title: assessmentTitle.trim(),
          category: assessmentCategory,
          maxScore,
          grades: gradesList,
        };
      }

      // Documentation payload
      const docsPayload = photos.map((p) => ({
        imageUrl: p.base64,
        caption: p.caption.trim() || undefined,
        visibility: p.visibility,
        taggedStudentIds: p.taggedStudentIds,
        fileSizeKb: p.compressedSizeKb,
      }));

      // Base input
      const payload = {
        classId,
        subjectId,
        teacherId,
        journalDate,
        meetingNo,
        periodStart,
        periodEnd,
        topicMaterial: topicMaterial.trim(),
        teacherNotes: teacherNotes.trim() || undefined,
        isLocked: lockOnSave,
        attendances: attendances.map((a) => ({
          studentId: a.studentId,
          status: a.status,
          engagementBadge: a.engagementBadge,
          note: a.note.trim() || undefined,
        })),
        documentations: docsPayload,
        assessment: assessmentPayload,
      };

      let res;
      if (mode === 'create') {
        res = await createJournalAction(payload);
      } else {
        res = await updateJournalAction({
          ...payload,
          journalId: journalId as string,
        });
      }

      if (res.success) {
        toast.success(res.message || 'Jurnal mengajar berhasil disimpan.');
        setConfirmLockModal(false);
        router.push(`/teacher/dashboard`);
        router.refresh();
      } else {
        toast.error(res.error || 'Gagal menyimpan jurnal mengajar.');
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto pb-32 space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 active:scale-[0.97] transition-all min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Jadwal</span>
        </button>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-amber-800 bg-amber-100 rounded-full border border-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>Jurnal Terkunci & Terpublikasi</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-50 rounded-full border border-blue-200">
              <span>Draf Sesi Mengajar</span>
            </span>
          )}
        </div>
      </div>

      {/* SECTION 0: Meeting Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-base sm:text-lg text-slate-900">
            {mode === 'create' ? 'Buat Jurnal Mengajar Baru' : 'Edit Jurnal Mengajar'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs sm:text-sm">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kelas Rombel
            </label>
            <select
              disabled={isLocked || mode === 'edit'}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} (Tingkat {c.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Subject Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mata Pelajaran (KKM)
            </label>
            <select
              disabled={isLocked}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subjectName} (KKM: {s.kkmScore})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tanggal Pelajaran
            </label>
            <input
              type="date"
              disabled={isLocked}
              value={journalDate}
              onChange={(e) => setJournalDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          {/* Pertemuan Ke-N & Period */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pertemuan Ke-
              </label>
              <input
                type="number"
                min={1}
                disabled={isLocked}
                value={meetingNo}
                onChange={(e) => setMeetingNo(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jam Ke-
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={12}
                  disabled={isLocked}
                  value={periodStart}
                  onChange={(e) => setPeriodStart(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  disabled={isLocked}
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(parseInt(e.target.value, 10) || 2)}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Topic Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Topik / Materi Pembelajaran <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isLocked}
            maxLength={255}
            value={topicMaterial}
            onChange={(e) => setTopicMaterial(e.target.value)}
            placeholder="Contoh: Bab 3 - Persamaan Linier Dua Variabel & Metode Eliminasi"
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
        </div>

        {/* Teacher Reflection Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Guru / Ringkasan Aktivitas (Opsional)
          </label>
          <textarea
            rows={2}
            disabled={isLocked}
            value={teacherNotes}
            onChange={(e) => setTeacherNotes(e.target.value)}
            placeholder="Catatan perkembangan kelas, materi latihan, siswa yang memerlukan penguatan, atau PR..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* SECTION 1: Attendance & Tier 1 Engagement Badges */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Presensi Siswa & Keaktifan Harian (Tier 1)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Default: Hadir & Mengikuti dengan Baik (✅). Cukup tap 1 kali untuk menandai keaktifan atau ketidakhadiran.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && (
              <button
                type="button"
                onClick={handleMarkAllHadir}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] rounded-lg border border-slate-300 transition-all min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Semua Hadir</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-emerald-700 block">Hadir</span>
            <span className="font-mono font-bold text-emerald-900 text-sm">
              {attendanceStats.hadir} / {attendanceStats.total} Siswa
            </span>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
            <span className="text-blue-700 block">Sakit</span>
            <span className="font-mono font-bold text-blue-900 text-sm">
              {attendanceStats.sakit} Siswa
            </span>
          </div>
          <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
            <span className="text-indigo-700 block">Izin</span>
            <span className="font-mono font-bold text-indigo-900 text-sm">
              {attendanceStats.izin} Siswa
            </span>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            <span className="text-rose-700 block">Alpa / Bolos</span>
            <span className="font-mono font-bold text-rose-900 text-sm">
              {attendanceStats.alpa} Siswa
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa dalam kelas..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
        </div>

        {/* Student Roster List */}
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {filteredAttendances.map((student, idx) => {
            const actualIdx = attendances.findIndex((a) => a.studentId === student.studentId);
            const isHadir = student.status === SubjectStatus.HADIR;

            return (
              <div
                key={student.studentId}
                className={cn(
                  'p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors',
                  student.status === SubjectStatus.ALPA_BOLOS
                    ? 'bg-rose-50/40'
                    : 'hover:bg-slate-50/70'
                )}
              >
                {/* Student Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <span className="font-mono text-xs text-slate-400 w-6 text-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                      {student.fullName}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      NIS: {student.nis}
                    </span>
                  </div>
                </div>

                {/* Status Toggles */}
                <div className="flex items-center gap-1">
                  {[
                    { value: SubjectStatus.HADIR, label: 'Hadir', activeClass: 'bg-emerald-600 text-white' },
                    { value: SubjectStatus.SAKIT, label: 'Sakit', activeClass: 'bg-blue-600 text-white' },
                    { value: SubjectStatus.IZIN, label: 'Izin', activeClass: 'bg-indigo-600 text-white' },
                    { value: SubjectStatus.ALPA_BOLOS, label: 'Alpa/Bolos', activeClass: 'bg-rose-600 text-white' },
                  ].map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        const updated = [...attendances];
                        updated[actualIdx] = { ...updated[actualIdx], status: st.value };
                        setAttendances(updated);
                      }}
                      className={cn(
                        'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all active:scale-[0.97] min-h-[36px]',
                        student.status === st.value
                          ? `${st.activeClass} border-transparent shadow-2xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Tier 1 Engagement Badges (only visible if Hadir) */}
                <div className="flex items-center gap-2">
                  {isHadir ? (
                    <BadgeSelector
                      size="sm"
                      disabled={isLocked}
                      value={student.engagementBadge}
                      onChange={(badge) => {
                        const updated = [...attendances];
                        updated[actualIdx] = {
                          ...updated[actualIdx],
                          engagementBadge: badge,
                        };
                        setAttendances(updated);
                      }}
                    />
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Tidak hadir di kelas
                    </span>
                  )}

                  {/* Individual Note Trigger */}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      setActiveNoteStudentId(
                        activeNoteStudentId === student.studentId ? null : student.studentId
                      )
                    }
                    className="text-xs text-slate-500 hover:text-blue-600 underline px-1 py-0.5 active:scale-95"
                  >
                    {student.note ? 'Edit Catatan' : '+ Catatan'}
                  </button>
                </div>

                {/* Expanded Student Note Input */}
                {activeNoteStudentId === student.studentId && (
                  <div className="w-full pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      disabled={isLocked}
                      maxLength={255}
                      value={student.note}
                      onChange={(e) => {
                        const updated = [...attendances];
                        updated[actualIdx] = { ...updated[actualIdx], note: e.target.value };
                        setAttendances(updated);
                      }}
                      placeholder={`Catatan khusus untuk ${student.fullName} (misal: aktif maju presentasi)`}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[38px]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Classroom Photo Documentation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Dokumentasi Foto Belajar (Otomatis WebP &le;180 KB)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ambil langsung dari kamera ponsel atau pilih dari galeri. Otomatis terkompresi 95%+ hemat kuota.
            </p>
          </div>
        </div>

        {!isLocked && (
          <PhotoUploader
            photos={photos}
            onChange={setPhotos}
            maxPhotos={5}
            disabled={isLocked}
          />
        )}

        <PhotoPreviewGallery
          photos={photos}
          onChange={setPhotos}
          availableStudents={classStudents}
          readOnly={isLocked}
        />
      </div>

      {/* SECTION 3: Formal Assessment Linking (Tier 2 Grading - Optional Accordion) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowAssessment(!showAssessment)}
          className="w-full p-4 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              T2
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Nilai Formal / Asesmen Sesi Ini (Opsional)
              </h3>
              <p className="text-xs text-slate-500">
                {showAssessment
                  ? 'Input nilai angka (0-100) untuk Tugas, Kuis, atau Ulangan Harian.'
                  : 'Klik untuk membuka formulir input nilai jika ada asesmen formal hari ini.'}
              </p>
            </div>
          </div>
          {showAssessment ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showAssessment && (
          <div className="p-4 sm:p-6 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Penilaian
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  maxLength={120}
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  placeholder="Contoh: Kuis 1 - Pemfaktoran Aljabar"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Asesmen
                </label>
                <select
                  disabled={isLocked}
                  value={assessmentCategory}
                  onChange={(e) =>
                    setAssessmentCategory(e.target.value as AssessmentCategory)
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  <option value={AssessmentCategory.TUGAS}>Tugas Harian (Formatif)</option>
                  <option value={AssessmentCategory.KUIS}>Kuis Cepat (Formatif)</option>
                  <option value={AssessmentCategory.PRAKTIKUM}>Praktikum / Unjuk Kerja</option>
                  <option value={AssessmentCategory.UH}>Ulangan Harian (Sumatif TP)</option>
                  <option value={AssessmentCategory.PTS}>Penilaian Tengah Semester</option>
                  <option value={AssessmentCategory.PAS}>Penilaian Akhir Semester</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skor Maksimal & KKM
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    disabled={isLocked}
                    value={maxScore}
                    onChange={(e) => setMaxScore(parseInt(e.target.value, 10) || 100)}
                    className="w-24 px-3 py-2 font-mono text-center text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg min-h-[44px]"
                  />
                  <span className="text-xs text-slate-500 font-mono">
                    KKM: <strong>{activeSubject.kkmScore}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Score Entry Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3 w-32">Nilai (0-100)</th>
                    <th className="py-2.5 px-3 w-36">Status KKM</th>
                    <th className="py-2.5 px-3">Catatan / Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((st, renderedIdx) => {
                    const gradeData = assessmentGrades[st.id] || { score: null, feedback: '' };

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {renderedIdx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{st.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">NIS: {st.nis}</div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={isLocked}
                            value={gradeData.score !== null ? gradeData.score : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(',', '.');
                              const num = parseFloat(raw);
                              const newScore = isNaN(num) ? null : clampScore(num, 0, maxScore);
                              setAssessmentGrades((prev) => ({
                                ...prev,
                                [st.id]: { ...gradeData, score: newScore },
                              }));
                            }}
                            placeholder="0-100"
                            className="w-full px-2 py-1.5 font-mono text-center font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <KkmIndicator
                            score={gradeData.score}
                            kkm={activeSubject.kkmScore}
                            showDelta={true}
                            showLabel={true}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={isLocked}
                            maxLength={255}
                            value={gradeData.feedback}
                            onChange={(e) => {
                              setAssessmentGrades((prev) => ({
                                ...prev,
                                [st.id]: { ...gradeData, feedback: e.target.value },
                              }));
                            }}
                            placeholder="Feedback guru..."
                            className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-600 hidden sm:inline">
              Hadir: <strong>{attendanceStats.hadir}</strong> • Foto: <strong>{photos.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => executeSave(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] rounded-lg border border-slate-300 transition-all min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>{isPending ? 'Menyimpan...' : 'Simpan Draf'}</span>
              </button>
            )}

            {!isLocked && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmLockModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.97] rounded-lg shadow-sm transition-all min-h-[44px]"
              >
                <Lock className="w-4 h-4" />
                <span>Kunci & Publikasikan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal before Locking */}
      {confirmLockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-900">
                Konfirmasi Kunci & Publikasi Jurnal
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Setelah dikunci, jurnal mengajar akan langsung dipublikasikan ke linimasa orang tua siswa, dan presensi/nilai tidak dapat diedit kembali oleh guru reguler.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>Topik: <strong>{topicMaterial}</strong></div>
              <div>Hadir: <strong>{attendanceStats.hadir}</strong> • Alpa/Bolos: <strong>{attendanceStats.alpa}</strong></div>
              <div>Foto Dokumentasi: <strong>{photos.length} Foto</strong></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmLockModal(false)}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => executeSave(true)}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm min-h-[44px] active:scale-[0.97] transition-all"
              >
                {isPending ? 'Mengunci...' : 'Ya, Kunci & Publikasikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
