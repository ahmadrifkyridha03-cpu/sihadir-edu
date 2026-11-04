/**
 * Indonesian Western Time (WIB / Asia/Jakarta, UTC+7) Temporal Utilities.
 *
 * In serverless environments (Node.js on UTC runtime), naive Date handling causes
 * cross-day boundary shifting bugs when querying PostgreSQL `@db.Date` fields.
 * These helpers guarantee strict adherence to Indonesian school operational hours.
 */

export interface WibTimeInfo {
  wibDate: Date;
  dateString: string; // "YYYY-MM-DD"
  timeString: string; // "HH:mm:ss"
  hours: number;
  minutes: number;
  seconds: number;
  minutesFromMidnight: number;
}

/**
 * Returns current date/time components adjusted to Asia/Jakarta (WIB, UTC+7).
 */
export function getWibNow(baseDate: Date = new Date()): WibTimeInfo {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const findPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || '00';

  const year = findPart('year');
  const month = findPart('month');
  const day = findPart('day');
  const hour = parseInt(findPart('hour'), 10);
  const minute = parseInt(findPart('minute'), 10);
  const second = parseInt(findPart('second'), 10);

  const dateString = `${year}-${month}-${day}`;
  const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  // Normalized pure midnight Date for Prisma @db.Date matching
  const wibDate = new Date(`${dateString}T00:00:00.000Z`);

  return {
    wibDate,
    dateString,
    timeString,
    hours: hour,
    minutes: minute,
    seconds: second,
    minutesFromMidnight: hour * 60 + minute,
  };
}

/**
 * Normalizes any Date or YYYY-MM-DD string into a clean UTC midnight Date instance.
 * Guarantees that PostgreSQL @db.Date receives exactly the intended calendar day.
 */
export function normalizeDateOnly(input: Date | string): Date {
  if (typeof input === 'string') {
    const clean = input.split('T')[0];
    const [year, month, day] = clean.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0)
  );
}

/**
 * Returns UTC start and end bounds encompassing the full calendar day.
 */
export function getDayDateRangeUTC(dateInput: Date | string): {
  start: Date;
  end: Date;
} {
  const start = normalizeDateOnly(dateInput);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Formats a Date object or ISO string to Indonesian standard time: e.g. "07:25"
 */
export function formatWibTime(date: Date | string | null | undefined): string {
  if (!date) return '--:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--:--';

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false,
  }).format(d);
}

/**
 * Formats a Date object or ISO string to Indonesian standard date: e.g. "4 November 2026"
 */
export function formatIndoDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}
