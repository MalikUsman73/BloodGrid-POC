/** Shared formatting helpers, so date and unit wording stays identical everywhere. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Sep 2026". Used for anything the user reads. */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "10 Sep". Chart axes and other tight spaces. */
export function formatShortDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pluralUnits(count: number): string {
  return `${count} unit${count === 1 ? '' : 's'}`;
}

export function pluralDonors(count: number): string {
  return `${count} donor${count === 1 ? '' : 's'}`;
}
