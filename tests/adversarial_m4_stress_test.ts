import {
  evaluateKkm,
  clampScore,
  calculateGradeStats,
  applyRemedialCapping,
  getAchievementPredicate,
  getCategoryDetails,
  DEFAULT_KKM_SCORE,
} from '../src/lib/grading';
import { AssessmentCategory } from '@prisma/client';
import { createAssessmentSchema, saveStudentGradesSchema } from '../src/actions/grading';

console.log('--- STARTING ADVERSARIAL STRESS TEST FOR MILESTONE 4 GRADING ---');

let failureCount = 0;
function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`[FAIL] ${testName}: ${detail || 'Assertion failed'}`);
    failureCount++;
  } else {
    console.log(`[PASS] ${testName}`);
  }
}

// 1. Stress Test clampScore
assert(clampScore(100.0001) === 100, 'clampScore(100.0001) clamps to 100');
assert(clampScore(-0.0001) === 0, 'clampScore(-0.0001) clamps to 0');
assert(clampScore(Infinity) === 100, 'clampScore(Infinity) clamps to 100');
assert(clampScore(-Infinity) === 0, 'clampScore(-Infinity) clamps to 0');
assert(clampScore(NaN) === 0, 'clampScore(NaN) defaults to min (0)');
assert(clampScore('  89,75  ') === 89.75, 'clampScore trims whitespace and handles Indonesian comma');
assert(clampScore('invalid') === 0, 'clampScore("invalid") returns min (0)');
assert(clampScore(0.1 + 0.2) === 0.3, 'clampScore(0.1 + 0.2) handles floating precision to 0.3');

// 2. Stress Test evaluateKkm
const boundaryExact = evaluateKkm(75.0, 75.0);
assert(boundaryExact.isPassed && boundaryExact.delta === 0 && boundaryExact.formattedDelta === '+0.0', 'evaluateKkm exact KKM boundary');

const boundaryMinusDelta = evaluateKkm(74.99, 75.0);
assert(!boundaryMinusDelta.isPassed && boundaryMinusDelta.delta === -0.01 && boundaryMinusDelta.formattedDelta === '-0.0', 'evaluateKkm marginal failure boundary');

const stringCommaKkm = evaluateKkm('78,5', '75,0');
assert(stringCommaKkm.isPassed && stringCommaKkm.delta === 3.5 && stringCommaKkm.formattedDelta === '+3.5', 'evaluateKkm with string and comma inputs');

const zeroScore = evaluateKkm(0, 75);
assert(!zeroScore.isPassed && zeroScore.isGraded && zeroScore.delta === -75 && zeroScore.formattedDelta === '-75.0', 'evaluateKkm zero score');

const emptyStringScore = evaluateKkm('', 75);
assert(!emptyStringScore.isGraded && emptyStringScore.statusLabel === 'Belum Dinilai', 'evaluateKkm empty string score');

const whitespaceScore = evaluateKkm('   ', 75);
assert(!whitespaceScore.isGraded && whitespaceScore.statusLabel === 'Belum Dinilai', 'evaluateKkm whitespace string score');

// 3. Stress Test calculateGradeStats
const emptyStats = calculateGradeStats([], 75);
assert(
  emptyStats.total === 0 &&
  emptyStats.gradedCount === 0 &&
  emptyStats.average === 0 &&
  emptyStats.highest === 0 &&
  emptyStats.lowest === 0 &&
  emptyStats.passingRate === 0,
  'calculateGradeStats on empty array handles 0 safely without Infinity/-Infinity'
);

const allNullStats = calculateGradeStats([null, undefined, null], 75);
assert(
  allNullStats.total === 3 &&
  allNullStats.gradedCount === 0 &&
  allNullStats.passedCount === 0 &&
  allNullStats.remedialCount === 0 &&
  allNullStats.average === 0,
  'calculateGradeStats on all-null array'
);

const largeArray: (number | null)[] = [];
for (let i = 0; i < 5000; i++) {
  largeArray.push(i % 2 === 0 ? 80 : 60);
}
const perfStats = calculateGradeStats(largeArray, 75);
assert(perfStats.total === 5000 && perfStats.gradedCount === 5000 && perfStats.average === 70, 'calculateGradeStats 5000 items scale test');

// 4. Stress Test applyRemedialCapping
const failedRemedial = applyRemedialCapping(40, 60, 75, 'CAP_AT_KKM');
assert(failedRemedial.finalScore === 60 && failedRemedial.note.includes('Remedial belum tuntas'), 'applyRemedialCapping when remedial score is still below KKM');

