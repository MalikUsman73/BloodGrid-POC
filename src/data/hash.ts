import type { Donor } from '../engine';

/** FNV-1a over the fields the engine reads, so an audit row can prove which pool was used. */
export function poolHash(pool: readonly Donor[]): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const d of pool.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    feed(`${d.id}|${d.group}|${d.distanceKm}|${d.daysSinceDonation}|${d.available}|${d.heldBy ?? ''}|${d.contactsLast30d}|${d.accepted}|${d.received};`);
  }
  return h.toString(16).padStart(8, '0');
}
