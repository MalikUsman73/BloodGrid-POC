import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, buildContext, combinations, dominates, hashSeed, igd, nsga3Front, paretoFront, referencePoints, seededRandom,
  type Donor,
} from '../src/engine';
import { donor, rng } from './fixtures';

function makePool(n: number, seed: number): Donor[] {
  const r = rng(seed);
  const groups = ['O+', 'O+', 'O-', 'A+', 'B+', 'O+'] as const;
  return Array.from({ length: n }, (_, i) =>
    donor({
      id: `p${String(i).padStart(3, '0')}`,
      group: groups[Math.floor(r() * groups.length)],
      distanceKm: 1 + r() * 13,
      daysSinceDonation: 90 + Math.floor(r() * 300),
      accepted: Math.floor(r() * 8),
      received: 8 + Math.floor(r() * 4),
    }),
  );
}

describe('reference points', () => {
  it('gives 84 points for four objectives and six divisions, each on the simplex', () => {
    const refs = referencePoints(4, 6);
    expect(refs).toHaveLength(84);
    for (const r of refs) expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(new Set(refs.map((r) => r.join(','))).size).toBe(84);
  });
});

describe('seeded random', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seededRandom(6)()).not.toBe(seededRandom(5)());
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });
});

describe('NSGA-III', () => {
  const pool = makePool(18, 11);
  const ctx = buildContext(pool, 'O+', DEFAULT_CONFIG);
  const run = (k: number, seed = 1) => nsga3Front(pool, k, ctx, 'Urgent', { seed });

  it('returns sets of exactly k distinct pool members', () => {
    for (const k of [2, 3, 4]) {
      const out = run(k);
      expect(out.front.length).toBeGreaterThan(0);
      for (const p of out.front) {
        expect(p.donorIds).toHaveLength(k);
        expect(new Set(p.donorIds).size).toBe(k);
        for (const id of p.donorIds) expect(pool.some((d) => d.id === id)).toBe(true);
      }
    }
  });

  it('returns a mutually non-dominated front', () => {
    const out = run(3);
    for (const a of out.front) for (const b of out.front) expect(dominates(a.objectives, b.objectives)).toBe(false);
  });

  it('is reproducible from its seed', () => {
    const a = run(3, 9);
    const b = run(3, 9);
    expect(a.front).toEqual(b.front);
    expect(a.evaluated).toBe(b.evaluated);
  });

  it('stays close to the exact front on instances small enough to enumerate', () => {
    for (const [k, seed] of [[3, 1], [3, 2], [4, 3]] as const) {
      const oracle = paretoFront(pool, k, ctx, 'Urgent');
      const out = run(k, seed);
      expect(out.evaluated).toBeLessThanOrEqual(combinations(pool.length, k));
      expect(igd(out.front, oracle.front)).toBeLessThan(0.12);
      // Nothing it returns may beat the exact front.
      for (const p of out.front) expect(oracle.front.some((o) => dominates(o.objectives, p.objectives))).toBe(false);
    }
  });

  it('evaluates far fewer sets than exhaustive search on a larger pool', () => {
    const big = makePool(60, 4);
    const bigCtx = buildContext(big, 'O+', DEFAULT_CONFIG);
    const out = nsga3Front(big, 4, bigCtx, 'Critical', { seed: 3 });
    expect(out.evaluated).toBeLessThan(combinations(60, 4) / 3);
    expect(out.front.length).toBeGreaterThan(1);
  });

  it('uses the exact search when k is 1', () => {
    const out = nsga3Front(pool, 1, ctx, 'Urgent');
    expect(out.exact).toBe(true);
    expect(out.front.length).toBeGreaterThan(0);
  });

  it('returns everyone when the pool is no larger than k', () => {
    const few = pool.slice(0, 3);
    const out = nsga3Front(few, 4, buildContext(few, 'O+', DEFAULT_CONFIG), 'Urgent');
    expect(out.front).toHaveLength(1);
    expect(out.front[0].donorIds).toHaveLength(3);
  });

  it('falls back to the greedy set and says so when the time budget is spent', () => {
    const out = nsga3Front(pool, 3, ctx, 'Urgent', { deadlineMs: -1 });
    expect(out.fellBack).toBe(true);
    expect(out.front).toHaveLength(1);
    expect(out.front[0].donorIds).toHaveLength(3);
  });

  it('stops by itself once the archive stops changing', () => {
    const out = run(3);
    expect(out.converged).toBe(true);
    expect(out.generations).toBeLessThan(300);
  });
});

describe('igd', () => {
  it('is zero against itself and grows as points go missing', () => {
    const oracle = paretoFront(pool10(), 3, buildContext(pool10(), 'O+', DEFAULT_CONFIG), 'Urgent');
    expect(igd(oracle.front, oracle.front)).toBe(0);
    if (oracle.front.length > 2) expect(igd(oracle.front.slice(0, 1), oracle.front)).toBeGreaterThan(0);
    expect(igd([], oracle.front)).toBe(Infinity);
  });
});

function pool10() {
  return makePool(10, 21);
}
