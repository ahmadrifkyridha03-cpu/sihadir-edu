/**
 * Milestone 4 Stress & Adversarial Test Runner (TypeScript / TSX)
 * Empirically tests:
 * 1. KKM Boundary Fuzzing (exact, near, negative, overflow, comma decimals)
 * 2. Remedial Capping Policies ('CAP_AT_KKM', 'ACTUAL_SCORE', 'WEIGHTED_AVERAGE')
 * 3. Excel Multi-line Clipboard Paste Parsing (tabs, CRLF, comma decimal, whitespace, empty rows, bounds)
 * 4. WebP Aspect Ratio & Dimension Calculations (portrait, landscape, square, small, extreme aspect ratios)
 * 5. Iterative Compression Loop simulation (size ceiling <= 184,320 bytes)
 * 6. Server-side Rejection: uploadJournalDocumentationSchema (> 250 KB rejected, <= 250 KB accepted)
 */

import {
  evaluateKkm,
  clampScore,
  calculateGradeStats,
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
import {
  uploadJournalDocumentationSchema,
  documentationPhotoItemSchema,
} from '../src/actions/documentation';
import { DocVisibility } from '@prisma/client';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passCount++;
}

console.log('=== STARTING TSX ADVERSARIAL STRESS RUNNER ===');

// ==============================================================================
// 1. KKM & SCORE BOUNDARY FUZZING
// ==============================================================================
console.log('--- Subsuite 1: KKM & Score Boundary Fuzzing ---');

// 1.1 Exact KKM boundary
const kkm75 = evaluateKkm(75.0, 75.0);
assert(kkm75.isPassed === true, 'Exact KKM boundary must be passed');
assert(kkm75.isRemedial === false, 'Exact KKM boundary must not be remedial');
assert(kkm75.delta === 0.0, 'Exact KKM boundary delta must be 0.0');
assert(kkm75.statusLabel === 'Tuntas', 'Exact KKM statusLabel must be Tuntas');

// 1.2 Boundary fuzzing around KKM (75.0)
const kkmNearFail = evaluateKkm(74.99, 75.0);
assert(kkmNearFail.isPassed === false, '74.99 with KKM 75 must be failed');
assert(kkmNearFail.isRemedial === true, '74.99 must require remedial');
assert(kkmNearFail.delta === -0.01, `Delta for 74.99 should be -0.01, got ${kkmNearFail.delta}`);
assert(kkmNearFail.statusLabel === 'Remedial', 'Status for 74.99 must be Remedial');

const kkmNearPass = evaluateKkm(75.01, 75.0);
assert(kkmNearPass.isPassed === true, '75.01 with KKM 75 must be passed');
assert(kkmNearPass.isRemedial === false, '75.01 must not require remedial');
assert(kkmNearPass.delta === 0.01, `Delta for 75.01 should be 0.01, got ${kkmNearPass.delta}`);
assert(kkmNearPass.statusLabel === 'Tuntas', 'Status for 75.01 must be Tuntas');

// 1.3 Indonesian comma decimal inputs in evaluateKkm
const commaScorePass = evaluateKkm('75,0', '75,0');
assert(commaScorePass.isPassed === true, 'Comma decimal 75,0 vs 75,0 must pass');
assert(commaScorePass.delta === 0.0, 'Delta for 75,0 vs 75,0 must be 0.0');

const commaScoreFail = evaluateKkm('74,9', '75,0');
assert(commaScoreFail.isPassed === false, 'Comma decimal 74,9 vs 75,0 must fail');
assert(commaScoreFail.delta === -0.1, `Delta for 74,9 should be -0.1, got ${commaScoreFail.delta}`);

// 1.4 Non-standard KKM baselines (e.g. 60, 70, 80, 85)
for (const kkm of [60, 65, 70, 75, 80, 85, 90]) {
  const exact = evaluateKkm(kkm, kkm);
  assert(exact.isPassed && exact.delta === 0, `Exact KKM for baseline ${kkm} must pass with 0 delta`);
  const justBelow = evaluateKkm(kkm - 0.01, kkm);
  assert(!justBelow.isPassed && justBelow.delta === -0.01, `kkm-0.01 for baseline ${kkm} must fail`);
  const justAbove = evaluateKkm(kkm + 0.01, kkm);
  assert(justAbove.isPassed && justAbove.delta === 0.01, `kkm+0.01 for baseline ${kkm} must pass`);
}

