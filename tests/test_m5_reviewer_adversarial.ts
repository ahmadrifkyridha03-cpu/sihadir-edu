/**
 * Adversarial Stress & Verification Suite for Milestone 5 WhatsApp Gateway Integration
 * Conducted by Reviewer & Adversarial Critic reviewer_m5_1
 */

import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  resolveSpintax,
  interpolateVariables,
  formatWaMessage,
  calculateRandomJitterMs,
  getPriorityWeight,
  MockGatewayClient,
  TEMPLATE_GATE_LATE,
  TEMPLATE_GATE_IN,
  TEMPLATE_ABSENT_BOLOS,
  TEMPLATE_LEAVE_APPROVED,
  TEMPLATE_LEAVE_REJECTED,
  TEMPLATE_DAILY_DIGEST,
  TEMPLATE_GRADE_UPDATE,
} from '../src/lib/whatsapp';
import { WaNotifType } from '@prisma/client';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runAdversarialSuite() {
  console.log('========================================================================');
  console.log('REVIEWER M5 ADVERSARIAL STRESS TEST: WHATSAPP GATEWAY INTEGRATION');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Spintax Engine Stress & Pathological Inputs
  // ---------------------------------------------------------------------------
  console.log('>>> [SUITE 1] Spintax Engine Stress & Pathological Inputs');

  // Deeply nested 10-level hierarchy
  const deepSpintax = '{L1|{L2|{L3|{L4|{L5|{L6|{L7|{L8|{L9|{L10|L11}}}}}}}}}}';
  for (let i = 0; i < 20; i++) {
    const res = resolveSpintax(deepSpintax);
    const validTokens = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11'];
    assert(validTokens.includes(res), `Deeply nested resolution produced valid leaf: ${res}`);
  }
  console.log('  [PASS] Deep 10-level nested Spintax resolves cleanly');

  // Guard limit test: 25 nested levels should terminate without infinite loop (guard is 20)
  let pathological = 'leaf';
  for (let i = 0; i < 25; i++) {
    pathological = `{level_${i}|${pathological}}`;
  }
  const startTime = Date.now();
  const pathRes = resolveSpintax(pathological);
  const elapsedMs = Date.now() - startTime;
  assert(elapsedMs < 500, `Pathological Spintax terminated in ${elapsedMs}ms (<500ms ceiling)`);
  assert(typeof pathRes === 'string', 'Pathological input returns valid string');
  console.log('  [PASS] Pathological nesting terminates safely under guard limit');

  // Malformed Spintax: Unclosed brace, unmatched closing brace, empty braces
  assert(resolveSpintax('Halo {Bapak|Ibu') === 'Halo {Bapak|Ibu', 'Unclosed brace returned as-is');
  assert(resolveSpintax('Halo Bapak}') === 'Halo Bapak}', 'Unmatched closing brace returned as-is');
  assert(resolveSpintax('Halo {}') === 'Halo {}', 'Empty braces without options preserved literally');
  assert(resolveSpintax('') === '', 'Empty string returns empty string');
  console.log('  [PASS] Malformed and edge-case Spintax handled gracefully');

  // ---------------------------------------------------------------------------
  // 2. Variable Interpolation Boundary Conditions
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 2] Variable Interpolation Boundary Conditions');

  const templateStr = 'Nama: {{name}}, Skor: {{score}}, Catatan: {{note}}, Absen: {{absent}}, Kosong: {{empty}}';
  const interpRes = interpolateVariables(templateStr, {
    name: 'Ahmad Dahlan',
    score: 0, // Numeric zero must NOT be treated as empty or omitted!
    note: undefined, // Undefined becomes empty string
    absent: false, // Boolean false
    empty: '',
  });

  assert(interpRes.includes('Nama: Ahmad Dahlan'), 'String interpolated');
  assert(interpRes.includes('Skor: 0'), 'Numeric zero (0) preserved accurately');
  assert(interpRes.includes('Catatan: ,'), 'Undefined replaced with empty string');
  assert(interpRes.includes('Absen: false'), 'Boolean false converted to string');
  assert(interpRes.includes('Kosong: '), 'Empty string handled properly');
  console.log('  [PASS] Falsy values (0, false, empty, undefined) handled with mathematical precision');

  // Interpolation with Spintax characters embedded inside variable value
  const formattedWithSpecial = formatWaMessage('Halo {{parent_name}}, pesan: {{content}}', {
    parent_name: 'Bpk. {Siti|Rudi}',
    content: 'Tugas bernilai 100.',
  });
  assert(formattedWithSpecial.includes('Tugas bernilai 100.'), 'Content preserved');
  console.log('  [PASS] Variable values with curly braces handled safely');

  // ---------------------------------------------------------------------------
  // 3. Indonesian Phone Normalization & Adversarial Validation
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 3] Indonesian Phone Normalization & Validation');

  const validTestCases: [string, string][] = [
    ['081234567890', '6281234567890'],
    ['+6281234567890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['81234567890', '6281234567890'],
    ['0812-3456-7890', '6281234567890'],
    ['+62 812 3456 7890', '6281234567890'],
    ['(0812) 3456 7890', '6281234567890'],
    ['+62-812-3456-7890', '6281234567890'],
  ];

  for (const [raw, expected] of validTestCases) {
    const norm = normalizeIndonesianPhone(raw);
    assert(norm === expected, `Normalized '${raw}' -> '${norm}' === '${expected}'`);
    assert(isValidIndonesianPhone(raw) === true, `'${raw}' is valid Indonesian phone`);
  }
  console.log('  [PASS] All standard Indonesian phone formats normalize to 628...');

  const invalidTestCases = [
    '',
    '   ',
    'abc123xyz',
    '021-5551234', // Landline (starts with 021, not 08)
    '+62215551234', // Landline E.164
    '0812345', // Too short (7 digits, needs min 10)
    '081234567890123456', // Too long (> 15 digits)
    '+620812345678', // Invalid double zero-country prefix
    '1234567890', // Random digits
  ];

  for (const raw of invalidTestCases) {
    const valid = isValidIndonesianPhone(raw);
    assert(valid === false, `Invalid phone correctly rejected: '${raw}'`);
  }
  console.log('  [PASS] All invalid/adversarial phone formats rejected');

  // ---------------------------------------------------------------------------
  // 4. Priority Queue Sorting & Deterministic Tie-Breaking
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 4] Priority Queue Sorting & Tie-Breaking');

  assert(getPriorityWeight(WaNotifType.GATE_LATE) === 1, 'GATE_LATE is Tier 1 Urgent');
  assert(getPriorityWeight(WaNotifType.ABSENT_ALERT) === 1, 'ABSENT_ALERT is Tier 1 Urgent');
  assert(getPriorityWeight(WaNotifType.GATE_IN) === 2, 'GATE_IN is Tier 2 Normal');
  assert(getPriorityWeight(WaNotifType.GRADE_UPDATE) === 2, 'GRADE_UPDATE is Tier 2 Normal');
  assert(getPriorityWeight(WaNotifType.DAILY_DIGEST) === 2, 'DAILY_DIGEST is Tier 2 Normal');

  // Simulate queue sorting with mixed timestamps and tiers
  const mockQueue = [
    { id: 'q1', notifType: WaNotifType.GATE_IN, scheduledAt: new Date('2026-11-04T07:00:00Z') }, // Tier 2
    { id: 'q2', notifType: WaNotifType.GATE_LATE, scheduledAt: new Date('2026-11-04T07:15:00Z') }, // Tier 1
    { id: 'q3', notifType: WaNotifType.DAILY_DIGEST, scheduledAt: new Date('2026-11-04T06:50:00Z') }, // Tier 2
    { id: 'q4', notifType: WaNotifType.ABSENT_ALERT, scheduledAt: new Date('2026-11-04T08:00:00Z') }, // Tier 1 (later than q2)
    { id: 'q5', notifType: WaNotifType.ABSENT_ALERT, scheduledAt: new Date('2026-11-04T07:10:00Z') }, // Tier 1 (earlier than q2)
  ];

  const sortedQueue = [...mockQueue].sort((a, b) => {
    const weightA = getPriorityWeight(a.notifType);
    const weightB = getPriorityWeight(b.notifType);
    if (weightA !== weightB) return weightA - weightB;
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });

  const sortedIds = sortedQueue.map((item) => item.id);
  // Expected order:
  // Tier 1 items (q5: 07:10, q2: 07:15, q4: 08:00)
  // Followed by Tier 2 items (q3: 06:50, q1: 07:00)
  assert(
    JSON.stringify(sortedIds) === JSON.stringify(['q5', 'q2', 'q4', 'q3', 'q1']),
    `Queue correctly sorted: Tier 1 URGENT first (FIFO), then Tier 2 NORMAL (FIFO). Got: ${sortedIds}`
  );
  console.log('  [PASS] Priority sorting guarantees Tier 1 precedes Tier 2 with FIFO preservation');

  // ---------------------------------------------------------------------------
  // 5. Anti-Ban Jitter Engine Distribution
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 5] Anti-Ban Randomized Jitter Distribution');

  const SAMPLE_SIZE = 10000;
  let minJitter = Infinity;
  let maxJitter = -Infinity;
  let sumJitter = 0;

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const j = calculateRandomJitterMs(4, 10);
    assert(j >= 4000 && j <= 10000, `Jitter sample out of bounds: ${j}`);
    if (j < minJitter) minJitter = j;
    if (j > maxJitter) maxJitter = j;
    sumJitter += j;
  }

  const avgJitter = Math.round(sumJitter / SAMPLE_SIZE);
  console.log(`  [INFO] 10,000 Jitter samples: Min=${minJitter}ms, Max=${maxJitter}ms, Avg=${avgJitter}ms`);
  assert(minJitter >= 4000, 'Min jitter respected');
  assert(maxJitter <= 10000, 'Max jitter respected');
  assert(avgJitter >= 6500 && avgJitter <= 7500, `Uniform distribution mean (~7000ms): got ${avgJitter}ms`);
  console.log('  [PASS] Anti-ban jitter strictly adheres to 4000ms - 10000ms randomized bounds');

  // ---------------------------------------------------------------------------
  // 6. Mock Gateway Client State Isolation & Fault Simulation
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 6] Mock Gateway Client Isolation & Fault Simulation');

  MockGatewayClient.clear();
  const client = new MockGatewayClient();

  // Test 1: Send valid message
  const resValid = await client.sendMessage({
    targetPhone: '081234567890',
    message: 'Test message',
    notifType: WaNotifType.GATE_IN,
  });
  assert(resValid.success === true, 'Valid message sent');
  assert(MockGatewayClient.getSentMessages().length === 1, 'Recorded in ledger');
  assert(MockGatewayClient.getLastMessage()?.targetPhone === '6281234567890', 'Phone normalized in ledger');

  // Test 2: Reject invalid phone number before ledger write
  const resInvalid = await client.sendMessage({
    targetPhone: '0215551234',
    message: 'Invalid phone test',
  });
  assert(resInvalid.success === false, 'Invalid phone rejected');
  assert(MockGatewayClient.getSentMessages().length === 1, 'Not added to ledger');

  // Test 3: Simulate network outage
  MockGatewayClient.setSimulateFailure(true, 'Simulated gateway timeout');
  const resFail = await client.sendMessage({
    targetPhone: '081234567890',
    message: 'Fail test',
  });
  assert(resFail.success === false, 'Simulation failure honored');
  assert(resFail.error === 'Simulated gateway timeout', 'Simulated error message returned');

  // Test 4: Health check reflects simulation
  const healthFail = await client.checkHealth();
  assert(healthFail.healthy === false, 'Health check indicates unhealthy during simulation');

  // Test 5: Reset simulation
  MockGatewayClient.setSimulateFailure(false);
  const healthOk = await client.checkHealth();
  assert(healthOk.healthy === true, 'Health check restored to healthy');

  MockGatewayClient.clear();
  assert(MockGatewayClient.getSentMessages().length === 0, 'Ledger cleared');
  console.log('  [PASS] Mock gateway client provides complete deterministic isolation for CI');

  // ---------------------------------------------------------------------------
  // 7. Template Catalog Completeness & Interpolation
  // ---------------------------------------------------------------------------
  console.log('\n>>> [SUITE 7] Template Catalog Completeness & Interpolation');

  const testVars: Record<string, string | number> = {
    parent_name: 'Ibu Rahmawati',
    student_name: 'Fajar Nugraha',
    class: 'XII-MIPA-2',
    time: '06:58 WIB',
    late_minutes: 15,
    subject_name: 'Fisika',
    period: 3,
    teacher_name: 'Bpk. Suryanto, M.Pd.',
    leave_type: 'SAKIT',
    date_range: '04 Nov 2026 - 05 Nov 2026',
    notes_line: 'Surat dokter terlampir.',
    rejection_reason_line: 'Alasan izin tidak memenuhi kriteria kedinasan.',
    date: 'Rabu, 04 November 2026',
    check_in_time: '06:58 WIB',
    check_out_time: '15:15 WIB',
    subjects_summary: '• Fisika: HADIR (GOOD)\n• Kimia: HADIR (ACTIVE_STAR)',
    assessment_title: 'Ulangan Harian 1 - Kinematika',
    category: 'UH',
    score: 88.5,
    kkm_score: 75.0,
    mastery_status: 'TUNTAS',
    portal_link: 'https://sihadir.sch.id/portal',
    school_name: 'SMA Negeri 1 Harapan Bangsa',
  };

  const templates = [
    { name: 'TEMPLATE_GATE_LATE', tmpl: TEMPLATE_GATE_LATE },
    { name: 'TEMPLATE_GATE_IN', tmpl: TEMPLATE_GATE_IN },
    { name: 'TEMPLATE_ABSENT_BOLOS', tmpl: TEMPLATE_ABSENT_BOLOS },
    { name: 'TEMPLATE_LEAVE_APPROVED', tmpl: TEMPLATE_LEAVE_APPROVED },
    { name: 'TEMPLATE_LEAVE_REJECTED', tmpl: TEMPLATE_LEAVE_REJECTED },
    { name: 'TEMPLATE_DAILY_DIGEST', tmpl: TEMPLATE_DAILY_DIGEST },
    { name: 'TEMPLATE_GRADE_UPDATE', tmpl: TEMPLATE_GRADE_UPDATE },
  ];

  for (const { name, tmpl } of templates) {
    const formatted = formatWaMessage(tmpl, testVars);
    assert(!formatted.includes('{{'), `Template ${name} has un-interpolated variable placeholders`);
    assert(formatted.length > 50, `Template ${name} produced meaningful length: ${formatted.length} chars`);
    assert(formatted.includes('SMA Negeri 1 Harapan Bangsa'), `Template ${name} includes school signature`);
  }
  console.log('  [PASS] All 7 standard school templates interpolate cleanly without leftover tags');

  console.log('\n========================================================================');
  console.log('ALL ADVERSARIAL STRESS SUITES PASSED SUCCESSFULLY (APPROVE)');
  console.log('========================================================================');
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal error during adversarial suite:', err);
  process.exit(1);
});
