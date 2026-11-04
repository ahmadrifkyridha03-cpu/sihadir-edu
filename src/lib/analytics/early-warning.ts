import { db } from '@/lib/db';
import {
  generateAttendanceMatrixRecap,
  type StudentAttendanceMatrixRow,
} from './recap-matrix';
import { getWibNow, normalizeDateOnly, formatIndoDate } from '@/lib/timezone';
import { formatWaMessage } from '@/lib/whatsapp';
import { EngagementBadge } from '@prisma/client';

export type EwsRiskLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface InvariantEvaluation {
  id: string; // 'INV_1_CONSECUTIVE_ALPA', etc.
  name: string;
  triggered: boolean;
  severity: EwsRiskLevel;
  points: number;
  description: string;
  details?: Record<string, unknown>;
}

export interface EwsCounselingSop {
  roleResponsible: 'WALI_KELAS' | 'GURU_BK' | 'TIM_DISIPLIN';
  primaryAction: string;
  steps: string[];
  officialDocumentRequired: string;
  suggestedWaTemplate: string;
  waPayload?: {
    template: string;
    variables: Record<string, string | number | undefined | null>;
  };
}

export interface StudentEwsEvaluation {
  studentId: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  classId: string;
  className: string;
  parentPhone?: string | null;
  parentName?: string | null;
  riskScore: number; // 0 - 100
  riskLevel: EwsRiskLevel;
  attendanceRate: number;
  invariants: InvariantEvaluation[];
  metrics: {
    consecutiveAlpaDays: number;
    consecutiveAlpaDates: string[];
    monthlyAlpaCount: number;
    totalAbsenceDays: number; // S + I + A + B
    lateArrivalCount: number;
    totalLateMinutes: number;
    bolosCount: number;
    remedialSubjectCount: number;
    remedialSubjects: Array<{ subjectName: string; score: number; kkm: number }>;
    negativeBadgeCount: number; // LESS_FOCUS + NO_TASK
  };
  counselingSop?: EwsCounselingSop;
}

export interface EwsClassSummaryResult {
  classId: string;
  className: string;
  periodLabel: string;
  evaluatedAt: string;
  totalStudents: number;
  counts: {
    critical: number;
    warning: number;
    normal: number;
  };
  students: StudentEwsEvaluation[];
}

export const TEMPLATE_EWS_CONSECUTIVE_ALPA = `{Assalamu'alaikum|Selamat Siang|Salam Sejahtera} Bapak/Ibu {{parent_name}},
Pemberitahuan Mendesak dari pihak sekolah {{school_name}}:

Kami menginformasikan bahwa ananda:
👤 Nama: *{{student_name}}* (Kelas {{class_name}})
⚠️ Status: *TIDAK HADIR (ALPA) selama {{consecutive_days}} hari berturut-turut* pada tanggal {{alpa_dates}}.

Mengingat pentingnya keselamatan dan kelanjutan proses belajar ananda, mohon segera menghubungi Wali Kelas Bpk/Ibu {{homeroom_name}} atau hadir ke sekolah untuk konfirmasi.

🔗 Pantau riwayat presensi ananda: {{portal_url}}
_{{school_name}}_`;

export const TEMPLATE_EWS_BOLOS = `🚨 *PERINGATAN KHUSUS KEDISIPLINAN SISWA* 🚨
{Assalamu'alaikum|Selamat Siang|Halo} Bapak/Ibu {{parent_name}},

Kami memberitahukan bahwa ananda *{{student_name}}* (Kelas {{class_name}}) tercatat meninggalkan jam pelajaran tanpa izin (*membolos*) sebanyak *{{bolos_count}} kali* pada bulan ini.

Pihak sekolah mengundang Bapak/Ibu untuk hadir berkonsultasi dengan Guru BK dan Wali Kelas:
📅 Hari/Tanggal: {{meeting_date}}
🕒 Pukul: 08:30 WIB
📍 Tempat: Ruang Bimbingan & Konseling (BK)

Mohon konfirmasi kehadiran Bapak/Ibu. Terima kasih.
_{{school_name}}_`;

