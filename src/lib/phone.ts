/**
 * Indonesian Phone Number Normalization Utility
 * Normalizes user input (+62, 62, 08, hyphens, spaces) to standard Indonesian format: 08...
 */
export function normalizeIndoPhone(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove all non-numeric characters
  let cleaned = input.replace(/\D/g, '');

  // Convert international prefixes to standard 08
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('8')) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Validates whether the normalized string is a plausible Indonesian mobile number.
 * Typical mobile numbers in Indonesia start with 08 and are 10 to 14 digits long.
 */
export function isValidIndoPhone(input: string): boolean {
  const normalized = normalizeIndoPhone(input);
  return /^08\d{8,12}$/.test(normalized);
}
