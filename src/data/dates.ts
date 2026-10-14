const DAY_MS = 86_400_000;

export function daysSince(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(`${isoDate}T00:00:00Z`)) / DAY_MS));
}

/** ISO date (yyyy-mm-dd) of the first day a donor is eligible again. */
export function eligibleOn(lastDonationDate: string, cooldownDays: number): string {
  return new Date(Date.parse(`${lastDonationDate}T00:00:00Z`) + cooldownDays * DAY_MS).toISOString().slice(0, 10);
}
