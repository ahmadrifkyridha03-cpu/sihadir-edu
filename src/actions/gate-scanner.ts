'use server';

import { db } from '@/lib/db';
import { verifySignedQrToken, SCAN_COOLDOWN_SECONDS } from '@/lib/qr-token';
import { getWibNow, formatWibTime } from '@/lib/timezone';
import { notificationHooks } from '@/lib/notification-hooks';
import { GateStatus, StudentStatus } from '@prisma/client';

export interface GateScanResponse {
  success: boolean;
  code:
    | 'SCAN_RECORDED'
    | 'CHECKOUT_RECORDED'
    | 'COOLDOWN_ACTIVE'
    | 'ALREADY_CHECKED_IN'
    | 'INVALID_TOKEN'
    | 'STUDENT_NOT_FOUND'
    | 'STUDENT_INACTIVE'
    | 'SYSTEM_ERROR';
  message: string;
  student?: {
    id: string;
    fullName: string;
    nis: string;
    nisn: string;
    photoUrl: string | null;
    className: string;
  };
  attendance?: {
    id: string;
    status: GateStatus;
    checkInTime: string | null;
    checkOutTime: string | null;
    lateMinutes: number;
    scanType: 'CHECK_IN' | 'CHECK_OUT';
  };
  cooldown?: {
    remainingSeconds: number;
    lastScanTime: string;
  };
}

export interface GateStatsResponse {
  totalScanned: number;
  tepatWaktu: number;
  terlambat: number;
  checkedOut: number;
}

// Operational thresholds (configurable via env)
const GATE_LATE_THRESHOLD_MINUTES = (() => {
  const envVal = process.env.GATE_LATE_THRESHOLD; // e.g. "07:00"
  if (envVal && envVal.includes(':')) {
    const [h, m] = envVal.split(':').map(Number);
    return h * 60 + m;
  }
  return 7 * 60; // 07:00 WIB = 420 minutes
})();

const CHECKOUT_START_MINUTES = (() => {
  const envVal = process.env.GATE_CHECKOUT_START; // e.g. "12:00"
  if (envVal && envVal.includes(':')) {
    const [h, m] = envVal.split(':').map(Number);
    return h * 60 + m;
  }
  return 12 * 60; // 12:00 WIB = 720 minutes
})();

/**
 * Core Server Action processing QR scans at gate kiosk.
 * Enforces cryptographic HMAC check, 5-minute anti-titip absen cooldown,
 * 07:00 WIB lateness calculation, and priority WhatsApp dispatch.
 *
 * @param rawToken - Decoded QR string (e.g. "SHD.std26101.c49b01e2")
 * @param operatorId - Identity of the scanner operator or kiosk terminal
 */
