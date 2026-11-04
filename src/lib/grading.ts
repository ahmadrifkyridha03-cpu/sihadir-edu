import { AssessmentCategory } from '@prisma/client';

export type RemedialPolicy = 'CAP_AT_KKM' | 'ACTUAL_SCORE' | 'WEIGHTED_AVERAGE';

export interface KkmEvaluationResult {
  isGraded: boolean;
  score: number | null;
  kkmScore: number;
  isPassed: boolean;
  isRemedial: boolean;
  delta: number;
  formattedDelta: string;
  statusLabel: 'Tuntas' | 'Remedial' | 'Belum Dinilai';
}

export interface GradeStats {
  total: number;
  gradedCount: number;
  passedCount: number;
  remedialCount: number;
  average: number;
  highest: number;
  lowest: number;
  passingRate: number; // in percent 0.0 - 100.0
}

export interface CategoryDetails {
  category: AssessmentCategory;
  traditionalName: string;
  kurikulumMerdekaLabel: string;
  kurikulumMerdekaType: 'Formatif' | 'Sumatif';
  defaultWeight: number;
  description: string;
}

export interface AchievementPredicate {
  predicate: 'A' | 'B' | 'C' | 'D';
  label: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan';
  description: string;
}

/**
 * Standard Indonesian KKM Default Baseline (75.00)
 */
export const DEFAULT_KKM_SCORE = 75.0;

/**
 * Evaluates whether a score satisfies the Subject KKM (Kriteria Ketuntasan Minimal).
 * Passing rule: score >= kkmScore.
 */
export function evaluateKkm(
  score: number | string | null | undefined,
  kkmScore: number | string = DEFAULT_KKM_SCORE
): KkmEvaluationResult {
  const numericKkm =
    typeof kkmScore === 'string' ? parseFloat(kkmScore.replace(',', '.')) : kkmScore ?? DEFAULT_KKM_SCORE;
  const validKkm = isNaN(numericKkm) ? DEFAULT_KKM_SCORE : numericKkm;

  if (score === null || score === undefined || score === '') {
    return {
      isGraded: false,
      score: null,
      kkmScore: validKkm,
      isPassed: false,
      isRemedial: false,
      delta: 0,
      formattedDelta: '0.0',
      statusLabel: 'Belum Dinilai',
    };
  }

  const numericScore =
    typeof score === 'string' ? parseFloat(score.replace(',', '.')) : score;

  if (isNaN(numericScore)) {
    return {
      isGraded: false,
      score: null,
      kkmScore: validKkm,
      isPassed: false,
      isRemedial: false,
      delta: 0,
      formattedDelta: '0.0',
      statusLabel: 'Belum Dinilai',
    };
  }

  const isPassed = numericScore >= validKkm;
  const delta = Math.round((numericScore - validKkm) * 100) / 100;
  const formattedDelta = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);

  return {
    isGraded: true,
    score: numericScore,
    kkmScore: validKkm,
    isPassed,
    isRemedial: !isPassed,
    delta,
    formattedDelta,
    statusLabel: isPassed ? 'Tuntas' : 'Remedial',
  };
}

/**
 * Parses and clamps a numeric score between min (default 0) and max (default 100).
 * Replaces Indonesian decimal comma with standard dot.
 */
export function clampScore(val: number | string, min = 0, max = 100): number {
  if (typeof val === 'string') {
    val = parseFloat(val.replace(',', '.'));
  }
  if (isNaN(val)) return min;
  const clamped = Math.min(max, Math.max(min, val));
  return Math.round(clamped * 100) / 100;
}

/**
 * Calculates comprehensive class grading metrics and distribution statistics.
 */
export function calculateGradeStats(
  scores: (number | null | undefined)[],
  kkmScore: number | string = DEFAULT_KKM_SCORE
): GradeStats {
  const numericKkm =
    typeof kkmScore === 'string' ? parseFloat(kkmScore.replace(',', '.')) : kkmScore ?? DEFAULT_KKM_SCORE;

  const validScores: number[] = [];
  let passedCount = 0;
  let remedialCount = 0;
  let sum = 0;

  for (const s of scores) {
    if (s !== null && s !== undefined && !isNaN(Number(s))) {
      const num = Number(s);
      validScores.push(num);
      sum += num;
      if (num >= numericKkm) {
        passedCount++;
      } else {
        remedialCount++;
      }
    }
  }

  const total = scores.length;
  const gradedCount = validScores.length;
  const average = gradedCount > 0 ? Math.round((sum / gradedCount) * 10) / 10 : 0;
  const passingRate =
    gradedCount > 0 ? Math.round((passedCount / gradedCount) * 1000) / 10 : 0;
  const highest = gradedCount > 0 ? Math.max(...validScores) : 0;
  const lowest = gradedCount > 0 ? Math.min(...validScores) : 0;

  return {
    total,
    gradedCount,
    passedCount,
    remedialCount,
    average,
    highest,
    lowest,
    passingRate,
  };
}

/**
 * Kurikulum Merdeka & Kurikulum 2013 category harmonization configuration.
 */
