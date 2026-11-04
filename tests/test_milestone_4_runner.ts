import {
  evaluateKkm,
  clampScore,
  calculateGradeStats,
  getCategoryDetails,
  applyRemedialCapping,
  getAchievementPredicate,
  DEFAULT_KKM_SCORE,
} from '../src/lib/grading';
import {
  calculateAspectRatioFit,
  formatFileSize,
  DEFAULT_MAX_SIZE_BYTES,
  DEFAULT_MAX_DIMENSION,
} from '../src/lib/compression';
import { LocalStorageProvider } from '../src/lib/media-storage';
import { isPhotoVisibleToStudent } from '../src/lib/activity-feed';
import { AssessmentCategory, DocVisibility } from '@prisma/client';

// ==============================================================================
// 1. Grading Engine Invariants
// ==============================================================================

// Test 1: KKM Passing Evaluation
const passedRes = evaluateKkm(85, 75);
if (!passedRes.isPassed || passedRes.delta !== 10 || passedRes.statusLabel !== 'Tuntas') {
  throw new Error(`KKM passing evaluation failed: ${JSON.stringify(passedRes)}`);
}

// Test 2: KKM Remedial Evaluation
const remedialRes = evaluateKkm(70, 75);
if (remedialRes.isPassed || remedialRes.delta !== -5 || remedialRes.statusLabel !== 'Remedial') {
  throw new Error(`KKM remedial evaluation failed: ${JSON.stringify(remedialRes)}`);
}

// Test 3: KKM Boundary Edge (Exact 75.00 vs 74.99)
const exactKkm = evaluateKkm(75.0, 75.0);
if (!exactKkm.isPassed || exactKkm.delta !== 0) {
  throw new Error(`Exact KKM boundary failed: ${JSON.stringify(exactKkm)}`);
}

const justBelowKkm = evaluateKkm(74.99, 75.0);
if (justBelowKkm.isPassed || justBelowKkm.delta >= 0) {
  throw new Error(`Marginal failure below KKM failed: ${JSON.stringify(justBelowKkm)}`);
}

// Test 4: Ungraded / Null handling
const nullRes = evaluateKkm(null, 75);
if (nullRes.isGraded || nullRes.statusLabel !== 'Belum Dinilai') {
  throw new Error(`Null score evaluation failed: ${JSON.stringify(nullRes)}`);
}

// Test 5: Score Clamping & Sanitization
if (clampScore(125) !== 100) {
  throw new Error(`Clamping max failed: expected 100, got ${clampScore(125)}`);
}
if (clampScore(-15) !== 0) {
  throw new Error(`Clamping min failed: expected 0, got ${clampScore(-15)}`);
}
if (clampScore('87,5') !== 87.5) {
  throw new Error(`Indonesian decimal comma replacement failed: expected 87.5, got ${clampScore('87,5')}`);
}

// Test 6: Class Grade Analytics Calculation
const testScores = [80, 70, 90, 60, null];
const stats = calculateGradeStats(testScores, 75);
if (
  stats.total !== 5 ||
  stats.gradedCount !== 4 ||
  stats.passedCount !== 2 ||
  stats.remedialCount !== 2 ||
  stats.average !== 75 ||
  stats.passingRate !== 50 ||
  stats.highest !== 90 ||
  stats.lowest !== 60
) {
  throw new Error(`Class stats calculation mismatch: ${JSON.stringify(stats)}`);
}

// Test 7: Kurikulum Merdeka Harmonization
const allCategories: AssessmentCategory[] = [
  AssessmentCategory.TUGAS,
  AssessmentCategory.KUIS,
  AssessmentCategory.PRAKTIKUM,
  AssessmentCategory.UH,
  AssessmentCategory.PTS,
  AssessmentCategory.PAS,
];
for (const cat of allCategories) {
  const details = getCategoryDetails(cat);
  if (!details.traditionalName || !details.kurikulumMerdekaLabel || !details.kurikulumMerdekaType) {
    throw new Error(`Incomplete category details for ${cat}`);
  }
}

// Test 8: Permendikbud Remedial Capping
const capped = applyRemedialCapping(50, 90, 75, 'CAP_AT_KKM');
if (capped.finalScore !== 75) {
  throw new Error(`Remedial capping failed: expected 75, got ${capped.finalScore}`);
}

// Test 9: Achievement Predicate
const predA = getAchievementPredicate(95, 75);
const predD = getAchievementPredicate(60, 75);
if (predA.predicate !== 'A' || predD.predicate !== 'D') {
  throw new Error(`Predicate assignment mismatch: predA=${predA.predicate}, predD=${predD.predicate}`);
}

// ==============================================================================
// 2. WebP Compression & Aspect Ratio Invariants
// ==============================================================================

// Test 10: Aspect-Ratio Preserving Scaling (4000x3000 to max 1280)
const scaledLandscape = calculateAspectRatioFit(4000, 3000, 1280, 1280);
if (scaledLandscape.width !== 1280 || scaledLandscape.height !== 960) {
  throw new Error(`Aspect ratio fit failed: expected 1280x960, got ${scaledLandscape.width}x${scaledLandscape.height}`);
}

// Small image should not upscale
const notUpscaled = calculateAspectRatioFit(800, 600, 1280, 1280);
if (notUpscaled.width !== 800 || notUpscaled.height !== 600) {
  throw new Error(`Small image upscaled incorrectly: ${JSON.stringify(notUpscaled)}`);
}

// Constants check
if (DEFAULT_MAX_SIZE_BYTES !== 180 * 1024) {
  throw new Error(`DEFAULT_MAX_SIZE_BYTES expected 184320, got ${DEFAULT_MAX_SIZE_BYTES}`);
}
if (DEFAULT_MAX_DIMENSION !== 1280) {
  throw new Error(`DEFAULT_MAX_DIMENSION expected 1280, got ${DEFAULT_MAX_DIMENSION}`);
}

// Test 11: File size formatting
if (formatFileSize(1024) !== '1 KB') {
  throw new Error(`formatFileSize failed: expected '1 KB', got ${formatFileSize(1024)}`);
}

// ==============================================================================
// 3. Storage Provider Abstraction
// ==============================================================================

async function testStorageProvider() {
  const local = new LocalStorageProvider();
  const res = await local.upload('SGVsbG8gV29ybGQ=', {
    journalId: 'test-journal-uuid',
    filename: 'test.webp',
    contentType: 'image/webp',
  });

  if (!res.url.startsWith('data:image/webp;base64,') || res.provider !== 'local') {
    throw new Error(`LocalStorageProvider failed: ${JSON.stringify(res)}`);
  }
}

// ==============================================================================
// 4. Activity Feed Documentation Visibility Scoping
// ==============================================================================

const publicPhoto = {
  visibility: DocVisibility.CLASS_PUBLIC,
  taggedStudentIds: [],
};
const taggedPhoto = {
  visibility: DocVisibility.TAGGED_STUDENTS_ONLY,
  taggedStudentIds: ['student-uuid-1', 'student-uuid-2'],
};

if (!isPhotoVisibleToStudent(publicPhoto, 'student-uuid-any')) {
  throw new Error('Public photo should be visible to any student');
}
if (!isPhotoVisibleToStudent(taggedPhoto, 'student-uuid-1')) {
  throw new Error('Tagged photo should be visible to tagged student');
}
if (isPhotoVisibleToStudent(taggedPhoto, 'student-uuid-3')) {
  throw new Error('Tagged photo must NOT be visible to untagged student');
}

// Run async tests
testStorageProvider().then(() => {
  console.log('TSX_ALL_M4_CORE_LOGIC_PASSED');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