export async function recordGateScan(
  rawToken: string,
  operatorId?: string
): Promise<GateScanResponse> {
  try {
    // Step 1: Cryptographic Token Signature Validation
    const validation = verifySignedQrToken(rawToken);
    if (!validation.isValid) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: validation.message,
      };
    }

    const { token } = validation;

    // Step 2: Database Student Resolution (O(1) Indexed query on qrToken)
    const student = await db.student.findFirst({
      where: { qrToken: token },
      include: {
        class: true,
        parentLinks: {
          include: { parent: true },
        },
      },
    });

    if (!student) {
      return {
        success: false,
        code: 'STUDENT_NOT_FOUND',
        message: 'Data siswa untuk kartu QR ini tidak ditemukan dalam sistem.',
      };
    }

    if (student.status !== StudentStatus.ACTIVE) {
      return {
        success: false,
        code: 'STUDENT_INACTIVE',
        message: `Siswa terdaftar berstatus ${student.status} (bukan siswa aktif).`,
        student: {
          id: student.id,
          fullName: student.fullName,
          nis: student.nis,
          nisn: student.nisn,
          photoUrl: student.photoUrl,
          className: student.class.className,
        },
      };
    }

    // Step 3: Current WIB Time Determination
    const now = new Date();
    const wib = getWibNow(now);

    // Step 4: Existing Attendance Record Lookup
    const existingAttendance = await db.gateAttendance.findUnique({
      where: {
        studentId_attendanceDate: {
          studentId: student.id,
          attendanceDate: wib.wibDate,
        },
      },
    });

    // Step 5: Rate Limiting & Cooldown Evaluation (5 minutes)
    if (existingAttendance) {
      const lastActiveScan =
        existingAttendance.checkOutTime || existingAttendance.checkInTime;

      if (lastActiveScan) {
        const diffSeconds = Math.floor((now.getTime() - lastActiveScan.getTime()) / 1000);

        if (diffSeconds < SCAN_COOLDOWN_SECONDS) {
          const remainingSeconds = SCAN_COOLDOWN_SECONDS - diffSeconds;
          return {
            success: false,
            code: 'COOLDOWN_ACTIVE',
            message: `Siswa baru saja scan ${diffSeconds} detik lalu. Tunggu ${remainingSeconds} detik lagi.`,
            student: {
              id: student.id,
              fullName: student.fullName,
              nis: student.nis,
              nisn: student.nisn,
              photoUrl: student.photoUrl,
              className: student.class.className,
            },
            cooldown: {
              remainingSeconds,
              lastScanTime: lastActiveScan.toISOString(),
            },
          };
        }
      }

      // Step 6: Afternoon Departure (Check-Out) Processing (>= 12:00 WIB)
      if (wib.minutesFromMidnight >= CHECKOUT_START_MINUTES) {
        const updated = await db.gateAttendance.update({
          where: { id: existingAttendance.id },
          data: {
            checkOutTime: now,
            scannedBy: operatorId || 'KIOSK_GATE_1',
          },
        });

        return {
          success: true,
          code: 'CHECKOUT_RECORDED',
          message: `Scan pulang berhasil tercatat pada pukul ${wib.timeString} WIB.`,
          student: {
            id: student.id,
            fullName: student.fullName,
            nis: student.nis,
            nisn: student.nisn,
            photoUrl: student.photoUrl,
            className: student.class.className,
          },
          attendance: {
            id: updated.id,
            status: updated.status,
            checkInTime: updated.checkInTime ? updated.checkInTime.toISOString() : null,
            checkOutTime: updated.checkOutTime ? updated.checkOutTime.toISOString() : null,
            lateMinutes: updated.lateMinutes,
            scanType: 'CHECK_OUT',
          },
        };
      }

      // Already checked in earlier this morning
      return {
        success: true,
        code: 'ALREADY_CHECKED_IN',
        message: `Siswa sudah tercatat hadir masuk pada pukul ${formatWibTime(existingAttendance.checkInTime)} WIB.`,
        student: {
          id: student.id,
          fullName: student.fullName,
          nis: student.nis,
          nisn: student.nisn,
          photoUrl: student.photoUrl,
          className: student.class.className,
        },
        attendance: {
          id: existingAttendance.id,
          status: existingAttendance.status,
          checkInTime: existingAttendance.checkInTime
            ? existingAttendance.checkInTime.toISOString()
            : null,
          checkOutTime: existingAttendance.checkOutTime
            ? existingAttendance.checkOutTime.toISOString()
            : null,
          lateMinutes: existingAttendance.lateMinutes,
          scanType: 'CHECK_IN',
        },
      };
    }

    // Step 7: New Morning Arrival (Check-In)
    const isLate = wib.minutesFromMidnight > GATE_LATE_THRESHOLD_MINUTES;
    const lateMinutes = isLate ? wib.minutesFromMidnight - GATE_LATE_THRESHOLD_MINUTES : 0;
    const status = isLate ? GateStatus.TERLAMBAT : GateStatus.HADIR;

    const newAttendance = await db.gateAttendance.create({
      data: {
        studentId: student.id,
        attendanceDate: wib.wibDate,
        checkInTime: now,
        status,
        lateMinutes,
        scannedBy: operatorId || 'KIOSK_GATE_1',
      },
    });

    // Step 8: Non-blocking WhatsApp Notification Hook
    void notificationHooks.onGateScanRecorded({
      gateRecord: newAttendance,
      student,
    });

    return {
      success: true,
      code: 'SCAN_RECORDED',
      message: isLate
        ? `Tercatat TERLAMBAT (+${lateMinutes} Menit) pada pukul ${wib.timeString} WIB`
        : `Tercatat HADIR TEPAT WAKTU pada pukul ${wib.timeString} WIB`,
      student: {
        id: student.id,
        fullName: student.fullName,
        nis: student.nis,
        nisn: student.nisn,
        photoUrl: student.photoUrl,
        className: student.class.className,
      },
      attendance: {
        id: newAttendance.id,
        status: newAttendance.status,
        checkInTime: newAttendance.checkInTime ? newAttendance.checkInTime.toISOString() : null,
        checkOutTime: null,
        lateMinutes: newAttendance.lateMinutes,
        scanType: 'CHECK_IN',
      },
    };
  } catch (err: unknown) {
    console.error('Failed to record gate scan:', err);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: 'Terjadi kesalahan sistem saat menyimpan absensi gerbang.',
    };
  }
}

/**
 * Fallback Manual Gate Scan by Student NIS or UUID.
 * Used when a student forgets their physical QR ID card or the barcode is unreadable.
 */
export async function recordManualGateScan(
  identifierOrNis: string,
  operatorId?: string
): Promise<GateScanResponse> {
  try {
    const clean = identifierOrNis.trim();
    const student = await db.student.findFirst({
      where: {
        OR: [{ nis: clean }, { id: clean }],
      },
    });

    if (!student) {
      return {
        success: false,
        code: 'STUDENT_NOT_FOUND',
        message: `Siswa dengan NIS / ID "${clean}" tidak ditemukan.`,
      };
    }

    return recordGateScan(student.qrToken, operatorId || 'KIOSK_MANUAL_INPUT');
  } catch (err) {
    console.error('Failed to record manual gate scan:', err);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: 'Gagal memproses absensi manual siswa.',
    };
  }
}

/**
 * Retrieves aggregate statistics for the current calendar day (WIB) for kiosk HUD.
 */
export async function getTodayGateStats(): Promise<GateStatsResponse> {
  try {
    const wib = getWibNow();
    const attendances = await db.gateAttendance.findMany({
      where: {
        attendanceDate: wib.wibDate,
      },
      select: {
        status: true,
        checkOutTime: true,
      },
    });

    let tepatWaktu = 0;
    let terlambat = 0;
    let checkedOut = 0;

    for (const a of attendances) {
      if (a.status === GateStatus.HADIR) tepatWaktu++;
      else if (a.status === GateStatus.TERLAMBAT) terlambat++;
      if (a.checkOutTime) checkedOut++;
    }

    return {
      totalScanned: attendances.length,
      tepatWaktu,
      terlambat,
      checkedOut,
    };
  } catch (err) {
    console.error('Error fetching today gate stats:', err);
    return {
      totalScanned: 0,
      tepatWaktu: 0,
      terlambat: 0,
      checkedOut: 0,
    };
  }
}