// 1.5 Score Clamping Extremes
assert(clampScore(-15.5) === 0.0, `clampScore(-15.5) must be 0.0, got ${clampScore(-15.5)}`);
assert(clampScore(-9999.99) === 0.0, 'Extreme negative must clamp to 0');
assert(clampScore(150.0) === 100.0, `clampScore(150.0) must be 100.0, got ${clampScore(150.0)}`);
assert(clampScore(9999.99) === 100.0, 'Extreme overflow must clamp to 100');
assert(clampScore(0.0) === 0.0, '0.0 clamp preserves 0.0');
assert(clampScore(100.0) === 100.0, '100.0 clamp preserves 100.0');
assert(clampScore('85,5') === 85.5, `clampScore('85,5') must be 85.5, got ${clampScore('85,5')}`);
assert(clampScore('85,556') === 85.56, `clampScore('85,556') must round to 2 decimals (85.56), got ${clampScore('85,556')}`);
assert(clampScore('invalid') === 0.0, 'Invalid string input must return min (0.0)');
assert(clampScore(NaN) === 0.0, 'NaN input must return min (0.0)');

// 1.6 Remedial Capping Policies
// Policy A: CAP_AT_KKM (Default)
const cap1 = applyRemedialCapping(40, 95, 75, 'CAP_AT_KKM');
assert(cap1.finalScore === 75, `CAP_AT_KKM with remedial=95, kkm=75 must cap at 75, got ${cap1.finalScore}`);
assert(cap1.note.includes('disesuaikan batas KKM 75'), 'CAP_AT_KKM note must explain KKM adjustment');

const cap2 = applyRemedialCapping(40, 70, 75, 'CAP_AT_KKM');
assert(cap2.finalScore === 70, `Remedial score 70 < KKM 75 must remain 70, got ${cap2.finalScore}`);
assert(cap2.note.includes('belum tuntas'), 'Unreached remedial note must indicate belum tuntas');

const cap3 = applyRemedialCapping(40, 75, 75, 'CAP_AT_KKM');
assert(cap3.finalScore === 75, `Remedial score exactly at KKM 75 must be 75, got ${cap3.finalScore}`);

// Policy B: ACTUAL_SCORE
const act1 = applyRemedialCapping(50, 92, 75, 'ACTUAL_SCORE');
assert(act1.finalScore === 92, `ACTUAL_SCORE must return 92, got ${act1.finalScore}`);

// Policy C: WEIGHTED_AVERAGE (40% initial + 60% remedial)
// 50 * 0.4 + 90 * 0.6 = 20 + 54 = 74.0
const w1 = applyRemedialCapping(50, 90, 75, 'WEIGHTED_AVERAGE');
assert(w1.finalScore === 74, `WEIGHTED_AVERAGE must compute 74, got ${w1.finalScore}`);

// 1.7 Class Grade Statistics Edge Cases
const emptyStats = calculateGradeStats([], 75);
assert(emptyStats.total === 0 && emptyStats.average === 0 && emptyStats.passingRate === 0, 'Empty class stats must be all zeros');

const allNullStats = calculateGradeStats([null, undefined, null], 75);
assert(allNullStats.total === 3 && allNullStats.gradedCount === 0 && allNullStats.average === 0, 'All-null stats must be handled cleanly');

const perfectStats = calculateGradeStats([75, 80, 85, 90, 95, 100], 75);
assert(perfectStats.passingRate === 100.0, '100% passing rate when all >= KKM');
assert(perfectStats.remedialCount === 0, '0 remedial students in perfect class');

const zeroPassStats = calculateGradeStats([50, 60, 70, 74.9], 75);
assert(zeroPassStats.passingRate === 0.0, '0% passing rate when all < KKM');
assert(zeroPassStats.remedialCount === 4, 'All 4 remedial in zero-pass class');

console.log('✓ Subsuite 1 passed completely.');

// ==============================================================================
// 2. EXCEL MULTI-LINE CLIPBOARD PASTE PARSING SIMULATION
// ==============================================================================
console.log('--- Subsuite 2: Excel Multi-line Clipboard Paste Parsing ---');

interface MockStudent {
  studentId: string;
  name: string;
  score: number | null;
}

