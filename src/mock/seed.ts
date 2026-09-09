/**
 * Deterministic pseudo-random number generator.
 *
 * PROTOTYPE / SIMULATED.
 * A fixed seed guarantees that every chart, score, and ranking is byte-identical
 * on every run, on every machine, in every rehearsal. The proposal-stage POC
 * deliberately prefers deterministic output over randomness so the live defense
 * demonstration is exactly repeatable.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed project seed. Do not change — it would alter every demo figure. */
export const BLOODGRID_SEED = 20260910;

export const rand = mulberry32(BLOODGRID_SEED);

export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

export function round(v: number, dp = 0): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
