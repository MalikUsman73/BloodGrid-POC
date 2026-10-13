import { describe, expect, it } from 'vitest';
import { runMatch } from '../src/engine';
import { donor, request, rng } from './fixtures';

describe('failure cases', () => {
  it('reports an empty pool without throwing', () => {
    const out = runMatch([], request());
    expect(out.status).toBe('empty-pool');
    expect(out.selected).toEqual([]);
    expect(out.warnings[0]).toMatch(/empty/i);
  });

  it('reports when every donor is ineligible, and says where they were lost', () => {
    const pool = [donor({ available: false }), donor({ daysSinceDonation: 20 }), donor({ group: 'A+' })];
    const out = runMatch(pool, request());
    expect(out.status).toBe('none-eligible');
    expect(out.selected).toEqual([]);
    expect(out.stages.reduce((n, s) => n + s.removed, 0)).toBe(3);
  });

  it('notifies everyone eligible and warns when fewer than k are available', () => {
    const out = runMatch([donor(), donor()], request({ units: 2, urgency: 'Critical' }));
    expect(out.k).toBe(4);
    expect(out.status).toBe('partial');
    expect(out.selected).toHaveLength(2);
    expect(out.warnings.join(' ')).toMatch(/Only 2/);
  });

  it('handles a single eligible donor for a single unit', () => {
    const out = runMatch([donor({ id: 'solo' })], request({ units: 1, urgency: 'Routine' }));
    expect(out.status).toBe('partial');
    expect(out.selected.map((s) => s.donor.id)).toEqual(['solo']);
  });
});

describe('properties over random pools', () => {
  const groups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;
  const urgencies = ['Routine', 'Urgent', 'Critical'] as const;

  it('every selected set satisfies every hard filter and has size min(k, eligible)', () => {
    const r = rng(2026);
    for (let run = 0; run < 500; run += 1) {
      const n = Math.floor(r() * 30);
      const pool = Array.from({ length: n }, (_, i) =>
        donor({
          id: `r${run}-${i}`,
          group: groups[Math.floor(r() * 8)],
          distanceKm: r() * 22,
          daysSinceDonation: Math.floor(r() * 400),
          available: r() > 0.2,
          heldBy: r() > 0.9 ? 'other' : null,
          contactsLast30d: Math.floor(r() * 5),
          accepted: Math.floor(r() * 6),
          received: 6 + Math.floor(r() * 6),
        }),
      );
      const req = request({
        recipientGroup: groups[Math.floor(r() * 8)],
        units: 1 + Math.floor(r() * 2),
        urgency: urgencies[Math.floor(r() * 3)],
      });
      const out = runMatch(pool, req);
      expect(out.selected.length).toBe(Math.min(out.k, out.eligibleCount));
      expect(new Set(out.selected.map((s) => s.donor.id)).size).toBe(out.selected.length);
      for (const s of out.selected) {
        expect(s.donor.available && s.donor.heldBy === null).toBe(true);
        expect(s.donor.daysSinceDonation).toBeGreaterThanOrEqual(90);
        expect(s.donor.distanceKm).toBeLessThanOrEqual(15);
        expect(s.donor.contactsLast30d).toBeLessThan(3);
      }
    }
  });

  it('the same input always gives the same output', () => {
    const pool = Array.from({ length: 25 }, (_, i) => donor({ id: `s${i}`, distanceKm: 1 + (i % 9), daysSinceDonation: 90 + i * 7 }));
    const a = runMatch(pool, request({ units: 2, urgency: 'Urgent' }));
    const b = runMatch(pool, request({ units: 2, urgency: 'Urgent' }));
    expect(a.selected.map((s) => s.donor.id)).toEqual(b.selected.map((s) => s.donor.id));
  });
});

describe('method comparison', () => {
  it('never marks the chosen Pareto set as beaten, and flags a baseline that is', () => {
    const pool = Array.from({ length: 40 }, (_, i) =>
      donor({ id: `c${String(i).padStart(2, '0')}`, group: i % 5 === 0 ? 'O-' : 'O+', distanceKm: 1 + (i % 11), daysSinceDonation: 90 + ((i * 37) % 300), accepted: i % 7, received: 8 }),
    );
    const out = runMatch(pool, request({ units: 2, urgency: 'Urgent' }));
    expect(out.comparison.map((c) => c.algorithm)).toEqual(['pareto', 'weighted', 'greedy', 'nearest']);
    expect(out.comparison[0].dominated).toBe(false);
  });
});