export const TEMPLATE_EWS_LATENESS = `{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {{parent_name}},
Laporan Kedisiplinan Kehadiran Siswa:

Kami menginformasikan bahwa ananda *{{student_name}}* (Kelas {{class_name}}) telah tercatat *TERLAMBAT tiba di sekolah sebanyak {{late_count}} kali* pada bulan {{month_name}} (Total akumulasi keterlambatan: {{total_late_minutes}} menit).

Mohon bantuan Bapak/Ibu untuk memotivasi ananda agar berangkat lebih awal sebelum pukul 07:00 WIB agar tidak tertinggal materi pelajaran jam pertama. Terima kasih atas kerja samanya.
🔗 Portal Siswa: {{portal_url}}
_{{school_name}}_`;

export const TEMPLATE_EWS_ACADEMIC = `{Assalamu'alaikum|Selamat Sore|Halo} Bapak/Ibu {{parent_name}},
Laporan Capaian Belajar & Presensi Siswa:

Kami menginformasikan hasil evaluasi perkembangan ananda:
👤 Nama: *{{student_name}}* (Kelas {{class_name}})
📊 Tingkat Kehadiran: *{{attendance_rate}}%*
⚠️ Perhatian Akademik: Terdapat *{{remedial_count}} mata pelajaran* dengan nilai di bawah KKM ({{remedial_subjects_list}}).

Mohon kerja sama Bapak/Ibu untuk mendampingi ananda dalam program remedial terstruktur. Jadwal remedial dapat dipantau pada tautan:
🔗 {{portal_url}}
_{{school_name}}_`;

/**
 * Evaluates EWS risk for an entire class over a month or semester.
 */