const passedCapped = applyRemedialCapping(40, 95, 75, 'CAP_AT_KKM');
assert(passedCapped.finalScore === 75 && passedCapped.note.includes('disesuaikan batas KKM'), 'applyRemedialCapping CAP_AT_KKM caps at 75');

const weightedRemedial = applyRemedialCapping(50, 80, 75, 'WEIGHTED_AVERAGE');
// 50 * 0.4 + 80 * 0.6 = 20 + 48 = 68
assert(weightedRemedial.finalScore === 68, 'applyRemedialCapping WEIGHTED_AVERAGE calculates 40:60');

const actualRemedial = applyRemedialCapping(50, 95, 75, 'ACTUAL_SCORE');
assert(actualRemedial.finalScore === 95, 'applyRemedialCapping ACTUAL_SCORE retains full score');

// 5. Stress Test getAchievementPredicate
assert(getAchievementPredicate(100, 75).predicate === 'A', 'getAchievementPredicate(100) -> A');
assert(getAchievementPredicate(75, 75).predicate === 'C', 'getAchievementPredicate(75) -> C');
assert(getAchievementPredicate(74.9, 75).predicate === 'D', 'getAchievementPredicate(74.9) -> D');

// 6. Stress Test Zod Schemas for Actions
const validAssessmentInput = {
  classId: '11111111-1111-4111-a111-111111111111',
  subjectId: '22222222-2222-4222-a222-222222222222',
  teacherId: '33333333-3333-4333-a333-333333333333',
  title: 'Ulangan Harian Bab 1',
  category: AssessmentCategory.UH,
  assessmentDate: '2026-11-04',
  maxScore: 100,
};
assert(createAssessmentSchema.safeParse(validAssessmentInput).success, 'createAssessmentSchema accepts valid input');

const invalidTitle = { ...validAssessmentInput, title: 'UH' }; // < 3 chars
assert(!createAssessmentSchema.safeParse(invalidTitle).success, 'createAssessmentSchema rejects title < 3 chars');

const invalidMaxScore = { ...validAssessmentInput, maxScore: 150 };
assert(!createAssessmentSchema.safeParse(invalidMaxScore).success, 'createAssessmentSchema rejects maxScore > 100');

const emptyGrades = {
  assessmentId: '11111111-1111-4111-a111-111111111111',
  grades: [],
};
assert(!saveStudentGradesSchema.safeParse(emptyGrades).success, 'saveStudentGradesSchema rejects empty grades array');

const outOfBoundsGrade = {
  assessmentId: '11111111-1111-4111-a111-111111111111',
  grades: [
    { studentId: '22222222-2222-4222-a222-222222222222', score: 105 },
  ],
};
assert(!saveStudentGradesSchema.safeParse(outOfBoundsGrade).success, 'saveStudentGradesSchema rejects score > 100');

// 7. Clipboard Parsing Simulation
function simulatePasteTokens(pasteData: string): number[] {
  const rawTokens = pasteData
    .split(/\r\n|\n|\r/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  
  return rawTokens
    .map((t) => {
      const sanitized = t.replace(',', '.');
      const num = parseFloat(sanitized);
      return isNaN(num) ? null : clampScore(num, 0, 100);
    })
    .filter((n): n is number => n !== null);
}

const excelTsvPaste = '85,5\r\n90\r\n74,2\r\n100\r\n';
const parsedTsv = simulatePasteTokens(excelTsvPaste);
assert(parsedTsv.length === 4 && parsedTsv[0] === 85.5 && parsedTsv[2] === 74.2, 'Simulated Excel CRLF paste with Indonesian comma parses cleanly');

const mixedCorruptPaste = '80\nN/A\n90\n-5\n150\n';
const parsedCorrupt = simulatePasteTokens(mixedCorruptPaste);
assert(parsedCorrupt.length === 4 && parsedCorrupt[2] === 0 && parsedCorrupt[3] === 100, 'Corrupt paste sanitizes and clamps out-of-bounds tokens');

console.log('--- ADVERSARIAL STRESS TEST SUMMARY ---');
console.log(`Total Failures: ${failureCount}`);
if (failureCount > 0) {
  process.exit(1);
} else {
  console.log('ADVERSARIAL_M4_STRESS_TEST_PASSED');
}
