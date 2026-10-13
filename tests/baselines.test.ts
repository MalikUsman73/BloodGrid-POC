import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, buildContext, nearestCompatible, sequentialGreedy, weightedScore, weightedSum,
} from '../src/engine';
import { donor } from './fixtures';

const near = donor({ id: 'near', distanceKm: 1, group: 'O-', daysSinceDonation: 95 });
const mid = donor({ id: 'mid', distanceKm: 5, group: 'O+', daysSinceDonation: 300 });
const far = donor({ id: 'far', distanceKm: 12, group: 'O+', daysSinceDonation: 380, accepted: 9, received: 10 });
const pool = [far, mid, near];
const ctx = buildContext(pool, 'O+', DEFAULT_CONFIG);

describe('baselines', () => {
  it('nearest compatible returns the k closest donors', () => {
    expect(nearestCompatible(pool, 2).map((d) => d.id)).toEqual(['near', 'mid']);
  });

  it('nearest compatible breaks distance ties by id', () => {
    const t1 = donor({ id: 'b', distanceKm: 3 });
    const t2 = donor({ id: 'a', distanceKm: 3 });
    expect(nearestCompatible([t1, t2], 1).map((d) => d.id)).toEqual(['a']);
  });

  it('greedy is lexicographic: proximity always beats a better group match', () => {
    expect(sequentialGreedy(pool, 1, ctx).map((d) => d.id)).toEqual(['near']);
  });

  it('greedy prefers the exact group match when distances are effectively equal', () => {
    const o = donor({ id: 'o', distanceKm: 3, group: 'O-' });
    const p = donor({ id: 'p', distanceKm: 3.02, group: 'O+' });
    expect(sequentialGreedy([o, p], 1, ctx).map((d) => d.id)).toEqual(['p']);
  });

  it('weighted sum ranks by a single score, which differs by urgency', () => {
    const close = donor({ id: 'close', distanceKm: 2, daysSinceDonation: 95, group: 'O+' });
    const rested = donor({ id: 'rested', distanceKm: 10, daysSinceDonation: 400, group: 'O+' });
    const two = [close, rested];
    const c2 = buildContext(two, 'O+', DEFAULT_CONFIG);
    expect(weightedSum(two, 1, 'Critical', c2)[0].id).toBe('close');
    expect(weightedSum(two, 1, 'Routine', c2)[0].id).toBe('rested');
  });

  it('weighted score stays between 0 and 1', () => {
    for (const d of pool) {
      for (const u of ['Routine', 'Urgent', 'Critical'] as const) {
        const s = weightedScore(d, u, ctx);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});
