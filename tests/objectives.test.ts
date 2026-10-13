import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, adjustedScarcity, buildContext, dominates, evaluateSet, preservationCost, responseProbability,
} from '../src/engine';
import { donor } from './fixtures';

// Four donors for an O+ recipient. Pool rate = (6+2+0+3) / (10+4+0+6) = 11/20 = 0.55.
const a = donor({ id: 'a', group: 'O+', distanceKm: 2, daysSinceDonation: 100, accepted: 6, received: 10 });
const b = donor({ id: 'b', group: 'O+', distanceKm: 6, daysSinceDonation: 200, accepted: 2, received: 4 });
const c = donor({ id: 'c', group: 'O-', distanceKm: 4, daysSinceDonation: 300, accepted: 0, received: 0 });
const d = donor({ id: 'd', group: 'A+', distanceKm: 10, daysSinceDonation: 120, accepted: 3, received: 6 });
const pool = [a, b, c, d];
const ctx = buildContext(pool, 'O+', DEFAULT_CONFIG);

describe('pool context', () => {
  it('computes the pool response rate and group shares', () => {
    expect(ctx.poolRate).toBeCloseTo(0.55, 10);
    expect(ctx.share['O+']).toBeCloseTo(0.5, 10);
    expect(ctx.share['O-']).toBeCloseTo(0.25, 10);
  });

  it('falls back to 0.5 when nobody in the pool has history', () => {
    const fresh = [donor({ accepted: 0, received: 0 })];
    expect(buildContext(fresh, 'O+', DEFAULT_CONFIG).poolRate).toBe(0.5);
  });
});

describe('response probability (shrinkage)', () => {
  it('shrinks a donor with history toward the pool rate', () => {
    // (6 + 5 x 0.55) / (10 + 5) = 8.75 / 15
    expect(responseProbability(a, ctx)).toBeCloseTo(8.75 / 15, 10);
  });

  it('gives a donor with no history exactly the pool rate', () => {
    expect(responseProbability(c, ctx)).toBeCloseTo(0.55, 10);
  });

  it('does not let one lucky acceptance reach probability 1', () => {
    const lucky = donor({ accepted: 1, received: 1 });
    expect(responseProbability(lucky, ctx)).toBeLessThan(0.7);
  });
});

describe('type-preservation cost', () => {
  it('is zero for an exact group match', () => {
    expect(preservationCost(a, ctx)).toBe(0);
  });

  it('charges a universal donor versatility x scarcity on a non-matching request', () => {
    // V(O-) = 8, share(O-) = 0.25, so S_adj = 4 and cost = 32
    expect(adjustedScarcity('O-', ctx)).toBeCloseTo(4, 10);
    expect(preservationCost(c, ctx)).toBeCloseTo(32, 10);
  });

  it('makes forecast risk raise the cost when beta is above zero', () => {
    const risky = buildContext(pool, 'O+', { ...DEFAULT_CONFIG, beta: 1 }, { 'O-': 0.5 });
    expect(adjustedScarcity('O-', risky)).toBeCloseTo(4 * 1.5, 10);
  });

  it('ignores forecast risk when beta is zero', () => {
    const ignored = buildContext(pool, 'O+', DEFAULT_CONFIG, { 'O-': 0.9 });
    expect(adjustedScarcity('O-', ignored)).toBeCloseTo(4, 10);
  });
});

describe('set objectives', () => {
  it('computes all four objectives for a set by hand', () => {
    const pa = 8.75 / 15;
    const pb = (2 + 5 * 0.55) / (4 + 5);
    const o = evaluateSet([a, b], ctx);
    expect(o.travel).toBeCloseTo((2 + 6) / 2, 10);
    expect(o.recovery).toBeCloseTo((100 + 200) / 2, 10);
    expect(o.fulfilment).toBeCloseTo(1 - (1 - pa) * (1 - pb), 10);
    expect(o.preservation).toBe(0);
  });

  it('adds preservation cost across a set', () => {
    // c costs 32; d (A+, V=2, share 0.25 => S_adj 4) costs 8
    expect(evaluateSet([c, d], ctx).preservation).toBeCloseTo(40, 10);
  });

  it('never lets fulfilment fall when a donor is added', () => {
    expect(evaluateSet([a, b], ctx).fulfilment).toBeGreaterThan(evaluateSet([a], ctx).fulfilment);
  });

  it('returns zeros for an empty set', () => {
    expect(evaluateSet([], ctx)).toEqual({ travel: 0, recovery: 0, fulfilment: 0, preservation: 0 });
  });
});

describe('dominance', () => {
  const base = { travel: 5, recovery: 100, fulfilment: 0.8, preservation: 10 };
  it('detects a set that is better on one objective and equal on the rest', () => {
    expect(dominates({ ...base, travel: 4 }, base)).toBe(true);
  });
  it('does not call a trade-off dominance', () => {
    expect(dominates({ ...base, travel: 4, fulfilment: 0.7 }, base)).toBe(false);
  });
  it('does not let a set dominate an identical one', () => {
    expect(dominates(base, { ...base })).toBe(false);
  });
});
