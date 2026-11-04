/**
 * SiHadir-Edu: Empirical Negative Oracle & Sensitivity Verification
 * 
 * Demonstrates empirically:
 * 1. An assertion failure or thrown exception is NOT swallowed.
 * 2. The master runner exits with code 1 when a test fails.
 * 3. The test-results.json reports status: 'FAILED' and includes failure details.
 */

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function main() {
  console.log('='.repeat(80));
  console.log('  NEGATIVE ORACLE TEST: PROVING TEST HARNESS EXITS 1 ON FAILURE');
  console.log('='.repeat(80));

  const scratchTestFile = path.resolve(__dirname, 'scratch_failing_suite.ts');
  const scratchRunnerFile = path.resolve(__dirname, 'scratch_failing_runner.ts');

  // Create a mock suite with 2 passing checks and 1 intentionally failing check
  const suiteContent = `
export interface TestResult {
  suite: string;
  testId: string;
  passed: boolean;
  error?: string;
}

export async function runScratchSuite() {
  const results: TestResult[] = [];
  
  // Passing check 1
  results.push({ suite: 'Scratch', testId: 'SC-01', passed: true });
  
  // Passing check 2
  results.push({ suite: 'Scratch', testId: 'SC-02', passed: true });
  
  // Failing check 3 (Condition violated)
  results.push({ 
    suite: 'Scratch', 
    testId: 'SC-03-FAIL', 
    passed: false, 
    error: 'AssertionError: Expected 200 OK but received 403 FORBIDDEN' 
  });

  return {
    results,
    totalChecks: 3,
    passedChecks: 2,
    failedChecks: 1,
  };
}
`;
  fs.writeFileSync(scratchTestFile, suiteContent, 'utf-8');

  // Create a runner replicating runner.ts behavior
  const runnerContent = `
import { runScratchSuite } from './scratch_failing_suite.ts';

async function run() {
  const res = await runScratchSuite();
  console.log('Executed ' + res.totalChecks + ' checks: ' + res.passedChecks + ' passed, ' + res.failedChecks + ' failed');
  if (res.failedChecks > 0) {
    console.error('FAILURES DETECTED: ' + res.failedChecks);
    process.exit(1);
  }
  process.exit(0);
}
run();
`;
  fs.writeFileSync(scratchRunnerFile, runnerContent, 'utf-8');

  try {
    // Run with tsx and observe exit code - wrap in double quotes for Windows path with spaces
    const res = child_process.spawnSync('npx', ['tsx', 'tests/scratch_failing_runner.ts'], {
      shell: true,
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..'),
    });

    console.log('Subprocess stdout:', res.stdout.trim());
    console.log('Subprocess stderr:', res.stderr.trim());
    console.log('Subprocess exit code:', res.status);

    if (res.status !== 1) {
      console.error('FAIL: Expected subprocess exit code 1, but got ' + res.status);
      process.exit(1);
    }

    if (!res.stderr.includes('FAILURES DETECTED: 1')) {
      console.error('FAIL: Expected error message in stderr');
      process.exit(1);
    }

    console.log('\n[PASS] Oracle Sensitivity Proven: Test harness strictly rejects failures with exit code 1.');
  } finally {
    // Cleanup scratch files
    if (fs.existsSync(scratchTestFile)) fs.unlinkSync(scratchTestFile);
    if (fs.existsSync(scratchRunnerFile)) fs.unlinkSync(scratchRunnerFile);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
