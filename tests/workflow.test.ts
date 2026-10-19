import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, runMatch, screenDonors } from '../src/engine';
import { BLOOD_BANKS, banksNear, canEscalate, matchConfigFor, responseDeadline } from '../src/workflow';
import { donor, request } from './fixtures';

describe('nearby blood banks', () => {
  it('lists registered banks nearest the sector first', () => {
    const near = banksNear('G-8');
    expect(near[0].bank.id).toBe('BB-CGH');
    expect(near.map((n) => n.distanceKm)).toEqual([...near.map((n) => n.distanceKm)].sort((x, y) => x - y));
  });

  it('limits the list and never returns more banks than are registered', () => {
    expect(banksNear('G-8', 2)).toHaveLength(2);
    expect(banksNear('G-8', 50)).toHaveLength(BLOOD_BANKS.length);
  });
});

describe('matching rounds', () => {
  it('widens the search each round, further for urgent requests than routine ones', () => {
    expect(matchConfigFor({ urgency: 'Routine', round: 1 }).radiusKm).toBe(15);
    expect(matchConfigFor({ urgency: 'Routine', round: 3 }).radiusKm).toBe(25);
    expect(matchConfigFor({ urgency: 'Critical', round: 3 }).radiusKm).toBe(40);
    expect(canEscalate('Routine', 2)).toBe(false);
    expect(canEscalate('Critical', 2)).toBe(true);
  });

  it('gives critical offers the shortest time to answer', () => {
    expect(responseDeadline('2026-10-19T12:00:00.000Z', 'Critical')).toBe('2026-10-19T12:30:00.000Z');
    expect(responseDeadline('2026-10-19T12:00:00.000Z', 'Routine')).toBe('2026-10-20T00:00:00.000Z');
  });

  it('a wider round finds donors the first round could not reach', () => {
    const far = [donor({ distanceKm: 20 }), donor({ distanceKm: 22 })];
    expect(screenDonors(far, request(), matchConfigFor({ urgency: 'Urgent', round: 1 })).eligible).toHaveLength(0);
    expect(screenDonors(far, request(), matchConfigFor({ urgency: 'Urgent', round: 2 })).eligible).toHaveLength(2);
  });
});

describe('conflicts between requests', () => {
  it('lets a critical request take a donor only a routine request is waiting on, when free donors run short', () => {
    const held = donor({ id: 'held', heldBy: 'r1', heldUrgency: 'Routine', heldAccepted: false });
    const out = runMatch([held], request({ urgency: 'Critical' }), DEFAULT_CONFIG, {}, { algorithm: 'pareto' });
    expect(out.selected.map((s) => s.donor.id)).toEqual(['held']);
    expect(out.preempted).toEqual(['held']);
    expect(out.warnings.join(' ')).toMatch(/takes priority/);
  });

  it('prefers free donors over taking one from another request', () => {
    const pool = [
      donor({ id: 'held', heldBy: 'r1', heldUrgency: 'Routine', distanceKm: 0.5 }),
      donor({ id: 'f1', distanceKm: 6 }),
      donor({ id: 'f2', distanceKm: 7 }),
    ];
    const out = runMatch(pool, request({ urgency: 'Critical' }), DEFAULT_CONFIG, {}, { algorithm: 'pareto' });
    expect(out.k).toBe(2);
    expect(out.preempted).toEqual([]);
    expect(out.selected.map((s) => s.donor.id).sort()).toEqual(['f1', 'f2']);
  });

  it('never takes a donor who already accepted, nor one held by another critical request', () => {
    const pool = [
      donor({ heldBy: 'r1', heldUrgency: 'Routine', heldAccepted: true }),
      donor({ heldBy: 'r2', heldUrgency: 'Critical' }),
    ];
    expect(screenDonors(pool, request({ urgency: 'Critical' }), DEFAULT_CONFIG).eligible).toHaveLength(0);
  });

  it('a routine or urgent request never takes a held donor', () => {
    const pool = [donor({ heldBy: 'r1', heldUrgency: 'Routine' })];
    expect(screenDonors(pool, request({ urgency: 'Urgent' }), DEFAULT_CONFIG).eligible).toHaveLength(0);
  });

  it('does not ask a donor twice for the same request', () => {
    const d = donor({ id: 'asked' });
    expect(screenDonors([d], request({ exclude: ['asked'] }), DEFAULT_CONFIG).eligible).toHaveLength(0);
  });
});
