import { db } from '@/lib/db';
import { WaNotifType, WaStatus } from '@prisma/client';

export type WaGatewayProviderType = 'FONNTE' | 'WABLAS' | 'MOCK';

export interface WaSendMessageOptions {
  targetPhone: string;
  message: string;
  notifType?: WaNotifType;
  delaySeconds?: number;
}

export interface WaSendResult {
  success: boolean;
  provider: WaGatewayProviderType;
  messageId?: string;
  rawResponse?: unknown;
  error?: string;
  timestamp: Date;
}

export interface WaGatewayClient {
  readonly providerType: WaGatewayProviderType;
  sendMessage(options: WaSendMessageOptions): Promise<WaSendResult>;
  checkHealth(): Promise<{ healthy: boolean; details?: string }>;
}

export interface MockSentRecord {
  id: string;
  targetPhone: string;
  message: string;
  notifType?: WaNotifType;
  delaySeconds?: number;
  sentAt: Date;
}

/**
 * Normalizes Indonesian phone numbers to standard format (e.g. 628123456789).
 * Strips punctuation, spaces, dashes, leading 0 or +62.
 */
export function normalizeIndonesianPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

/**
 * Validates Indonesian phone format (must begin with 628 and have 10-15 digits total).
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const normalized = normalizeIndonesianPhone(phone);
  return /^628\d{8,12}$/.test(normalized);
}

/**
 * Resolves nested Spintax format strings (e.g. "{Assalamu'alaikum|Selamat {Pagi|Siang}|Halo}")
 * by resolving innermost options outward.
 */
export function resolveSpintax(text: string, rng: () => number = Math.random): string {
  if (!text) return '';
  const innerSpintaxRegex = /\{([^{}]+)\}/g;
  let current = text;
  let guard = 0;
  while (innerSpintaxRegex.test(current) && guard < 20) {
    current = current.replace(innerSpintaxRegex, (_, optionsStr: string) => {
      const options = optionsStr.split('|');
      const choiceIndex = Math.floor(rng() * options.length);
      return options[choiceIndex].trim();
    });
    guard++;
  }
  return current;
}

/**
 * Replaces {{variable}} or {variable} placeholders with provided key-values.
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  return template.replace(/\{\{?([a-zA-Z0-9_]+)\}?\}/g, (match, key) => {
    if (key in variables) {
      const val = variables[key];
      return val !== null && val !== undefined ? String(val) : '';
    }
    return match;
  });
}

/**
 * Full message formatting pipeline: variable interpolation + spintax resolution + whitespace cleanup.
 */
