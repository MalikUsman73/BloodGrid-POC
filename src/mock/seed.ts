/**
 * Deterministic pseudo-random number generator.
 *
 * A fixed seed keeps every chart, score, and ranking identical on every run and
 * on every machine, so the live demonstration is exactly repeatable.
 */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Project seed. Changing this changes every figure shown in the demonstration. */
export const BLOODGRID_SEED = 20260910;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function roundTo(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