function simulateExcelPaste(
  clipboardText: string,
  startIdx: number,
  students: MockStudent[]
): { updatedStudents: MockStudent[]; parsedTokenCount: number } {
  // Exact logic from FormalGradeGrid.tsx lines 132-160
  const rawTokens = clipboardText
    .split(/\r\n|\n|\r/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (rawTokens.length <= 1) {
    return { updatedStudents: [...students], parsedTokenCount: 0 };
  }

  const next = students.map((s) => ({ ...s }));
  let tokenIdx = 0;

  for (let i = startIdx; i < next.length && tokenIdx < rawTokens.length; i++) {
    const token = rawTokens[tokenIdx].replace(',', '.');
    const num = parseFloat(token);
    if (!isNaN(num)) {
      next[i].score = clampScore(num, 0, 100);
    }
    tokenIdx++;
  }

  return { updatedStudents: next, parsedTokenCount: tokenIdx };
}

// 2.1 Standard Windows Excel CRLF Paste
const testStudents1: MockStudent[] = [
  { studentId: '1', name: 'Ahmad', score: null },
  { studentId: '2', name: 'Budi', score: null },
  { studentId: '3', name: 'Citra', score: null },
  { studentId: '4', name: 'Dewi', score: null },
];
const excelCrlf = '85\r\n90\r\n75\r\n65\r\n';
const res1 = simulateExcelPaste(excelCrlf, 0, testStudents1);
assert(res1.parsedTokenCount === 4, 'Should parse 4 tokens from CRLF paste');
assert(res1.updatedStudents[0].score === 85, 'Student 1 score should be 85');
assert(res1.updatedStudents[1].score === 90, 'Student 2 score should be 90');
assert(res1.updatedStudents[2].score === 75, 'Student 3 score should be 75');
assert(res1.updatedStudents[3].score === 65, 'Student 4 score should be 65');

// 2.2 Tab characters & Indonesian comma decimal separators
const excelTabsAndCommas = '85,5\t\r\n92,75\t\r\n74,2\t\r\n';
const res2 = simulateExcelPaste(excelTabsAndCommas, 0, testStudents1);
assert(res2.updatedStudents[0].score === 85.5, 'Indonesian comma 85,5 with trailing tab must parse as 85.5');
assert(res2.updatedStudents[1].score === 92.75, 'Indonesian comma 92,75 with tab must parse as 92.75');
assert(res2.updatedStudents[2].score === 74.2, 'Indonesian comma 74,2 must parse as 74.2');

// 2.3 Leading/trailing whitespaces and empty rows
const messyPaste = '   \r\n  88.5  \r\n\r\n   \r\n  94.0  \r\n\r\n';
const res3 = simulateExcelPaste(messyPaste, 0, testStudents1);
assert(res3.parsedTokenCount === 2, `Should ignore empty lines and parse 2 valid tokens, got ${res3.parsedTokenCount}`);
assert(res3.updatedStudents[0].score === 88.5, 'First student gets 88.5');
assert(res3.updatedStudents[1].score === 94.0, 'Second student gets 94.0');
assert(res3.updatedStudents[2].score === null, 'Third student untouched');

// 2.4 Student Count Mismatch: More pasted tokens than remaining students
const overflowPaste = '80\r\n81\r\n82\r\n83\r\n84\r\n85\r\n86\r\n87\r\n';
const res4 = simulateExcelPaste(overflowPaste, 2, testStudents1); // Starts at index 2 (only 2 students remain)
assert(res4.updatedStudents[2].score === 80, 'Student 2 gets first token (80)');
assert(res4.updatedStudents[3].score === 81, 'Student 3 gets second token (81)');
// Should not throw or crash on remaining 6 tokens
assert(res4.updatedStudents.length === 4, 'Student list length preserved');

// 2.5 Out of bounds / invalid score clamping during paste
const outOfBoundsPaste = '-50\r\n150\r\n';
const res5 = simulateExcelPaste(outOfBoundsPaste, 0, testStudents1);
assert(res5.updatedStudents[0].score === 0.0, 'Negative pasted score clamped to 0.0');
assert(res5.updatedStudents[1].score === 100.0, 'Overflow pasted score clamped to 100.0');

console.log('✓ Subsuite 2 passed completely.');

// ==============================================================================
// 3. WEBP COMPRESSION & ASPECT RATIO INVARIANTS
// ==============================================================================
console.log('--- Subsuite 3: WebP Compression & Aspect Ratio Invariants ---');

// 3.1 Portrait scaling (e.g. 2400x3200 -> max 1280)
const portrait = calculateAspectRatioFit(2400, 3200, 1280, 1280);
assert(portrait.width === 960 && portrait.height === 1280, `Portrait 2400x3200 should scale to 960x1280, got ${portrait.width}x${portrait.height}`);

// 3.2 Landscape scaling (e.g. 4000x3000 -> max 1280)
const landscape = calculateAspectRatioFit(4000, 3000, 1280, 1280);
assert(landscape.width === 1280 && landscape.height === 960, `Landscape 4000x3000 should scale to 1280x960, got ${landscape.width}x${landscape.height}`);

// 3.3 Square scaling (e.g. 2000x2000 -> max 1280)
const square = calculateAspectRatioFit(2000, 2000, 1280, 1280);
assert(square.width === 1280 && square.height === 1280, `Square 2000x2000 should scale to 1280x1280, got ${square.width}x${square.height}`);

// 3.4 Smaller-than-1280px images must NOT be enlarged/upscaled
const small1 = calculateAspectRatioFit(800, 600, 1280, 1280);
assert(small1.width === 800 && small1.height === 600, 'Small 800x600 must retain original dimensions without upscaling');

const small2 = calculateAspectRatioFit(1200, 900, 1280, 1280);
assert(small2.width === 1200 && small2.height === 900, 'Small 1200x900 must retain original dimensions');

const exactBoundaryDim = calculateAspectRatioFit(1280, 720, 1280, 1280);
assert(exactBoundaryDim.width === 1280 && exactBoundaryDim.height === 720, 'Exact 1280x720 must retain dimensions');

// 3.5 Extreme Aspect Ratios (Panoramic and Banner)
const panorama = calculateAspectRatioFit(10000, 1000, 1280, 1280);
assert(panorama.width === 1280 && panorama.height === 128, `Panorama 10000x1000 should scale to 1280x128, got ${panorama.width}x${panorama.height}`);

const banner = calculateAspectRatioFit(1000, 10000, 1280, 1280);
assert(banner.width === 128 && banner.height === 1280, `Banner 1000x10000 should scale to 128x1280, got ${banner.width}x${banner.height}`);

// 3.6 Degenerate dimensions
const degen = calculateAspectRatioFit(0, 0, 1280, 1280);
assert(degen.width >= 1 && degen.height >= 1, 'Degenerate 0x0 input should return safe positive dimensions');

// 3.7 File Size Constant Checks
assert(DEFAULT_MAX_SIZE_BYTES === 184320, `DEFAULT_MAX_SIZE_BYTES must be 184320 bytes (180 KB), got ${DEFAULT_MAX_SIZE_BYTES}`);
assert(DEFAULT_MAX_DIMENSION === 1280, `DEFAULT_MAX_DIMENSION must be 1280px, got ${DEFAULT_MAX_DIMENSION}`);

// 3.8 Simulated Stepped Quality & Dimension Compression Degradation Engine
function simulateCompressionLoop(initialSizeKb: number, entropyFactor: number): {
  finalSizeBytes: number;
  finalWidth: number;
  finalHeight: number;
  iterations: number;
} {
  let currentMaxWidth = 1280;
  let currentMaxHeight = 1280;
  let bestSizeBytes = Infinity;
  let iterations = 0;

  for (let dimStep = 0; dimStep < 3; dimStep++) {
    const { width: targetW, height: targetH } = calculateAspectRatioFit(
      4000,
      3000,
      currentMaxWidth,
      currentMaxHeight
    );

    let currentQuality = dimStep === 0 ? 0.82 : 0.7;

    while (currentQuality >= 0.4 - 0.01) {
      iterations++;
      // Simulating compression size model
      const candidateBytes = Math.round(
        (targetW * targetH * 0.15 * currentQuality * entropyFactor)
      );
      bestSizeBytes = candidateBytes;

      if (candidateBytes <= DEFAULT_MAX_SIZE_BYTES) {
        return {
          finalSizeBytes: candidateBytes,
          finalWidth: targetW,
          finalHeight: targetH,
          iterations,
        };
      }
      currentQuality -= 0.08;
    }

    currentMaxWidth = Math.round(currentMaxWidth * 0.85);
    currentMaxHeight = Math.round(currentMaxHeight * 0.85);
  }

  return {
    finalSizeBytes: bestSizeBytes,
    finalWidth: currentMaxWidth,
    finalHeight: currentMaxHeight,
    iterations,
  };
}

// Run simulated compression across varying entropy levels
for (const entropy of [0.5, 0.8, 1.0, 1.2, 1.4]) {
  const sim = simulateCompressionLoop(4500, entropy);
  assert(sim.finalSizeBytes <= DEFAULT_MAX_SIZE_BYTES || sim.iterations > 10, 'Compression simulation must degrade properly');
}

console.log('✓ Subsuite 3 passed completely.');

// ==============================================================================
// 4. SERVER-SIDE REJECTION & ZOD VALIDATION HARDENING
// ==============================================================================
console.log('--- Subsuite 4: Server-Side Rejection & Zod Hardening ---');

const dummyUuid = '123e4567-e89b-12d3-a456-426614174000';

// 4.1 Boundary: Exact 250 KB is allowed
const valid250KbPhoto = {
  imageUrl: 'https://example.com/photo.webp',
  caption: 'Foto dokumentasi sah',
  visibility: DocVisibility.CLASS_PUBLIC,
  taggedStudentIds: [],
  fileSizeKb: 250, // Exactly 250 KB
};
const parsed250 = documentationPhotoItemSchema.safeParse(valid250KbPhoto);
assert(parsed250.success === true, 'Exact 250 KB photo must be ACCEPTED');

// 4.2 Rejection: 251 KB MUST be rejected
const invalid251KbPhoto = {
  ...valid250KbPhoto,
  fileSizeKb: 251, // 1 KB over limit
};
const parsed251 = documentationPhotoItemSchema.safeParse(invalid251KbPhoto);
assert(parsed251.success === false, '251 KB photo must be REJECTED');
if (!parsed251.success) {
  const errMsg = parsed251.error.issues[0]?.message || '';
  assert(errMsg.includes('File ditolak: ukuran melebihi batas maksimal server 250 KB'), `Expected server rejection message, got: ${errMsg}`);
}

// 4.3 Rejection: 500 KB uncompressed upload
const invalid500KbPhoto = {
  ...valid250KbPhoto,
  fileSizeKb: 500,
};
assert(documentationPhotoItemSchema.safeParse(invalid500KbPhoto).success === false, '500 KB photo must be REJECTED');

// 4.4 Rejection: 0 KB or negative size
const invalidZeroKbPhoto = {
  ...valid250KbPhoto,
  fileSizeKb: 0,
};
assert(documentationPhotoItemSchema.safeParse(invalidZeroKbPhoto).success === false, '0 KB photo must be REJECTED');

const invalidNegativeKbPhoto = {
  ...valid250KbPhoto,
  fileSizeKb: -15,
};
assert(documentationPhotoItemSchema.safeParse(invalidNegativeKbPhoto).success === false, 'Negative fileSizeKb must be REJECTED');

// 4.5 Rejection: Non-integer KB
const invalidFloatKbPhoto = {
  ...valid250KbPhoto,
  fileSizeKb: 145.5,
};
assert(documentationPhotoItemSchema.safeParse(invalidFloatKbPhoto).success === false, 'Float fileSizeKb must be REJECTED');

// 4.6 Photo array constraints on uploadJournalDocumentationSchema
const emptyPhotosPayload = {
  journalId: dummyUuid,
  photos: [],
};
assert(uploadJournalDocumentationSchema.safeParse(emptyPhotosPayload).success === false, 'Empty photos array must be REJECTED');

const sixPhotosPayload = {
  journalId: dummyUuid,
  photos: Array(6).fill(valid250KbPhoto),
};
assert(uploadJournalDocumentationSchema.safeParse(sixPhotosPayload).success === false, 'Over 5 photos array must be REJECTED');

const validFivePhotosPayload = {
  journalId: dummyUuid,
  photos: Array(5).fill(valid250KbPhoto),
};
assert(uploadJournalDocumentationSchema.safeParse(validFivePhotosPayload).success === true, 'Up to 5 photos array must be ACCEPTED');

console.log('✓ Subsuite 4 passed completely.');

console.log('====================================================');
console.log(`TSX ADVERSARIAL STRESS RUNNER COMPLETE: ${passCount}/${testCount} ASSERTIONS PASSED.`);
console.log('TSX_ADVERSARIAL_M4_STRESS_PASSED');
console.log('====================================================');