export async function evaluateClassEarlyWarning(params: {
  classId: string;
  year?: number;
  month?: number;
  semester?: 1 | 2;
  schoolDaysPerWeek?: 5 | 6;
  today?: Date | string;
}): Promise<EwsClassSummaryResult> {
  const { classId } = params;
  const todayWib = params.today ? normalizeDateOnly(params.today) : getWibNow().wibDate;

  // 1. Fetch attendance recap matrix for this class
  const matrix = await generateAttendanceMatrixRecap({
    classId,
    periodType: 'MONTHLY',
    year: params.year,
    month: params.month,
    semester: params.semester,
    schoolDaysPerWeek: params.schoolDaysPerWeek,
    today: todayWib,
  });

  const studentIds = matrix.students.map((s) => s.studentId);
  const startDate = normalizeDateOnly(matrix.period.startDate);
  const endDate = normalizeDateOnly(matrix.period.endDate);

  // 2. Batch Fetch Student Grades and Assessments to evaluate Invariant 5
  const studentGrades = await db.studentGrade.findMany({
    where: {
      studentId: { in: studentIds },
      assessment: {
        classId,
        assessmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      assessment: {
        include: { subject: true },
      },
    },
  });

  // 3. Batch Fetch Negative Badges in SubjectAttendances
  const negativeBadges = await db.subjectAttendance.findMany({
    where: {
      studentId: { in: studentIds },
      engagementBadge: { in: [EngagementBadge.LESS_FOCUS, EngagementBadge.NO_TASK] },
      journal: {
        classId,
        journalDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
  });

  // 4. Batch Fetch Active Parents for WA links
  const parentLinks = await db.parentStudentLink.findMany({
    where: {
      studentId: { in: studentIds },
      receiveWaNotif: true,
    },
    include: { parent: true },
  });

  const parentMap = new Map<string, { phone: string; name: string }>();
  for (const pl of parentLinks) {
    if (pl.parent.phoneWa) {
      parentMap.set(pl.studentId, {
        phone: pl.parent.phoneWa,
        name: pl.parent.fullName,
      });
    }
  }

  // Map negative badges per student
  const negativeBadgeMap = new Map<string, number>();
  for (const nb of negativeBadges) {
    negativeBadgeMap.set(nb.studentId, (negativeBadgeMap.get(nb.studentId) || 0) + 1);
  }

  // Map grades per student per subject: studentId -> Map<subjectName, { scores: number[]; kkm: number }>
  const studentSubjectGrades = new Map<string, Map<string, { scores: number[]; kkm: number }>>();
  for (const sg of studentGrades) {
    if (!studentSubjectGrades.has(sg.studentId)) {
      studentSubjectGrades.set(sg.studentId, new Map());
    }
    const subjMap = studentSubjectGrades.get(sg.studentId)!;
    const subjName = sg.assessment.subject.subjectName;
    const kkm = Number(sg.assessment.subject.kkmScore || 75.0);
    const scoreVal = Number(sg.score);

    if (!subjMap.has(subjName)) {
      subjMap.set(subjName, { scores: [], kkm });
    }
    subjMap.get(subjName)!.scores.push(scoreVal);
  }

  // 5. Evaluate Invariants for each student
  const evaluatedStudents: StudentEwsEvaluation[] = [];

  const homeroomName = matrix.classInfo.homeroomTeacher?.fullName || 'Wali Kelas';
  const schoolName = 'SMA Negeri 1 Harapan Bangsa';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sihadir.sch.id';

  for (const row of matrix.students) {
    const parentInfo = parentMap.get(row.studentId);
    const parentName = parentInfo?.name || 'Orang Tua / Wali Murid';

    // A. Consecutive Alpa Calculation
    // Sort elapsed effective days chronologically and find consecutive streak ending at the latest day
    const elapsedEffectiveDays = matrix.days
      .filter((d) => d.isEffective && d.isElapsed)
      .sort((a, b) => a.date.localeCompare(b.date));

    let consecutiveAlpa = 0;
    const consecutiveDates: string[] = [];

    // Traverse backward from the latest elapsed day
    for (let i = elapsedEffectiveDays.length - 1; i >= 0; i--) {
      const d = elapsedEffectiveDays[i];
      const status = row.dailyStatuses[d.date];
      if (status === 'A') {
        consecutiveAlpa++;
        consecutiveDates.unshift(d.date);
      } else {
        break; // streak broken
      }
    }

    // B. Lateness statistics
    const lateArrivalCount = row.summary.terlambatCount;
    let totalLateMinutes = 0;
    if (row.dailyStatusDetails) {
      for (const date in row.dailyStatusDetails) {
        const detail = row.dailyStatusDetails[date];
        if (detail.lateMinutes) {
          totalLateMinutes += detail.lateMinutes;
        }
      }
    }

    // C. Academic & Remedial evaluation
    const remedialSubjects: Array<{ subjectName: string; score: number; kkm: number }> = [];
    const subjMap = studentSubjectGrades.get(row.studentId);
    if (subjMap) {
      for (const [subjName, data] of subjMap.entries()) {
        const avgScore =
          data.scores.reduce((a, b) => a + b, 0) / (data.scores.length || 1);
        if (avgScore < data.kkm) {
          remedialSubjects.push({
            subjectName: subjName,
            score: Math.round(avgScore * 10) / 10,
            kkm: data.kkm,
          });
        }
      }
    }

    const negativeBadgeCount = negativeBadgeMap.get(row.studentId) || 0;
    const monthlyAlpaCount = row.summary.alpaCount;
    const bolosCount = row.summary.bolosCount;
    const attendanceRate = row.summary.attendanceRate;

    // --- EVALUATE THE 5 INVARIANTS ---
    const invariants: InvariantEvaluation[] = [];

    // Invariant 1: Consecutive Alpa
    let inv1Triggered = false;
    let inv1Severity: EwsRiskLevel = 'NORMAL';
    let inv1Points = 0;
    let inv1Desc = 'Kehadiran harian normal';

    if (consecutiveAlpa >= 3) {
      inv1Triggered = true;
      inv1Severity = 'CRITICAL';
      inv1Points = 40;
      inv1Desc = `Alpa ${consecutiveAlpa} hari berturut-turut (${consecutiveDates.join(', ')})`;
    } else if (consecutiveAlpa === 2) {
      inv1Triggered = true;
      inv1Severity = 'WARNING';
      inv1Points = 20;
      inv1Desc = `Alpa 2 hari berturut-turut (${consecutiveDates.join(', ')})`;
    } else if (consecutiveAlpa === 1) {
      inv1Points = 5;
    }

    invariants.push({
      id: 'INV_1_CONSECUTIVE_ALPA',
      name: 'Ketidakhadiran Berurutan (Consecutive Alpa)',
      triggered: inv1Triggered,
      severity: inv1Severity,
      points: inv1Points,
      description: inv1Desc,
      details: { consecutiveAlpa, dates: consecutiveDates },
    });

    // Invariant 2: Monthly Absence Accumulation
    let inv2Triggered = false;
    let inv2Severity: EwsRiskLevel = 'NORMAL';
    let inv2Points = 0;
    let inv2Desc = 'Akumulasi ketidakhadiran dalam batas wajar';

    if (monthlyAlpaCount >= 3 || attendanceRate < 85.0) {
      inv2Triggered = true;
      inv2Severity = 'CRITICAL';
      inv2Points = monthlyAlpaCount >= 3 ? 30 : 25;
      inv2Desc =
        monthlyAlpaCount >= 3
          ? `Alpa bulanan ${monthlyAlpaCount} hari (ambang batas >= 3 hari)`
          : `Tingkat kehadiran sangat rendah (${attendanceRate}% < 85%)`;
    } else if (monthlyAlpaCount === 2 || attendanceRate < 90.0) {
      inv2Triggered = true;
      inv2Severity = 'WARNING';
      inv2Points = 15;
      inv2Desc =
        monthlyAlpaCount === 2
          ? `Alpa bulanan 2 hari`
          : `Tingkat kehadiran di bawah standar (${attendanceRate}% < 90%)`;
    } else if (row.summary.totalAbsent >= 5) {
      inv2Triggered = true;
      inv2Severity = 'WARNING';
      inv2Points = 10;
      inv2Desc = `Total izin/sakit/alpa terakumulasi ${row.summary.totalAbsent} hari`;
    }

    invariants.push({
      id: 'INV_2_MONTHLY_ABSENCE',
      name: 'Akumulasi Ketidakhadiran Bulanan',
      triggered: inv2Triggered,
      severity: inv2Severity,
      points: inv2Points,
      description: inv2Desc,
      details: { monthlyAlpaCount, attendanceRate, totalAbsent: row.summary.totalAbsent },
    });

    // Invariant 3: Habitual Lateness
    let inv3Triggered = false;
    let inv3Severity: EwsRiskLevel = 'NORMAL';
    let inv3Points = 0;
    let inv3Desc = 'Tingkat ketepatan waktu baik';

    if (lateArrivalCount >= 5) {
      inv3Triggered = true;
      inv3Severity = 'CRITICAL';
      inv3Points = 25;
      inv3Desc = `Terlambat ${lateArrivalCount} kali (Total ${totalLateMinutes} menit)`;
    } else if (lateArrivalCount >= 3 || totalLateMinutes >= 120) {
      inv3Triggered = true;
      inv3Severity = 'WARNING';
      inv3Points = 15;
      inv3Desc = `Terlambat ${lateArrivalCount} kali (Total ${totalLateMinutes} menit)`;
    }

    invariants.push({
      id: 'INV_3_HABITUAL_LATENESS',
      name: 'Keterlambatan Kronis (Habitual Lateness)',
      triggered: inv3Triggered,
      severity: inv3Severity,
      points: inv3Points,
      description: inv3Desc,
      details: { lateArrivalCount, totalLateMinutes },
    });

    // Invariant 4: Dual-Layer Bolos Pattern
    let inv4Triggered = false;
    let inv4Severity: EwsRiskLevel = 'NORMAL';
    let inv4Points = 0;
    let inv4Desc = 'Tidak terdeteksi diskrepansi hadir gerbang vs kelas';

    if (bolosCount >= 2) {
      inv4Triggered = true;
      inv4Severity = 'CRITICAL';
      inv4Points = 35;
      inv4Desc = `Terdeteksi ${bolosCount} kali membolos jam pelajaran setelah scan gerbang`;
    } else if (bolosCount === 1) {
      inv4Triggered = true;
      inv4Severity = 'WARNING';
      inv4Points = 20;
      inv4Desc = `Terdeteksi 1 kali membolos jam pelajaran setelah scan gerbang`;
    }

    invariants.push({
      id: 'INV_4_BOLOS_ANOMALY',
      name: 'Pola Bolos Jam Pelajaran (Dual-Layer Truancy)',
      triggered: inv4Triggered,
      severity: inv4Severity,
      points: inv4Points,
      description: inv4Desc,
      details: { bolosCount },
    });

    // Invariant 5: Attendance-Academic Correlation
    let inv5Triggered = false;
    let inv5Severity: EwsRiskLevel = 'NORMAL';
    let inv5Points = 0;
    let inv5Desc = 'Capaian akademik dan partisipasi kelas memenuhi standar';

    if (attendanceRate < 90.0 && remedialSubjects.length >= 2) {
      inv5Triggered = true;
      inv5Severity = 'CRITICAL';
      inv5Points = 25;
      inv5Desc = `Kehadiran ${attendanceRate}% (<90%) dan ${remedialSubjects.length} mapel di bawah KKM`;
    } else if (attendanceRate < 95.0 && remedialSubjects.length >= 1) {
      inv5Triggered = true;
      inv5Severity = 'WARNING';
      inv5Points = 15;
      inv5Desc = `${remedialSubjects.length} mapel di bawah KKM dengan kehadiran ${attendanceRate}%`;
    } else if (negativeBadgeCount >= 4) {
      inv5Triggered = true;
      inv5Severity = 'WARNING';
      inv5Points = 10;
      inv5Desc = `Mengumpulkan ${negativeBadgeCount} catatan fokus/tugas kurang di kelas`;
    }

    invariants.push({
      id: 'INV_5_ACADEMIC_CORRELATION',
      name: 'Korelasi Kehadiran & Akademik',
      triggered: inv5Triggered,
      severity: inv5Severity,
      points: inv5Points,
      description: inv5Desc,
      details: { remedialSubjects, negativeBadgeCount },
    });

    // Compute composite score and risk level
    const totalPoints = invariants.reduce((acc, inv) => acc + inv.points, 0);
    const riskScore = Math.min(100, totalPoints);

    const hasCriticalInvariant = invariants.some((inv) => inv.severity === 'CRITICAL');
    const hasWarningInvariant = invariants.some((inv) => inv.severity === 'WARNING');

    let riskLevel: EwsRiskLevel = 'NORMAL';
    if (riskScore >= 70 || hasCriticalInvariant) {
      riskLevel = 'CRITICAL';
    } else if (riskScore >= 40 || hasWarningInvariant) {
      riskLevel = 'WARNING';
    }

    // Determine actionable counseling SOP
    let counselingSop: EwsCounselingSop | undefined;

    if (riskLevel === 'CRITICAL') {
      if (inv1Triggered && consecutiveAlpa >= 3) {
        counselingSop = {
          roleResponsible: 'GURU_BK',
          primaryAction: 'Panggilan Darurat & Kunjungan Rumah (Home Visit)',
          steps: [
            'Hubungi telepon darurat orang tua/wali siswa segera.',
            'Jika telepon tidak terhubung dalam 24 jam, laksanakan Kunjungan Rumah bersama Wali Kelas.',
            'Identifikasi faktor penghambat (kesehatan, ekonomi, keluarga, perundungan).',
            'Buat Berita Acara Home Visit dan rencana tindak lanjut.',
          ],
          officialDocumentRequired: 'Surat Tugas & Berita Acara Home Visit',
          suggestedWaTemplate: 'EWS_CRITICAL_CONSECUTIVE_ALPA',
          waPayload: {
            template: TEMPLATE_EWS_CONSECUTIVE_ALPA,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              consecutive_days: consecutiveAlpa,
              alpa_dates: consecutiveDates.map(d => formatIndoDate(d)).join(', '),
              homeroom_name: homeroomName,
              portal_url: `${appUrl}/parent-dashboard`,
              school_name: schoolName,
            },
          },
        };
      } else if (inv4Triggered && bolosCount >= 2) {
        counselingSop = {
          roleResponsible: 'GURU_BK',
          primaryAction: 'Sidang Kasus (Case Conference) & SP 2 Pelanggaran',
          steps: [
            'Lakukan wawancara mendalam bersama siswa terkait motif bolos jam pelajaran.',
            'Panggil orang tua untuk hadir dalam sidang kasus bersama Guru BK dan Wali Kelas.',
            'Terbitkan Surat Peringatan Pelanggaran Tata Tertib Tingkat II.',
            'Tandatangani Surat Perjanjian Tidak Mengulangi Pelanggaran.',
          ],
          officialDocumentRequired: 'Surat Peringatan Pelanggaran Tata Tertib (SP 2)',
          suggestedWaTemplate: 'EWS_CRITICAL_BOLOS',
          waPayload: {
            template: TEMPLATE_EWS_BOLOS,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              bolos_count: bolosCount,
              meeting_date: formatIndoDate(new Date(Date.now() + 86400000)),
              school_name: schoolName,
            },
          },
        };
      } else {
        counselingSop = {
          roleResponsible: 'WALI_KELAS',
          primaryAction: 'Pemanggilan Orang Tua ke Sekolah (SP 1)',
          steps: [
            'Panggil orang tua ke sekolah untuk evaluasi komprehensif kehadiran.',
            'Rumuskan Kontrak Komitmen Kehadiran dan jadwal remedial terstruktur.',
            'Lakukan pemantauan presensi harian secara ketat selama 14 hari ke depan.',
          ],
          officialDocumentRequired: 'Surat Panggilan Orang Tua I (SP 1)',
          suggestedWaTemplate: 'EWS_CRITICAL_CONSECUTIVE_ALPA',
          waPayload: {
            template: TEMPLATE_EWS_CONSECUTIVE_ALPA,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              consecutive_days: monthlyAlpaCount,
              alpa_dates: `${monthlyAlpaCount} hari akumulasi`,
              homeroom_name: homeroomName,
              portal_url: `${appUrl}/parent-dashboard`,
              school_name: schoolName,
            },
          },
        };
      }
    } else if (riskLevel === 'WARNING') {
      if (inv3Triggered && lateArrivalCount >= 3) {
        counselingSop = {
          roleResponsible: 'TIM_DISIPLIN',
          primaryAction: 'Pembinaan Disiplin & Notifikasi Keterlambatan Bulanan',
          steps: [
            'Wawancara siswa terkait kendala perjalanan dan rutinitas pagi.',
            'Berikan pembiasaan literasi pagi saat tiba terlambat.',
            'Kirimkan rekap akumulasi keterlambatan kepada orang tua.',
          ],
          officialDocumentRequired: 'Kartu Kendali Kedisiplinan Siswa',
          suggestedWaTemplate: 'EWS_WARNING_LATENESS',
          waPayload: {
            template: TEMPLATE_EWS_LATENESS,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              late_count: lateArrivalCount,
              month_name: matrix.period.label,
              total_late_minutes: totalLateMinutes,
              portal_url: `${appUrl}/parent-dashboard`,
              school_name: schoolName,
            },
          },
        };
      } else if (inv5Triggered && remedialSubjects.length > 0) {
        counselingSop = {
          roleResponsible: 'WALI_KELAS',
          primaryAction: 'Koordinasi Remedial & Pendampingan Belajar',
          steps: [
            'Daftarkan siswa ke jadwal program remedial mata pelajaran terkait.',
            'Hubungi orang tua untuk memastikan pendampingan belajar di rumah.',
            'Tugaskan tutor sebaya di dalam kelas.',
          ],
          officialDocumentRequired: 'Kartu Remedial & Lembar Komitmen Belajar',
          suggestedWaTemplate: 'EWS_ACADEMIC',
          waPayload: {
            template: TEMPLATE_EWS_ACADEMIC,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              attendance_rate: attendanceRate,
              remedial_count: remedialSubjects.length,
              remedial_subjects_list: remedialSubjects.map(r => `${r.subjectName} (${r.score}/${r.kkm})`).join(', '),
              portal_url: `${appUrl}/parent-dashboard`,
              school_name: schoolName,
            },
          },
        };
      } else {
        counselingSop = {
          roleResponsible: 'WALI_KELAS',
          primaryAction: 'Wawancara Personal & Peringatan Dini',
          steps: [
            'Wawancara empat mata oleh Wali Kelas.',
            'Konfirmasi presensi kepada orang tua via WhatsApp.',
            'Catat pada Buku Jurnal Bimbingan Siswa.',
          ],
          officialDocumentRequired: 'Buku Jurnal Bimbingan Wali Kelas',
          suggestedWaTemplate: 'EWS_WARNING_LATENESS',
          waPayload: {
            template: TEMPLATE_EWS_LATENESS,
            variables: {
              parent_name: parentName,
              student_name: row.fullName,
              class_name: matrix.classInfo.className,
              late_count: lateArrivalCount,
              month_name: matrix.period.label,
              total_late_minutes: totalLateMinutes,
              portal_url: `${appUrl}/parent-dashboard`,
              school_name: schoolName,
            },
          },
        };
      }
    }

    evaluatedStudents.push({
      studentId: row.studentId,
      nis: row.nis,
      nisn: row.nisn,
      fullName: row.fullName,
      gender: row.gender,
      classId: row.classId,
      className: row.className,
      parentPhone: parentInfo?.phone || null,
      parentName: parentInfo?.name || null,
      riskScore,
      riskLevel,
      attendanceRate,
      invariants,
      metrics: {
        consecutiveAlpaDays: consecutiveAlpa,
        consecutiveAlpaDates: consecutiveDates,
        monthlyAlpaCount,
        totalAbsenceDays: row.summary.totalAbsent,
        lateArrivalCount,
        totalLateMinutes,
        bolosCount,
        remedialSubjectCount: remedialSubjects.length,
        remedialSubjects,
        negativeBadgeCount,
      },
      counselingSop,
    });
  }

  // Sort students: CRITICAL first, then WARNING, then NORMAL; tie-break by riskScore descending
  evaluatedStudents.sort((a, b) => {
    const levelWeight = (lvl: EwsRiskLevel) => (lvl === 'CRITICAL' ? 3 : lvl === 'WARNING' ? 2 : 1);
    const diff = levelWeight(b.riskLevel) - levelWeight(a.riskLevel);
    if (diff !== 0) return diff;
    return b.riskScore - a.riskScore;
  });

  const criticalCount = evaluatedStudents.filter((s) => s.riskLevel === 'CRITICAL').length;
  const warningCount = evaluatedStudents.filter((s) => s.riskLevel === 'WARNING').length;
  const normalCount = evaluatedStudents.filter((s) => s.riskLevel === 'NORMAL').length;

  return {
    classId: matrix.classInfo.id,
    className: matrix.classInfo.className,
    periodLabel: matrix.period.label,
    evaluatedAt: todayWib.toISOString(),
    totalStudents: evaluatedStudents.length,
    counts: {
      critical: criticalCount,
      warning: warningCount,
      normal: normalCount,
    },
    students: evaluatedStudents,
  };
}