export function formatWaMessage(
  template: string,
  variables: Record<string, string | number | undefined | null> = {},
  rng?: () => number
): string {
  const substituted = interpolateVariables(template, variables);
  const spintaxResolved = resolveSpintax(substituted, rng);
  return spintaxResolved.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Standard 7-template School Catalog
 */
export const TEMPLATE_GATE_LATE = `{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {{parent_name}},
Kami menginformasikan bahwa ananda:
👤 Nama: *{{student_name}}* ({{class}})
🕒 Waktu Tiba: *{{time}}*
⚠️ Status: *TERLAMBAT (+{{late_minutes}} menit)*

Mohon motivasi dan arahan kepada ananda agar dapat tiba di sekolah tepat waktu sebelum pukul 07:15 WIB.
🔗 Pantau kehadiran siswa: {{portal_link}}
_{{school_name}}_`;

export const TEMPLATE_GATE_IN = `{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {{parent_name}},
Alhamdulillah, ananda:
👤 Nama: *{{student_name}}* ({{class}})
🕒 Waktu Tiba: *{{time}}*
✅ Status: *HADIR TEPAT WAKTU*

Ananda {telah berada di sekolah|sudah tiba di gerbang sekolah} dan siap mengikuti kegiatan pembelajaran hari ini.
🔗 Info kegiatan sekolah: {{portal_link}}
_{{school_name}}_`;

export const TEMPLATE_ABSENT_BOLOS = `🚨 *PERINGATAN KHUSUS: KETIDAKHADIRAN DI KELAS (BOLOS)* 🚨
{Assalamu'alaikum|Selamat Siang|Halo} Bapak/Ibu {{parent_name}},
Wali dari ananda:
👤 Nama: *{{student_name}}* ({{class}})

Kami menginformasikan bahwa ananda tercatat *HADIR di gerbang sekolah pagi ini*, namun *TIDAK BERADA DI KELAS* pada:
📘 Mata Pelajaran: *{{subject_name}}* (Jam ke-{{period}})
👨‍🏫 Guru Pengajar: *{{teacher_name}}*

Mohon segera mengonfirmasi dan berkoordinasi dengan pihak sekolah atau Wali Kelas ananda.
🔗 Hubungi sekolah: {{portal_link}}
_{{school_name}}_`;

export const TEMPLATE_LEAVE_APPROVED = `{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {{parent_name}},
Pemberitahuan: Permohonan izin siswa telah *DISETUJUI*.
👤 Siswa: *{{student_name}}*
📝 Jenis: *{{leave_type}}*
📅 Rentang: {{date_range}}
{{notes_line}}
Data presensi gerbang sekolah telah otomatis disesuaikan. Terima kasih.
_{{school_name}}_`;

export const TEMPLATE_LEAVE_REJECTED = `{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {{parent_name}},
Pemberitahuan: Permohonan izin siswa *TIDAK DISETUJUI / DITOLAK*.
👤 Siswa: *{{student_name}}*
📝 Jenis: *{{leave_type}}*
📅 Rentang: {{date_range}}
{{rejection_reason_line}}
Silakan hubungi Wali Kelas ananda untuk koordinasi lebih lanjut.
_{{school_name}}_`;

export const TEMPLATE_DAILY_DIGEST = `{Assalamu'alaikum|Selamat Sore|Halo} Bapak/Ibu {{parent_name}},
Berikut ringkasan kegiatan ananda *{{student_name}}* ({{class}}) hari ini ({{date}}):
🕒 Datang: {{check_in_time}} | Pulang: {{check_out_time}}
📚 Pelajaran Hari Ini:
{{subjects_summary}}

Pantau foto kegiatan dan nilai ananda secara lengkap di portal orang tua:
🔗 {{portal_link}}
_{{school_name}}_`;

export const TEMPLATE_GRADE_UPDATE = `{Assalamu'alaikum|Selamat Siang|Halo} Bapak/Ibu {{parent_name}},
Informasi Nilai Baru untuk putra/putri Anda:
👤 Nama: *{{student_name}}* ({{class}})
📘 Mata Pelajaran: *{{subject_name}}*
📝 Penilaian: *{{assessment_title}}* ({{category}})
🎯 Nilai: *{{score}}* (KKM: {{kkm_score}}) -> *{{mastery_status}}*

🔗 Lihat detail nilai & catatan guru: {{portal_link}}
_{{school_name}}_`;

/**
 * Mock Gateway Client for testing and CI without external costs.
 */
export class MockGatewayClient implements WaGatewayClient {
  public readonly providerType: WaGatewayProviderType = 'MOCK';
  private static sentLedger: MockSentRecord[] = [];
  private static simulateFailure = false;
  private static failureReason = 'Mock gateway simulated network failure';

  public async sendMessage(options: WaSendMessageOptions): Promise<WaSendResult> {
    const timestamp = new Date();
    const normalized = normalizeIndonesianPhone(options.targetPhone);

    if (!isValidIndonesianPhone(normalized)) {
      return {
        success: false,
        provider: 'MOCK',
        error: `Invalid Indonesian phone number: ${options.targetPhone}`,
        timestamp,
      };
    }

    if (MockGatewayClient.simulateFailure) {
      return {
        success: false,
        provider: 'MOCK',
        error: MockGatewayClient.failureReason,
        timestamp,
      };
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: MockSentRecord = {
      id: messageId,
      targetPhone: normalized,
      message: options.message,
      notifType: options.notifType,
      delaySeconds: options.delaySeconds,
      sentAt: timestamp,
    };

    MockGatewayClient.sentLedger.push(record);

    return {
      success: true,
      provider: 'MOCK',
      messageId,
      timestamp,
      rawResponse: { status: true, mockId: messageId },
    };
  }

  public async checkHealth(): Promise<{ healthy: boolean; details?: string }> {
    return {
      healthy: !MockGatewayClient.simulateFailure,
      details: MockGatewayClient.simulateFailure ? 'Mock simulation failure active' : 'Mock healthy',
    };
  }

  public static getSentMessages(): MockSentRecord[] {
    return [...MockGatewayClient.sentLedger];
  }

  public static getLastMessage(): MockSentRecord | undefined {
    return MockGatewayClient.sentLedger[MockGatewayClient.sentLedger.length - 1];
  }

  public static clear(): void {
    MockGatewayClient.sentLedger = [];
    MockGatewayClient.simulateFailure = false;
  }

  public static setSimulateFailure(fail: boolean, reason?: string): void {
    MockGatewayClient.simulateFailure = fail;
    if (reason) MockGatewayClient.failureReason = reason;
  }
}

/**
 * Fonnte Gateway REST Client
 */
export class FonnteGatewayClient implements WaGatewayClient {
  public readonly providerType: WaGatewayProviderType = 'FONNTE';
  private apiUrl: string;
  private token: string;

  constructor(token?: string, apiUrl?: string) {
    this.token = token || process.env.FONNTE_API_TOKEN || process.env.WA_GATEWAY_TOKEN || '';
    this.apiUrl =
      apiUrl ||
      process.env.FONNTE_API_URL ||
      process.env.WA_GATEWAY_API_URL ||
      'https://api.fonnte.com/send';
  }

  public async sendMessage(options: WaSendMessageOptions): Promise<WaSendResult> {
    const timestamp = new Date();
    const normalized = normalizeIndonesianPhone(options.targetPhone);

    if (!this.token) {
      return {
        success: false,
        provider: 'FONNTE',
        error: 'Fonnte API token is missing or not configured',
        timestamp,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: normalized,
          message: options.message,
          countryCode: '62',
          delay: options.delaySeconds || 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.status === false) {
        return {
          success: false,
          provider: 'FONNTE',
          error: data?.reason || `HTTP Error ${response.status}: ${response.statusText}`,
          rawResponse: data,
          timestamp,
        };
      }

      return {
        success: true,
        provider: 'FONNTE',
        messageId: Array.isArray(data?.id) ? data.id[0] : String(data?.id || 'fonnte_ok'),
        rawResponse: data,
        timestamp,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: 'FONNTE',
        error: `Fonnte request exception: ${errorMsg}`,
        timestamp,
      };
    }
  }

  public async checkHealth(): Promise<{ healthy: boolean; details?: string }> {
    if (!this.token) {
      return { healthy: false, details: 'Missing FONNTE token' };
    }
    return { healthy: true, details: `Configured url: ${this.apiUrl}` };
  }
}

/**
 * Wablas Gateway REST Client
 */
export class WablasGatewayClient implements WaGatewayClient {
  public readonly providerType: WaGatewayProviderType = 'WABLAS';
  private apiUrl: string;
  private token: string;

  constructor(token?: string, domain?: string) {
    this.token = token || process.env.WABLAS_API_TOKEN || process.env.WA_GATEWAY_TOKEN || '';
    const baseDomain =
      domain || process.env.WABLAS_DOMAIN || process.env.WA_GATEWAY_API_URL || 'https://wablas.com';
    const normalizedDomain = baseDomain.replace(/\/api\/send-message\/?$/, '').replace(/\/+$/, '');
    this.apiUrl = `${normalizedDomain}/api/send-message`;
  }

  public async sendMessage(options: WaSendMessageOptions): Promise<WaSendResult> {
    const timestamp = new Date();
    const normalized = normalizeIndonesianPhone(options.targetPhone);

    if (!this.token) {
      return {
        success: false,
        provider: 'WABLAS',
        error: 'Wablas API token is missing or not configured',
        timestamp,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalized,
          message: options.message,
          isGroup: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.status === false) {
        return {
          success: false,
          provider: 'WABLAS',
          error: data?.message || `HTTP Error ${response.status}: ${response.statusText}`,
          rawResponse: data,
          timestamp,
        };
      }

      const msgId = data?.data?.messages?.[0]?.id || 'wablas_ok';
      return {
        success: true,
        provider: 'WABLAS',
        messageId: String(msgId),
        rawResponse: data,
        timestamp,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: 'WABLAS',
        error: `Wablas request exception: ${errorMsg}`,
        timestamp,
      };
    }
  }

  public async checkHealth(): Promise<{ healthy: boolean; details?: string }> {
    if (!this.token) {
      return { healthy: false, details: 'Missing WABLAS token' };
    }
    return { healthy: true, details: `Configured endpoint: ${this.apiUrl}` };
  }
}

/**
 * Gateway Client Factory
 */
export function getWaGatewayClient(provider?: WaGatewayProviderType): WaGatewayClient {
  const chosen = (
    provider ||
    process.env.WA_GATEWAY_PROVIDER ||
    'MOCK'
  ).toUpperCase() as WaGatewayProviderType;

  if (chosen === 'FONNTE') {
    const token = process.env.FONNTE_API_TOKEN || process.env.WA_GATEWAY_TOKEN;
    if (token && token !== 'fonnte-device-token-placeholder') {
      return new FonnteGatewayClient(token);
    }
    // Fall back to Mock in development/testing if token is placeholder
    return new MockGatewayClient();
  }

  if (chosen === 'WABLAS') {
    const token = process.env.WABLAS_API_TOKEN || process.env.WA_GATEWAY_TOKEN;
    if (token && token !== 'wablas-token-placeholder') {
      return new WablasGatewayClient(token);
    }
    // Fall back to Mock in development/testing if token is placeholder
    return new MockGatewayClient();
  }

  return new MockGatewayClient();
}

/**
 * Calculates a randomized jitter delay between minSec and maxSec (default 4 to 10 seconds).
 */
export function calculateRandomJitterMs(
  minSec?: number,
  maxSec?: number,
  rng: () => number = Math.random
): number {
  const envMin = process.env.WA_ANTI_BAN_MIN_DELAY_SEC
    ? parseInt(process.env.WA_ANTI_BAN_MIN_DELAY_SEC, 10)
    : 4;
  const envMax = process.env.WA_ANTI_BAN_MAX_DELAY_SEC
    ? parseInt(process.env.WA_ANTI_BAN_MAX_DELAY_SEC, 10)
    : 10;

  const min = minSec !== undefined ? minSec : isNaN(envMin) ? 4 : envMin;
  const max = maxSec !== undefined ? maxSec : isNaN(envMax) ? 10 : envMax;

  if (max <= min) return min * 1000;
  const minMs = min * 1000;
  const maxMs = max * 1000;
  return Math.floor(rng() * (maxMs - minMs + 1)) + minMs;
}

export function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns priority tier integer: 1 (Urgent/High) or 2 (Normal)
 */
export function getPriorityWeight(notifType: WaNotifType): number {
  switch (notifType) {
    case WaNotifType.GATE_LATE:
    case WaNotifType.ABSENT_ALERT:
      return 1; // Tier 1: Urgent / Anomaly
    case WaNotifType.GATE_IN:
    case WaNotifType.GRADE_UPDATE:
    case WaNotifType.DAILY_DIGEST:
    default:
      return 2; // Tier 2: Normal / Information
  }
}

/**
 * Enqueues a notification into wa_notification_logs with formatted message body.
 */
export async function enqueueWhatsAppNotification(params: {
  studentId: string;
  targetPhone: string;
  notifType: WaNotifType;
  messageBody?: string;
  template?: string;
  variables?: Record<string, string | number | undefined | null>;
  scheduledAt?: Date;
}) {
  const targetPhone = normalizeIndonesianPhone(params.targetPhone);
  let body = params.messageBody;

  if (!body && params.template) {
    body = formatWaMessage(params.template, params.variables || {});
  }

  if (!body) {
    throw new Error('Notification body or template is required');
  }

  return await db.waNotificationLog.create({
    data: {
      studentId: params.studentId,
      targetPhone,
      notifType: params.notifType,
      messageBody: body,
      status: WaStatus.QUEUED,
      scheduledAt: params.scheduledAt || new Date(),
    },
  });
}

export interface ProcessQueueOptions {
  batchSize?: number;
  maxDurationMs?: number;
  client?: WaGatewayClient;
  minJitterSec?: number;
  maxJitterSec?: number;
}

export interface ProcessQueueResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  durationMs: number;
  logs: Array<{
    id: string;
    studentId: string;
    notifType: WaNotifType;
    status: WaStatus;
    error?: string;
  }>;
}

/**
 * Serialized Queue Dispatch Engine
 * Concurrency: 1.
 * Sorts Tier 1 Urgent before Tier 2 Normal, enforces randomized jitter,
 * and guards against serverless timeout limits.
 */
export async function processWaNotificationQueue(
  options: ProcessQueueOptions = {}
): Promise<ProcessQueueResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 10;
  const maxDurationMs = options.maxDurationMs || 45000;
  const client = options.client || getWaGatewayClient();

  const pending = await db.waNotificationLog.findMany({
    where: {
      status: WaStatus.QUEUED,
      scheduledAt: { lte: new Date() },
    },
    take: batchSize * 2, // Fetch double for prioritization pool
    orderBy: { scheduledAt: 'asc' },
  });

  // Priority sorting: Tier 1 (Urgent) before Tier 2 (Normal), then FIFO by scheduledAt
  const sorted = pending.sort((a, b) => {
    const weightA = getPriorityWeight(a.notifType);
    const weightB = getPriorityWeight(b.notifType);
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });

  const batch = sorted.slice(0, batchSize);

  let sentCount = 0;
  let failedCount = 0;
  const logs: ProcessQueueResult['logs'] = [];

  for (let i = 0; i < batch.length; i++) {
    const record = batch[i];

    // Check serverless execution time ceiling
    if (Date.now() - startTime >= maxDurationMs) {
      console.warn(`[processWaNotificationQueue] Reached execution ceiling (${maxDurationMs}ms), yielding.`);
      break;
    }

    // Apply anti-ban jitter delay if not the first message
    if (i > 0) {
      const jitterMs = calculateRandomJitterMs(options.minJitterSec, options.maxJitterSec);
      if (jitterMs > 0) {
        await sleepMs(jitterMs);
      }
    }

    try {
      const result = await client.sendMessage({
        targetPhone: record.targetPhone,
        message: record.messageBody,
        notifType: record.notifType,
      });

      if (result.success) {
        await db.waNotificationLog.update({
          where: { id: record.id },
          data: {
            status: WaStatus.SENT,
            sentAt: result.timestamp,
          },
        });
        sentCount++;
        logs.push({
          id: record.id,
          studentId: record.studentId,
          notifType: record.notifType,
          status: WaStatus.SENT,
        });
      } else {
        await db.waNotificationLog.update({
          where: { id: record.id },
          data: {
            status: WaStatus.FAILED,
          },
        });
        failedCount++;
        logs.push({
          id: record.id,
          studentId: record.studentId,
          notifType: record.notifType,
          status: WaStatus.FAILED,
          error: result.error,
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db.waNotificationLog.update({
        where: { id: record.id },
        data: {
          status: WaStatus.FAILED,
        },
      });
      failedCount++;
      logs.push({
        id: record.id,
        studentId: record.studentId,
        notifType: record.notifType,
        status: WaStatus.FAILED,
        error: errorMsg,
      });
    }
  }

  return {
    processedCount: sentCount + failedCount,
    sentCount,
    failedCount,
    durationMs: Date.now() - startTime,
    logs,
  };
}
