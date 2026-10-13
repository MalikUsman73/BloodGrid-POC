import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, buildContext, combinations, dominates, evaluateSet, paretoFront, runMatch, selectFromFront,
  type Donor,
} from '../src/engine';
import { donor, request, rng } from './fixtures';

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

describe('combinations', () => {
  it('counts k-subsets', () => {
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(30, 4)).toBe(27405);
    expect(combinations(3, 5)).toBe(0);
  });
});

describe('exact Pareto search', () => {
  const pool = makePool(14, 7);
  const ctx = buildContext(pool, 'O+', DEFAULT_CONFIG);
  const search = paretoFront(pool, 3, ctx, 'Urgent');

  it('evaluates every k-subset', () => {
    expect(search.evaluated).toBe(combinations(14, 3));
    expect(search.shortlisted).toBe(false);
  });

  it('returns sets of exactly k distinct donors', () => {
    for (const p of search.front) {
      expect(p.donorIds).toHaveLength(3);
      expect(new Set(p.donorIds).size).toBe(3);
    }
  });

  it('contains no dominated member', () => {
    for (const p of search.front) {
      for (const q of search.front) expect(dominates(q.objectives, p.objectives)).toBe(false);
    }
  });

  it('dominates or equals a brute-force sample of other sets', () => {
    const byId = new Map(pool.map((d) => [d.id, d]));
    const r = rng(3);
    for (let i = 0; i < 60; i += 1) {
      const ids = new Set<string>();
      while (ids.size < 3) ids.add(pool[Math.floor(r() * pool.length)].id);
      const sample = evaluateSet([...ids].map((id) => byId.get(id) as Donor), ctx);
      const covered = search.front.some((p) => dominates(p.objectives, sample) || JSON.stringify(p.objectives) === JSON.stringify(sample));
      expect(covered).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(paretoFront(pool, 3, ctx, 'Urgent')).toEqual(search);
  });

  it('returns the whole pool when it is no larger than k', () => {
    const small = makePool(3, 1);
    const res = paretoFront(small, 5, buildContext(small, 'O+', DEFAULT_CONFIG), 'Routine');
    expect(res.front).toHaveLength(1);
    expect(res.front[0].donorIds).toHaveLength(3);
  });

  it('shortlists a pool whose subsets exceed the budget', () => {
    const big = makePool(40, 11);
    const res = paretoFront(big, 6, buildContext(big, 'O+', DEFAULT_CONFIG), 'Critical');
    expect(res.shortlisted).toBe(true);
    expect(res.evaluated).toBeLessThanOrEqual(DEFAULT_CONFIG.maxCombinations);
    expect(res.front[0].donorIds).toHaveLength(6);
  });
});

describe('choosing a set from the front', () => {
  const pool = makePool(14, 7);
  const ctx = buildContext(pool, 'O+', DEFAULT_CONFIG);
  const { front } = paretoFront(pool, 3, ctx, 'Urgent');

  it('returns null for an empty front', () => {
    expect(selectFromFront([], 'Routine')).toBeNull();
  });

  it('picks a member of the front', () => {
    const chosen = selectFromFront(front, 'Urgent');
    expect(front).toContain(chosen);
  });

  it('favours fulfilment and speed when critical, recovery when routine', () => {
    const critical = selectFromFront(front, 'Critical')!;
    const routine = selectFromFront(front, 'Routine')!;
    expect(critical.objectives.fulfilment).toBeGreaterThanOrEqual(routine.objectives.fulfilment);
    expect(critical.objectives.travel).toBeLessThanOrEqual(routine.objectives.travel);
    expect(routine.objectives.recovery).toBeGreaterThanOrEqual(critical.objectives.recovery);
  });

  it('breaks exact ties by donor ids', () => {
    const o = { travel: 1, recovery: 1, fulfilment: 1, preservation: 1 };
    const tied = [{ donorIds: ['b', 'c'], objectives: o }, { donorIds: ['a', 'c'], objectives: o }];
    expect(selectFromFront(tied, 'Routine')!.donorIds).toEqual(['a', 'c']);
  });
});

describe('end to end match', () => {
  const pool = makePool(60, 21);

  it('selects exactly k donors who all satisfy every hard filter', () => {
    const out = runMatch(pool, request({ units: 2, urgency: 'Urgent' }));
    expect(out.status).toBe('matched');
    expect(out.selected).toHaveLength(out.k);
    for (const s of out.selected) {
      expect(s.donor.daysSinceDonation).toBeGreaterThanOrEqual(90);
      expect(s.donor.available).toBe(true);
    }
  });

  it('spends a universal donor only when it is worth it', () => {
    const exact = Array.from({ length: 6 }, (_, i) => donor({ id: `x${i}`, group: 'O+', distanceKm: 5 + i }));
    const universal = donor({ id: 'u', group: 'O-', distanceKm: 1, accepted: 9, received: 10 });
    const out = runMatch([universal, ...exact], request({ units: 1, urgency: 'Routine' }));
    expect(out.selected.map((s) => s.donor.id)).not.toContain('u');
  });

  it('uses the universal donor when nobody else is eligible', () => {
    const universal = donor({ id: 'u', group: 'O-' });
    const out = runMatch([universal], request({ units: 1 }));
    expect(out.selected.map((s) => s.donor.id)).toEqual(['u']);
  });
});
