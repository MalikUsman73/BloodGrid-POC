import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, screenDonors } from '../src/engine';
import { donor, request } from './fixtures';

const run = (pool: ReturnType<typeof donor>[], req = request()) => screenDonors(pool, req, DEFAULT_CONFIG);

describe('hard filters', () => {
  it('keeps a donor who passes every rule', () => {
    const d = donor();
    expect(run([d]).eligible).toEqual([d]);
  });

  it('removes an incompatible donor and attributes it to compatibility', () => {
    const d = donor({ group: 'A+' });
    const res = run([d]);
    expect(res.eligible).toEqual([]);
    expect(res.rejections).toEqual([{ donorId: d.id, stage: 'compatibility' }]);
  });

  it('removes an unavailable donor', () => {
    const d = donor({ available: false });
    expect(run([d]).rejections[0].stage).toBe('availability');
  });

  it('removes a donor already held by another open request', () => {
    const d = donor({ heldBy: 'req-1' });
    expect(run([d]).rejections[0].stage).toBe('availability');
  });

  it('excludes 89 days since donation and admits 90', () => {
    const early = donor({ daysSinceDonation: 89 });
    const ok = donor({ daysSinceDonation: 90 });
    const res = run([early, ok]);
    expect(res.eligible).toEqual([ok]);
    expect(res.rejections).toEqual([{ donorId: early.id, stage: 'interval' }]);
  });

  it('excludes a donor outside the service radius and admits one on the boundary', () => {
    const far = donor({ distanceKm: 15.1 });
    const edge = donor({ distanceKm: 15 });
    const res = run([far, edge]);
    expect(res.eligible).toEqual([edge]);
    expect(res.rejections[0].stage).toBe('radius');
  });

  it('excludes a donor at the contact cap and admits one just below it', () => {
    const capped = donor({ contactsLast30d: 3 });
    const ok = donor({ contactsLast30d: 2 });
    const res = run([capped, ok]);
    expect(res.eligible).toEqual([ok]);
    expect(res.rejections[0].stage).toBe('contactCap');
  });

  it('attributes a donor failing several rules to the first one only', () => {
    const d = donor({ group: 'B+', available: false, daysSinceDonation: 10 });
    const res = run([d]);
    expect(res.rejections).toHaveLength(1);
    expect(res.rejections[0].stage).toBe('compatibility');
  });

  it('reports a consistent funnel: each stage starts where the last one ended', () => {
    const pool = [donor(), donor({ group: 'A+' }), donor({ available: false }), donor({ daysSinceDonation: 10 }), donor({ distanceKm: 40 }), donor({ contactsLast30d: 5 })];
    const { stages, eligible } = run(pool);
    expect(stages.map((s) => s.removed)).toEqual([1, 1, 1, 1, 1]);
    for (let i = 1; i < stages.length; i += 1) expect(stages[i].before).toBe(stages[i - 1].remaining);
    expect(stages[stages.length - 1].remaining).toBe(eligible.length);
  });
});
