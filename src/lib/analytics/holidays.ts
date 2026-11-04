import { normalizeDateOnly } from '@/lib/timezone';

/**
 * Standard Indonesian National Holidays Calendar (2025 - 2027)
 * Keys are ISO YYYY-MM-DD format.
 */
export const INDONESIAN_NATIONAL_HOLIDAYS: Record<string, string> = {
  // 2026 National Holidays & Cutis Bersama
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-01-16': 'Isra Miraj Nabi Muhammad SAW',
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-19': 'Hari Suci Nyepi (Tahun Baru Saka 1948)',
  '2026-03-20': 'Hari Raya Idul Fitri 1447 H (Hari Pertama)',
  '2026-03-21': 'Hari Raya Idul Fitri 1447 H (Hari Kedua)',
  '2026-04-03': 'Wafat Yesus Kristus',
  '2026-04-05': 'Hari Paskah',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Hari Raya Idul Adha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam 1448 H',
  '2026-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',
};

/**
 * Checks if a date falls on a registered Indonesian national holiday.
 */
export function isNationalHoliday(dateInput: Date | string): {
  isHoliday: boolean;
  description?: string;
} {
  const d = normalizeDateOnly(dateInput);
  const isoKey = d.toISOString().split('T')[0];
  const desc = INDONESIAN_NATIONAL_HOLIDAYS[isoKey];

  return {
    isHoliday: !!desc,
    description: desc,
  };
}

/**
 * Determines if a given date is an effective school day:
 * - Sundays (`dayOfWeek === 0`) are always non-school days.
 * - Saturdays (`dayOfWeek === 6`) are non-school days if `schoolDaysPerWeek === 5`.
 * - National holidays or custom calendar breaks are non-school days.
 */
export function isSchoolDay(
  dateInput: Date | string,
  schoolDaysPerWeek: 5 | 6 = 5,
  customHolidays?: Map<string, string>
): boolean {
  const d = normalizeDateOnly(dateInput);
  const dayOfWeek = d.getUTCDay();

  // Sunday is always off
  if (dayOfWeek === 0) return false;

  // Saturday is off in 5-day school week
  if (schoolDaysPerWeek === 5 && dayOfWeek === 6) return false;

  const isoKey = d.toISOString().split('T')[0];

  // Check custom school holidays if provided
  if (customHolidays && customHolidays.has(isoKey)) {
    return false;
  }

  // Check national holidays
  if (INDONESIAN_NATIONAL_HOLIDAYS[isoKey]) {
    return false;
  }

  return true;
}

/**
 * Computes the total and elapsed effective school days in a given date range.
 */
export function calculateEffectiveSchoolDays(
  startDateInput: Date | string,
  endDateInput: Date | string,
  todayInput: Date | string,
  schoolDaysPerWeek: 5 | 6 = 5,
  customHolidays?: Map<string, string>
): {
  totalEffectiveDays: number;
  elapsedEffectiveDays: number;
  futureEffectiveDays: number;
  effectiveDates: string[]; // YYYY-MM-DD
  elapsedDates: string[]; // YYYY-MM-DD
} {
  const start = normalizeDateOnly(startDateInput);
  const end = normalizeDateOnly(endDateInput);
  const today = normalizeDateOnly(todayInput);

  let totalEffectiveDays = 0;
  let elapsedEffectiveDays = 0;
  let futureEffectiveDays = 0;
  const effectiveDates: string[] = [];
  const elapsedDates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    if (isSchoolDay(current, schoolDaysPerWeek, customHolidays)) {
      const iso = current.toISOString().split('T')[0];
      totalEffectiveDays++;
      effectiveDates.push(iso);

      if (current <= today) {
        elapsedEffectiveDays++;
        elapsedDates.push(iso);
      } else {
        futureEffectiveDays++;
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    totalEffectiveDays,
    elapsedEffectiveDays,
    futureEffectiveDays,
    effectiveDates,
    elapsedDates,
  };
}
