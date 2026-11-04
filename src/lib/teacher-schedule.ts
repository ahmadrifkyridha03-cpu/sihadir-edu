/**
 * Indonesian School Teaching Period Schedule Definitions and Elapsed Progress Helpers
 */

export interface SchoolPeriodDefinition {
  period: number;
  label: string;
  startTimeStr: string;
  endTimeStr: string;
  startMinutes: number; // Minutes from 00:00 (e.g., 07:15 = 7*60 + 15 = 435)
  endMinutes: number;
  isBreak?: boolean;
}

export const INDONESIAN_SCHOOL_PERIODS: SchoolPeriodDefinition[] = [
  { period: 1, label: 'Jam ke-1', startTimeStr: '07:15', endTimeStr: '08:00', startMinutes: 435, endMinutes: 480 },
  { period: 2, label: 'Jam ke-2', startTimeStr: '08:00', endTimeStr: '08:45', startMinutes: 480, endMinutes: 525 },
  { period: 3, label: 'Jam ke-3', startTimeStr: '08:45', endTimeStr: '09:30', startMinutes: 525, endMinutes: 570 },
  { period: 4, label: 'Jam ke-4', startTimeStr: '09:30', endTimeStr: '10:15', startMinutes: 570, endMinutes: 615 },
  { period: 0, label: 'Istirahat Pagi', startTimeStr: '10:15', endTimeStr: '10:45', startMinutes: 615, endMinutes: 645, isBreak: true },
  { period: 5, label: 'Jam ke-5', startTimeStr: '10:45', endTimeStr: '11:30', startMinutes: 645, endMinutes: 690 },
  { period: 6, label: 'Jam ke-6', startTimeStr: '11:30', endTimeStr: '12:15', startMinutes: 690, endMinutes: 735 },
  { period: 0, label: 'Istirahat Dhuhur', startTimeStr: '12:15', endTimeStr: '13:00', startMinutes: 735, endMinutes: 780, isBreak: true },
  { period: 7, label: 'Jam ke-7', startTimeStr: '13:00', endTimeStr: '13:45', startMinutes: 780, endMinutes: 825 },
  { period: 8, label: 'Jam ke-8', startTimeStr: '13:45', endTimeStr: '14:30', startMinutes: 825, endMinutes: 870 },
];

export interface PeriodProgressState {
  isActive: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  elapsedMinutes: number;
  totalDuration: number;
  progressPercent: number;
}

/**
 * Calculates whether a period range (e.g. Jam 1 s/d Jam 2) is active right now in WIB,
 * elapsed minutes, and progress percentage.
 */
export function calculateSchedulePeriodState(
  periodStart: number,
  periodEnd: number,
  currentMinutesWib: number
): PeriodProgressState {
  const startDef =
    INDONESIAN_SCHOOL_PERIODS.find((p) => p.period === periodStart && !p.isBreak) ||
    INDONESIAN_SCHOOL_PERIODS[0];
  const endDef =
    INDONESIAN_SCHOOL_PERIODS.find((p) => p.period === periodEnd && !p.isBreak) ||
    startDef;

  const rangeStart = startDef.startMinutes;
  const rangeEnd = endDef.endMinutes;
  const totalDuration = Math.max(1, rangeEnd - rangeStart);

  if (currentMinutesWib < rangeStart) {
    return {
      isActive: false,
      isPast: false,
      isUpcoming: true,
      elapsedMinutes: 0,
      totalDuration,
      progressPercent: 0,
    };
  }

  if (currentMinutesWib >= rangeEnd) {
    return {
      isActive: false,
      isPast: true,
      isUpcoming: false,
      elapsedMinutes: totalDuration,
      totalDuration,
      progressPercent: 100,
    };
  }

  const elapsed = currentMinutesWib - rangeStart;
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  return {
    isActive: true,
    isPast: false,
    isUpcoming: false,
    elapsedMinutes: elapsed,
    totalDuration,
    progressPercent,
  };
}

/**
 * Converts a Date object or current WIB time into minutes from midnight (0..1439)
 */
export function getMinutesFromMidnightWib(date: Date = new Date()): number {
  // Convert date to WIB (UTC+7)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);
  return wibDate.getHours() * 60 + wibDate.getMinutes();
}