export const ASSESSMENT_CATEGORY_CONFIGS: Record<AssessmentCategory, CategoryDetails> = {
  [AssessmentCategory.TUGAS]: {
    category: AssessmentCategory.TUGAS,
    traditionalName: 'Tugas Harian / PR',
    kurikulumMerdekaLabel: 'Asesmen Formatif (Aktivitas Mandiri)',
    kurikulumMerdekaType: 'Formatif',
    defaultWeight: 1.0,
    description: 'Pengerjaan latihan mandiri, PR, atau lembar kerja siswa di kelas.',
  },
  [AssessmentCategory.KUIS]: {
    category: AssessmentCategory.KUIS,
    traditionalName: 'Kuis Terjadwal',
    kurikulumMerdekaLabel: 'Asesmen Formatif (Check for Understanding)',
    kurikulumMerdekaType: 'Formatif',
    defaultWeight: 1.0,
    description: 'Uji pemahaman singkat 5-10 menit di tengah bab materi.',
  },
  [AssessmentCategory.PRAKTIKUM]: {
    category: AssessmentCategory.PRAKTIKUM,
    traditionalName: 'Praktik / Portofolio',
    kurikulumMerdekaLabel: 'Asesmen Formatif / Proyek (Unjuk Kerja)',
    kurikulumMerdekaType: 'Formatif',
    defaultWeight: 1.5,
    description: 'Demonstrasi unjuk kerja, praktikum laboratorium, atau proyek kelompok.',
  },
  [AssessmentCategory.UH]: {
    category: AssessmentCategory.UH,
    traditionalName: 'Ulangan Harian',
    kurikulumMerdekaLabel: 'Asesmen Sumatif Lingkup Materi (TP)',
    kurikulumMerdekaType: 'Sumatif',
    defaultWeight: 2.0,
    description: 'Penilaian sumatif komprehensif pada akhir satu Tujuan Pembelajaran (TP).',
  },
  [AssessmentCategory.PTS]: {
    category: AssessmentCategory.PTS,
    traditionalName: 'Penilaian Tengah Semester',
    kurikulumMerdekaLabel: 'Asesmen Sumatif Tengah Semester (STS)',
    kurikulumMerdekaType: 'Sumatif',
    defaultWeight: 2.0,
    description: 'Evaluasi berkala capaian kompetensi paruh semester.',
  },
  [AssessmentCategory.PAS]: {
    category: AssessmentCategory.PAS,
    traditionalName: 'Penilaian Akhir Semester',
    kurikulumMerdekaLabel: 'Asesmen Sumatif Akhir Semester (SAS)',
    kurikulumMerdekaType: 'Sumatif',
    defaultWeight: 2.5,
    description: 'Evaluasi akhir komprehensif untuk pengisian nilai rapor semester.',
  },
};

/**
 * Returns detailed Kurikulum Merdeka metadata for an AssessmentCategory enum.
 */
export function getCategoryDetails(category: AssessmentCategory): CategoryDetails {
  return (
    ASSESSMENT_CATEGORY_CONFIGS[category] || {
      category,
      traditionalName: category,
      kurikulumMerdekaLabel: category,
      kurikulumMerdekaType: 'Formatif',
      defaultWeight: 1.0,
      description: 'Penilaian capaian akademik siswa.',
    }
  );
}

/**
 * Applies Permendikbud standard remedial capping.
 * Under standard scholastic policy, a student re-tested after failing KKM receives at most KKM
 * to ensure fairness for students who achieved mastery on their first attempt,
 * while recording the re-test score in feedback.
 */
export function applyRemedialCapping(
  originalScore: number,
  remedialScore: number,
  kkmScore = DEFAULT_KKM_SCORE,
  policy: RemedialPolicy = 'CAP_AT_KKM'
): { finalScore: number; note: string } {
  if (remedialScore < kkmScore) {
    return {
      finalScore: remedialScore,
      note: `Remedial belum tuntas (${remedialScore} < ${kkmScore}). Nilai awal: ${originalScore}.`,
    };
  }

  if (policy === 'CAP_AT_KKM') {
    return {
      finalScore: kkmScore,
      note: `Nilai remedial ${remedialScore} tuntas, disesuaikan batas KKM ${kkmScore}. Nilai awal: ${originalScore}.`,
    };
  }

  if (policy === 'WEIGHTED_AVERAGE') {
    // 40% original + 60% remedial
    const weighted = Math.round((originalScore * 0.4 + remedialScore * 0.6) * 10) / 10;
    return {
      finalScore: weighted,
      note: `Nilai remedial berbobot 40:60 (${weighted}). Nilai awal: ${originalScore}, tes ulang: ${remedialScore}.`,
    };
  }

  // ACTUAL_SCORE
  return {
    finalScore: remedialScore,
    note: `Nilai remedial murni dicatat (${remedialScore}). Nilai awal: ${originalScore}.`,
  };
}

/**
 * Returns the Kurikulum Merdeka / Indonesian standard scholastic predicate (A/B/C/D)
 * based on distance from the subject KKM.
 */
export function getAchievementPredicate(
  score: number,
  kkmScore = DEFAULT_KKM_SCORE
): AchievementPredicate {
  const range = (100 - kkmScore) / 3;

  if (score >= kkmScore + 2 * range) {
    return {
      predicate: 'A',
      label: 'Sangat Baik',
      description: 'Menunjukkan penguasaan materi yang sangat unggul dan melampaui capaian pembelajaran.',
    };
  } else if (score >= kkmScore + range) {
    return {
      predicate: 'B',
      label: 'Baik',
      description: 'Menunjukkan pemahaman materi yang mantap dan memenuhi capaian pembelajaran dengan baik.',
    };
  } else if (score >= kkmScore) {
    return {
      predicate: 'C',
      label: 'Cukup',
      description: 'Memenuhi batas kriteria ketuntasan minimal, namun masih memerlukan penguatan latihan.',
    };
  } else {
    return {
      predicate: 'D',
      label: 'Perlu Bimbingan',
      description: 'Belum mencapai ketuntasan minimal (KKM), wajib mengikuti program remedial terstruktur.',
    };
  }
}
