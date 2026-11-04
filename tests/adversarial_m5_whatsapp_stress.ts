/**
 * EMPIRICAL CHALLENGER ADVERSARIAL STRESS HARNESS: MILESTONE 5 (F5.1 - F5.4)
 * Adversarial Fuzzing, Spintax DoS/ReDoS Stress, Jitter Distribution & Priority Queue Tests
 */

import { db } from '../src/lib/db';
import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  resolveSpintax,
  interpolateVariables,
  formatWaMessage,
  calculateRandomJitterMs,
  getPriorityWeight,
  processWaNotificationQueue,
  MockGatewayClient,
  WaGatewayClient,
  TEMPLATE_GATE_LATE,
  TEMPLATE_GATE_IN,
  TEMPLATE_ABSENT_BOLOS,
  TEMPLATE_DAILY_DIGEST,
  TEMPLATE_GRADE_UPDATE,
} from '../src/lib/whatsapp';
import { WaNotifType, WaStatus } from '@prisma/client';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  details: string;
}

const testResults: TestResult[] = [];

function record(
  suite: string,
  name: string,
  passed: boolean,
  details: string,
  expected?: any,
  actual?: any
) {
  testResults.push({ suite, name, passed, expected, actual, details });
  const badge = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${badge} [${suite}] ${name}: ${details}`);
  if (!passed) {
    if (expected !== undefined) console.log(`       Expected:`, expected);
    if (actual !== undefined) console.log(`       Actual:  `, actual);
  }
}

// ==============================================================================
// 1. ADVERSARIAL FUZZING: normalizeIndonesianPhone & isValidIndonesianPhone
// ==============================================================================
function testPhoneNormalizerFuzzing() {
  console.log('\n================================================================');
  console.log('1. FUZZING normalizeIndonesianPhone & isValidIndonesianPhone');
  console.log('================================================================');

  const fuzzCases: Array<{
    input: any;
    expectedNorm: string;
    expectedValid: boolean;
    desc: string;
  }> = [
    // Spaces, dashes, parentheses
    { input: ' 0812 3456 7890 ', expectedNorm: '6281234567890', expectedValid: true, desc: 'Leading/trailing/inner spaces' },
    { input: '0812-3456-7890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Hyphens between segments' },
    { input: '(0812) 3456-7890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Parentheses around area code' },
    { input: '(+62) 812 3456 7890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Parentheses around +62 prefix' },
    { input: '\t0812\n3456\r7890\t', expectedNorm: '6281234567890', expectedValid: true, desc: 'Tabs, newlines, carriage returns' },

    // Prefix variations
    { input: '+6281234567890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Standard E.164 with +62' },
    { input: '6281234567890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Already normalized 628' },
    { input: '081234567890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Domestic 08 format' },
    { input: '81234567890', expectedNorm: '6281234567890', expectedValid: true, desc: 'Bare 8 format' },

    // Malformed and garbage strings
    { input: 'abc081234567890xyz', expectedNorm: '6281234567890', expectedValid: true, desc: 'Alphanumeric wrapper around valid digits' },
    { input: 'no-digits-at-all', expectedNorm: '', expectedValid: false, desc: 'Pure alphabetic string' },
    { input: '!@#$%^&*()_{}:"?><', expectedNorm: '', expectedValid: false, desc: 'Pure punctuation string' },
    { input: 'DROP TABLE wa_notification_logs;', expectedNorm: '', expectedValid: false, desc: 'SQL injection string' },
    { input: '<script>alert(1)</script>', expectedNorm: '1', expectedValid: false, desc: 'XSS script injection string' },

    // Length edge cases
    { input: '', expectedNorm: '', expectedValid: false, desc: 'Empty string' },
    { input: '0', expectedNorm: '62', expectedValid: false, desc: 'Single digit 0' },
    { input: '8', expectedNorm: '628', expectedValid: false, desc: 'Single digit 8' },
    { input: '08', expectedNorm: '628', expectedValid: false, desc: 'Short 08' },
    { input: '081234567', expectedNorm: '6281234567', expectedValid: false, desc: 'Too short (9 digits: 628 + 7)' },
    { input: '0812345678', expectedNorm: '62812345678', expectedValid: true, desc: 'Min valid mobile (10 digits: 628 + 8)' },
    { input: '08123456789012', expectedNorm: '628123456789012', expectedValid: true, desc: 'Max valid mobile (14 digits: 628 + 12)' },
    { input: '081234567890123', expectedNorm: '6281234567890123', expectedValid: false, desc: 'Too long (15 digits: 628 + 13)' },
    { input: '08' + '9'.repeat(1000), expectedNorm: '628' + '9'.repeat(1000), expectedValid: false, desc: 'Extreme 1000-char string without crashing' },
  ];

  for (const c of fuzzCases) {
    const norm = normalizeIndonesianPhone(c.input);
    const valid = isValidIndonesianPhone(c.input);

    const normPass = norm === c.expectedNorm;
    const validPass = valid === c.expectedValid;

    record(
      'PHONE_FUZZ',
      `normalize(${c.desc})`,
      normPass,
      `Output: '${norm.length > 30 ? norm.substring(0, 30) + '...' : norm}'`,
      c.expectedNorm,
      norm
    );

    record(
      'PHONE_FUZZ',
      `isValid(${c.desc})`,
      validPass,
      `Validation: ${valid}`,
      c.expectedValid,
      valid
    );
  }
}

// ==============================================================================
// 2. ADVERSARIAL FUZZING: resolveSpintax (Deep Nesting, DoS, ReDoS, Hangs)
// ==============================================================================
function testSpintaxFuzzingAndStress() {
  console.log('\n================================================================');
  console.log('2. ADVERSARIAL FUZZING: resolveSpintax & formatWaMessage');
  console.log('================================================================');

  // 1. Nested Spintax: 5 levels deep
  const nested5 = '{A|{B|{C|{D|{E|TARGET_5}}}}}';
  const resolved5Min = resolveSpintax(nested5, () => 0.0); // always first
  const resolved5Max = resolveSpintax(nested5, () => 0.999); // always last -> TARGET_5
  record(
    'SPINTAX_NESTING',
    '5 Levels Deep Nesting (Min Choice)',
    resolved5Min === 'A',
    `Resolved to '${resolved5Min}'`,
    'A',
    resolved5Min
  );
  record(
    'SPINTAX_NESTING',
    '5 Levels Deep Nesting (Max Choice)',
    resolved5Max === 'TARGET_5',
    `Resolved to '${resolved5Max}'`,
    'TARGET_5',
    resolved5Max
  );

  // 2. Nested Spintax: 10 levels deep
  const nested10 = '{L1|{L2|{L3|{L4|{L5|{L6|{L7|{L8|{L9|{L10|TARGET_10}}}}}}}}}}';
  const resolved10 = resolveSpintax(nested10, () => 0.999);
  record(
    'SPINTAX_NESTING',
    '10 Levels Deep Nesting (Target Traversal)',
    resolved10 === 'TARGET_10',
    `Resolved 10 levels to '${resolved10}'`,
    'TARGET_10',
    resolved10
  );

  // 3. Safety Guard: 25 levels deep (must terminate within 20-iteration guard)
  let nested25 = 'DEEP_LEAF';
  for (let i = 25; i >= 1; i--) {
    nested25 = `{L${i}|${nested25}}`;
  }
  const startTimeGuard = Date.now();
  const resolved25 = resolveSpintax(nested25, () => 0.999);
  const guardDuration = Date.now() - startTimeGuard;
  record(
    'SPINTAX_GUARD',
    '25 Levels Deep Nesting Safety Guard (<20 loop cap, no stack overflow)',
    guardDuration < 100 && typeof resolved25 === 'string',
    `Handled 25 nested levels in ${guardDuration}ms without crashing or hanging`
  );

  // 4. Empty Options & Malformed Edge Cases
  const emptyOptions = resolveSpintax('{||}', () => 0.5);
  record(
    'SPINTAX_EDGE',
    'Empty Options {||}',
    emptyOptions === '',
    `Resolved empty options to empty string: '${emptyOptions}'`,
    '',
    emptyOptions
  );

  const singleOption = resolveSpintax('{ONLY_CHOICE}', () => 0.0);
  record(
    'SPINTAX_EDGE',
    'Single Option {ONLY_CHOICE}',
    singleOption === 'ONLY_CHOICE',
    `Resolved single option to '${singleOption}'`,
    'ONLY_CHOICE',
    singleOption
  );

  const unclosed = resolveSpintax('{unclosed_bracket_here', () => 0.5);
  record(
    'SPINTAX_EDGE',
    'Unclosed Bracket {unclosed',
    unclosed === '{unclosed_bracket_here',
    `Safely returned unclosed template without infinite loop: '${unclosed}'`
  );

  const unopened = resolveSpintax('unopened_bracket_here}', () => 0.5);
  record(
    'SPINTAX_EDGE',
    'Unopened Bracket unopened}',
    unopened === 'unopened_bracket_here}',
    `Safely returned unopened bracket: '${unopened}'`
  );

  // 5. Special Characters & Regex Replacement Invariance
  const specialChars = resolveSpintax('{foo$1|bar$2}', () => 0.0);
  record(
    'SPINTAX_EDGE',
    'Special Dollar Regex Token {foo$1|bar$2}',
    specialChars === 'foo$1',
    `Preserved literal dollar signs without regex back-reference corruption: '${specialChars}'`,
    'foo$1',
    specialChars
  );

  // 6. Massive Template Stress Test (1,000 spintax blocks, 15KB template)
  let massiveTemplate = 'HEADER ';
  for (let i = 0; i < 1000; i++) {
    massiveTemplate += `{optA_${i}|optB_${i}|optC_${i}} `;
  }
  massiveTemplate += 'FOOTER';

  const tStart = Date.now();
  const massiveResolved = resolveSpintax(massiveTemplate);
  const tEnd = Date.now();
  const massiveDuration = tEnd - tStart;

  record(
    'SPINTAX_STRESS',
    'Massive Template (1,000 Spintax Blocks)',
    massiveDuration < 500 && massiveResolved.startsWith('HEADER') && massiveResolved.endsWith('FOOTER'),
    `Resolved 1,000 blocks in ${massiveDuration}ms (<500ms threshold)`
  );
}

// ==============================================================================
// 3. STRESS TEST: calculateRandomJitterMs (1,000 iterations, bounds, uniformity)
// ==============================================================================
function testJitterDistributionStress() {
  console.log('\n================================================================');
  console.log('3. STRESS TEST: calculateRandomJitterMs (1,000 Iterations)');
  console.log('================================================================');

  const minSec = 4;
  const maxSec = 10;
  const minMs = minSec * 1000;
  const maxMs = maxSec * 1000;
  const iterations = 1000;

  const samples: number[] = [];
  let outOfBoundsCount = 0;
  let sum = 0;

  for (let i = 0; i < iterations; i++) {
    const val = calculateRandomJitterMs(minSec, maxSec);
    samples.push(val);
    sum += val;
    if (val < minMs || val > maxMs) {
      outOfBoundsCount++;
    }
  }

  const mean = sum / iterations;
  const theoreticalMean = (minMs + maxMs) / 2; // 7000ms

  // Variance & Standard Deviation
  let varianceSum = 0;
  for (const s of samples) {
    varianceSum += Math.pow(s - mean, 2);
  }
  const variance = varianceSum / iterations;
  const stdDev = Math.sqrt(variance);
  // Theoretical std dev for uniform continuous interval (b-a) / sqrt(12) = 6000 / 3.4641 ≈ 1732
  const theoreticalStdDev = (maxMs - minMs) / Math.sqrt(12);

  record(
    'JITTER_STRESS',
    '100% Values Strictly Within [minMs, maxMs]',
    outOfBoundsCount === 0,
    `Tested ${iterations} samples. Out of bounds: ${outOfBoundsCount} (0 expected)`,
    0,
    outOfBoundsCount
  );

  const meanDelta = Math.abs(mean - theoreticalMean);
  const meanWithin3Percent = meanDelta <= theoreticalMean * 0.05; // within 5% of 7000 is [6650, 7350]
  record(
    'JITTER_STRESS',
    'Mean Distribution Uniformity',
    meanWithin3Percent,
    `Empirical mean: ${mean.toFixed(2)}ms (Theoretical: ${theoreticalMean}ms, delta: ${meanDelta.toFixed(2)}ms)`
  );

  const stdDelta = Math.abs(stdDev - theoreticalStdDev);
  record(
    'JITTER_STRESS',
    'Standard Deviation Spread Check',
    stdDelta <= theoreticalStdDev * 0.15, // within 15%
    `Empirical stdDev: ${stdDev.toFixed(2)}ms (Theoretical: ${theoreticalStdDev.toFixed(2)}ms)`
  );

  // Boundary condition: min === max
  const exactVal = calculateRandomJitterMs(5, 5);
  record(
    'JITTER_EDGE',
    'Identical Bounds minSec === maxSec',
    exactVal === 5000,
    `calculateRandomJitterMs(5, 5) returned ${exactVal}ms (5000 expected)`,
    5000,
    exactVal
  );

  // Inverted condition: min > max
  const invertedVal = calculateRandomJitterMs(10, 4);
  record(
    'JITTER_EDGE',
    'Inverted Bounds minSec > maxSec',
    invertedVal === 10000,
    `calculateRandomJitterMs(10, 4) safely returned minSec*1000 = ${invertedVal}ms`,
    10000,
    invertedVal
  );
}

// ==============================================================================
// 4. PRIORITY QUEUE CHALLENGE: Tier 1 URGENT vs Tier 2 NORMAL
// ==============================================================================
async function testPriorityQueueChallenge() {
  console.log('\n================================================================');
  console.log('4. PRIORITY QUEUE CHALLENGE: Mixed Tiers & Staggered scheduledAt');
  console.log('================================================================');

  // Verify priority weights
  record('PRIORITY_WEIGHTS', 'GATE_LATE is Tier 1', getPriorityWeight(WaNotifType.GATE_LATE) === 1, 'Weight: 1');
  record('PRIORITY_WEIGHTS', 'ABSENT_ALERT is Tier 1', getPriorityWeight(WaNotifType.ABSENT_ALERT) === 1, 'Weight: 1');
  record('PRIORITY_WEIGHTS', 'GATE_IN is Tier 2', getPriorityWeight(WaNotifType.GATE_IN) === 2, 'Weight: 2');
  record('PRIORITY_WEIGHTS', 'GRADE_UPDATE is Tier 2', getPriorityWeight(WaNotifType.GRADE_UPDATE) === 2, 'Weight: 2');
  record('PRIORITY_WEIGHTS', 'DAILY_DIGEST is Tier 2', getPriorityWeight(WaNotifType.DAILY_DIGEST) === 2, 'Weight: 2');

  // In-Memory Mock Database for processWaNotificationQueue
  const mockQueue: any[] = [];

  const mockDbPrisma: any = {
    waNotificationLog: {
      findMany: async (args: any) => {
        // Filter by status QUEUED and scheduledAt <= now
        const now = new Date();
        const queued = mockQueue.filter(
          (item) => item.status === WaStatus.QUEUED && item.scheduledAt <= now
        );
        // Sort by scheduledAt asc (as prisma does in implementation)
        queued.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
        return queued.slice(0, args.take || 20);
      },
      update: async (args: any) => {
        const item = mockQueue.find((q) => q.id === args.where.id);
        if (item) {
          Object.assign(item, args.data);
        }
        return item;
      },
    },
  };

  Object.assign(db, mockDbPrisma);

  // Adversarial Construction:
  // Tier 2 messages are inserted FIRST with EARLIER scheduledAt (07:00, 07:05, 07:10)
  // Tier 1 messages are inserted LAST with LATER scheduledAt (07:20, 07:25)
  // Regardless of insertion order and scheduledAt, Tier 1 MUST be dispatched BEFORE Tier 2!
  const baseTime = new Date('2026-11-04T07:00:00Z');
  const t0 = new Date(baseTime.getTime());
  const t1 = new Date(baseTime.getTime() + 5 * 60000);
  const t2 = new Date(baseTime.getTime() + 10 * 60000);
  const t3 = new Date(baseTime.getTime() + 20 * 60000);
  const t4 = new Date(baseTime.getTime() + 25 * 60000);

  mockQueue.length = 0;
  mockQueue.push(
    {
      id: 'msg-norm-digest',
      studentId: 'std-1',
      targetPhone: '081234567801',
      notifType: WaNotifType.DAILY_DIGEST, // Tier 2
      messageBody: 'Digest Info',
      status: WaStatus.QUEUED,
      scheduledAt: t0, // Earliest!
    },
    {
      id: 'msg-norm-grade',
      studentId: 'std-2',
      targetPhone: '081234567802',
      notifType: WaNotifType.GRADE_UPDATE, // Tier 2
      messageBody: 'Grade Update',
      status: WaStatus.QUEUED,
      scheduledAt: t1,
    },
    {
      id: 'msg-norm-gate-in',
      studentId: 'std-3',
      targetPhone: '081234567803',
      notifType: WaNotifType.GATE_IN, // Tier 2
      messageBody: 'Hadir Tepat Waktu',
      status: WaStatus.QUEUED,
      scheduledAt: t2,
    },
    {
      id: 'msg-urg-late',
      studentId: 'std-4',
      targetPhone: '081234567804',
      notifType: WaNotifType.GATE_LATE, // Tier 1 URGENT
      messageBody: 'Peringatan Terlambat',
      status: WaStatus.QUEUED,
      scheduledAt: t3, // Later than normal!
    },
    {
      id: 'msg-urg-absent',
      studentId: 'std-5',
      targetPhone: '081234567805',
      notifType: WaNotifType.ABSENT_ALERT, // Tier 1 URGENT
      messageBody: 'Peringatan Bolos',
      status: WaStatus.QUEUED,
      scheduledAt: t4, // Latest!
    }
  );

  MockGatewayClient.clear();
  const mockClient = new MockGatewayClient();

  // Run queue processor with 0 delay for fast deterministic execution
  const processResult = await processWaNotificationQueue({
    batchSize: 10,
    maxDurationMs: 10000,
    client: mockClient,
    minJitterSec: 0,
    maxJitterSec: 0,
  });

  const sentLogs = MockGatewayClient.getSentMessages();
  const sentTypes = sentLogs.map((m) => m.notifType);

  // Assertions:
  // 1. All 5 messages were dispatched
  record(
    'PRIORITY_DISPATCH',
    'All 5 Mixed Messages Processed',
    processResult.processedCount === 5 && sentLogs.length === 5,
    `Processed: ${processResult.processedCount}, Sent: ${sentLogs.length}`
  );

  // 2. First 2 sent messages MUST be Tier 1 URGENT
  const firstIsUrgent = sentTypes[0] === WaNotifType.GATE_LATE || sentTypes[0] === WaNotifType.ABSENT_ALERT;
  const secondIsUrgent = sentTypes[1] === WaNotifType.GATE_LATE || sentTypes[1] === WaNotifType.ABSENT_ALERT;
  record(
    'PRIORITY_DISPATCH',
    'Position 0 is Tier 1 URGENT',
    firstIsUrgent,
    `Sent at pos 0: ${sentTypes[0]}`
  );
  record(
    'PRIORITY_DISPATCH',
    'Position 1 is Tier 1 URGENT',
    secondIsUrgent,
    `Sent at pos 1: ${sentTypes[1]}`
  );

  // 3. Positions 2, 3, 4 MUST be Tier 2 NORMAL
  const remainingAreTier2 = [sentTypes[2], sentTypes[3], sentTypes[4]].every(
    (t) => t === WaNotifType.DAILY_DIGEST || t === WaNotifType.GRADE_UPDATE || t === WaNotifType.GATE_IN
  );
  record(
    'PRIORITY_DISPATCH',
    'Positions 2..4 are Tier 2 NORMAL',
    remainingAreTier2,
    `Sent at pos 2..4: ${sentTypes.slice(2).join(', ')}`
  );

  // 4. FIFO tie-breaking within Tier 1: t3 (GATE_LATE) was before t4 (ABSENT_ALERT)
  record(
    'PRIORITY_DISPATCH',
    'FIFO Tie-Breaking within Tier 1',
    sentTypes[0] === WaNotifType.GATE_LATE && sentTypes[1] === WaNotifType.ABSENT_ALERT,
    `Tier 1 sequence: ${sentTypes[0]} -> ${sentTypes[1]}`
  );

  // 5. FIFO tie-breaking within Tier 2: t0 (DAILY_DIGEST) -> t1 (GRADE_UPDATE) -> t2 (GATE_IN)
  record(
    'PRIORITY_DISPATCH',
    'FIFO Tie-Breaking within Tier 2',
    sentTypes[2] === WaNotifType.DAILY_DIGEST &&
      sentTypes[3] === WaNotifType.GRADE_UPDATE &&
      sentTypes[4] === WaNotifType.GATE_IN,
    `Tier 2 sequence: ${sentTypes.slice(2).join(' -> ')}`
  );
}

// ==============================================================================
// 5. SERVERLESS TIMEOUT CEILING TEST: Graceful Yield Under Time Pressure
// ==============================================================================
async function testServerlessTimeoutCeiling() {
  console.log('\n================================================================');
  console.log('5. SERVERLESS TIMEOUT CEILING TEST: Graceful Yield Without Crash');
  console.log('================================================================');

  // Client that simulates 40ms network latency per message send
  class LatencyMockClient implements WaGatewayClient {
    public readonly providerType = 'MOCK' as const;
    public sendCount = 0;

    public async sendMessage(options: any) {
      await new Promise((r) => setTimeout(r, 40));
      this.sendCount++;
      return {
        success: true,
        provider: 'MOCK' as const,
        messageId: `slow_${this.sendCount}`,
        timestamp: new Date(),
      };
    }
    public async checkHealth() {
      return { healthy: true };
    }
  }

  const slowClient = new LatencyMockClient();
  const timeoutQueue: any[] = [];
  const now = new Date();

  // Populate queue with 10 pending items
  for (let i = 0; i < 10; i++) {
    timeoutQueue.push({
      id: `timeout-msg-${i}`,
      studentId: `std-${i}`,
      targetPhone: '081234567890',
      notifType: WaNotifType.GATE_IN,
      messageBody: `Message ${i}`,
      status: WaStatus.QUEUED,
      scheduledAt: now,
    });
  }

  const mockDbPrisma: any = {
    waNotificationLog: {
      findMany: async () => [...timeoutQueue],
      update: async (args: any) => {
        const item = timeoutQueue.find((q) => q.id === args.where.id);
        if (item) Object.assign(item, args.data);
        return item;
      },
    },
  };

  Object.assign(db, mockDbPrisma);

  // Set timeout ceiling to 75ms (enough for ~2 messages of 40ms each)
  const ceilingMs = 75;
  const startTime = Date.now();

  let yieldedCleanly = false;
  let result: any = null;
  let thrownError: any = null;

  try {
    result = await processWaNotificationQueue({
      batchSize: 10,
      maxDurationMs: ceilingMs,
      client: slowClient,
      minJitterSec: 0,
      maxJitterSec: 0,
    });
    yieldedCleanly = true;
  } catch (err) {
    thrownError = err;
  }

  const totalTime = Date.now() - startTime;

  record(
    'TIMEOUT_CEILING',
    'Yields Gracefully Without Uncaught Exception',
    yieldedCleanly && thrownError === null,
    `Error: ${thrownError ? thrownError.message : 'None (clean exit)'}`
  );

  record(
    'TIMEOUT_CEILING',
    'Yielded At Or Near Execution Ceiling',
    result !== null && result.processedCount < 10 && result.processedCount >= 1,
    `Processed ${result?.processedCount}/10 messages before ceiling (${result?.durationMs}ms recorded, real: ${totalTime}ms)`
  );

  const remainingQueued = timeoutQueue.filter((m) => m.status === WaStatus.QUEUED).length;
  record(
    'TIMEOUT_CEILING',
    'Unprocessed Messages Remain Safely in QUEUED Status',
    remainingQueued > 0 && remainingQueued + result.processedCount === 10,
    `Remaining QUEUED in DB: ${remainingQueued}, Sent: ${result.sentCount}`
  );
}

// ==============================================================================
// RUN ALL ADVERSARIAL STRESS SUITES
// ==============================================================================
async function main() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS HARNESS (M5 WHATSAPP)');
  console.log('================================================================');

  try {
    testPhoneNormalizerFuzzing();
    testSpintaxFuzzingAndStress();
    testJitterDistributionStress();
    await testPriorityQueueChallenge();
    await testServerlessTimeoutCeiling();
  } catch (err) {
    console.error('CRITICAL UNHANDLED ERROR IN HARNESS:', err);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('EMPIRICAL ADVERSARIAL STRESS HARNESS SUMMARY:');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Checks : ${total}`);
  console.log(`Passed       : ${passed}`);
  console.log(`Failed       : ${failed}`);
  console.log(`Verdict      : ${failed === 0 ? 'APPROVE' : 'REJECT'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`💥 FAILURE: ${failed} stress tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED!');
    process.exit(0);
  }
}

main();
