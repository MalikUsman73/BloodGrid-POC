import { beforeEach, describe, expect, it } from 'vitest';
import { LocalAuth } from '../src/auth/localAuth';
import { DonorUnavailableError, RequestRefusedError, RequestRejectedError } from '../src/data';
import { LocalRepository } from '../src/data/localRepository';
import { DEFAULT_CONFIG, runMatch, type BloodGroup, type ObjectiveValues, type Urgency } from '../src/engine';
import { hashFile, matchConfigFor, type PatientInput } from '../src/workflow';

/**
 * The whole request pipeline on the in-memory backend: patient record and prescription, the system's
 * verification rules, donor matching rounds, responses, time limits, the seeker's confirmation and thank-you
 * note, conflicts between requests, and donor reports of scams.
 */

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const objectives: ObjectiveValues = { travel: 1, recovery: 100, fulfilment: 0.9, preservation: 0 };
const audit = { algorithm: 'nsga3', engineVersion: 'test', poolHash: 'x', poolSize: 1, eligibleSize: 1, frontSize: 1, evaluated: 1, shortlisted: false, objectives };
const MIN = 60_000;
const HOUR = 60 * MIN;

let now: number;
let repo: LocalRepository;
let auth: LocalAuth;
let mr = 0;

beforeEach(async () => {
  now = Date.parse('2026-10-19T09:00:00Z');
  repo = new LocalRepository(() => now);
  auth = new LocalAuth(repo, new MemoryStorage());
  await auth.signUp({ role: 'recipient', email: 'r@example.com', password: 'secret123', fullName: 'Rae Recipient' });
});

const today = () => new Date(now).toISOString().slice(0, 10);

async function patient(overrides: Partial<PatientInput> = {}) {
  mr += 1;
  return repo.savePatient({ fullName: 'Ali Raza', mrNumber: `CGH-${1000 + mr}`, hospitalId: 'H-CGH', bloodGroup: 'A+', birthYear: 1980, ...overrides });
}

async function submit(opts: { patientId: string; group?: BloodGroup; units?: number; urgency?: Urgency; file?: Blob; pmdc?: string; issuedOn?: string }) {
  const file = opts.file ?? new Blob([`rx ${Math.random()}`], { type: 'application/pdf' });
  const units = opts.units ?? 1;
  return repo.submitRequest({
    patientId: opts.patientId,
    file,
    units,
    urgency: opts.urgency ?? 'Urgent',
    prescription: {
      doctorName: 'Dr. Sana Malik', pmdcNumber: opts.pmdc ?? '10234-P', hospitalId: 'H-CGH', issuedOn: opts.issuedOn ?? today(),
      bloodGroup: opts.group ?? 'A+', unitsPrescribed: units, diagnosis: 'Anaemia',
      document: { name: 'rx.pdf', type: 'application/pdf', size: file.size, hash: await hashFile(file) },
    },
  });
}

/** Run one matching round the way the screen does: the engine for what is still needed at this round's radius. */
async function round(requestId: string) {
  const r = (await repo.getRequest(requestId))!;
  const need = r.units - r.donors.filter((d) => d.state === 'Accepted' || d.state === 'Donated').length;
  const config = matchConfigFor({ urgency: r.urgency, round: r.round + 1 });
  const pool = await repo.getPool(r.sector);
  const outcome = runMatch(pool.donors, { recipientGroup: r.recipientGroup, units: need, urgency: r.urgency, sector: r.sector, exclude: r.donors.map((d) => d.donor.id) }, config, {}, { algorithm: 'pareto' });
  const status = await repo.recordRound({
    requestId,
    donors: outcome.selected.map((s, i) => ({ donorId: s.donor.id, rank: i + 1, p: s.p, cost: s.cost })),
    audit: { ...audit, objectives: outcome.objectives },
  });
  return { status, outcome };
}

async function asDonor<T>(email: string, fn: () => Promise<T>): Promise<T> {
  await auth.signOut();
  await auth.signIn(email, 'secret123');
  try {
    return await fn();
  } finally {
    await auth.signOut();
    await auth.signIn('r@example.com', 'secret123');
  }
}

describe('patient records', () => {
  it('keeps one record per hospital and record number, and lists only the caller’s patients', async () => {
    const a = await patient({ mrNumber: 'cgh-7' });
    const b = await repo.savePatient({ fullName: 'Ali Raza Khan', mrNumber: 'CGH-7', hospitalId: 'H-CGH', bloodGroup: 'A+', birthYear: 1980 });
    expect(b.id).toBe(a.id);
    expect(b.mrNumber).toBe('CGH-7');
    expect(await repo.listPatients()).toHaveLength(1);
    await auth.signOut();
    await auth.signUp({ role: 'recipient', email: 'o@example.com', password: 'secret123', fullName: 'Other Person' });
    expect(await repo.listPatients()).toEqual([]);
  });

  it('refuses an invalid patient record', async () => {
    await expect(repo.savePatient({ fullName: 'A', mrNumber: '?', hospitalId: 'nope', bloodGroup: '', birthYear: null })).rejects.toBeInstanceOf(RequestRejectedError);
  });
});

describe('verification rules on submission', () => {
  it('verifies a clean request at once and puts the request at the hospital’s sector', async () => {
    const p = await patient();
    const r = await submit({ patientId: p.id });
    expect(r).toMatchObject({ verification: 'Verified', flags: [] });
    const detail = await repo.getRequest(r.id);
    expect(detail).toMatchObject({ status: 'Awaiting response', sector: 'G-8', round: 0, patientName: 'Ali Raza' });
    expect(detail!.prescription.pmdcNumber).toBe('10234-P');
  });

  it('refuses a file whose contents do not match the hash the screen sent', async () => {
    const p = await patient();
    const file = new Blob(['real'], { type: 'application/pdf' });
    await expect(
      repo.submitRequest({
        patientId: p.id, file, units: 1, urgency: 'Urgent',
        prescription: {
          doctorName: 'Dr. Sana Malik', pmdcNumber: '10234-P', hospitalId: 'H-CGH', issuedOn: today(), bloodGroup: 'A+', unitsPrescribed: 1, diagnosis: '',
          document: { name: 'rx.pdf', type: 'application/pdf', size: file.size, hash: 'b'.repeat(64) },
        },
      }),
    ).rejects.toThrow(/does not match/);
  });

  it('refuses a request for another account’s patient, and a second open request for the same patient', async () => {
    const p = await patient();
    await submit({ patientId: p.id });
    await expect(submit({ patientId: p.id })).rejects.toMatchObject({ fields: { duplicate: expect.any(String) } });
    await expect(submit({ patientId: 'pt-nope' })).rejects.toBeInstanceOf(RequestRejectedError);
  });

  it('refuses a request that reuses another request’s prescription file, and saves nothing', async () => {
    const file = new Blob(['the same scan'], { type: 'application/pdf' });
    await submit({ patientId: (await patient()).id, file });
    const error = await submit({ patientId: (await patient()).id, file }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RequestRefusedError);
    expect((error as RequestRefusedError).flags.map((f) => f.code)).toContain('document-reused');
    expect(await repo.listRequests()).toHaveLength(1);
  });

  it('refuses a record number another account registered with a different blood group', async () => {
    await patient({ mrNumber: 'CGH-555', bloodGroup: 'O+' });
    await auth.signOut();
    await auth.signUp({ role: 'recipient', email: 'x@example.com', password: 'secret123', fullName: 'Second Person' });
    const p = await repo.savePatient({ fullName: 'Ali Raza', mrNumber: 'CGH-555', hospitalId: 'H-CGH', bloodGroup: 'A+', birthYear: 1980 });
    await expect(submit({ patientId: p.id })).rejects.toMatchObject({ flags: [expect.objectContaining({ code: 'patient-group-conflict' })] });
  });

  it('lets a request with one odd detail go ahead as unverified rather than turning away a genuine seeker', async () => {
    const r = await submit({ patientId: (await patient()).id, pmdc: '99999-Z' });
    expect(r.verification).toBe('Unverified');
    expect(r.flags.map((f) => f.code)).toEqual(['unregistered-doctor']);
    expect((await round(r.id)).status).toBe('Awaiting response');
    expect((await repo.getRequest(r.id))!.verification).toBe('Unverified');
  });

  it('applies the same rules to a critical request: urgency does not lower the bar', async () => {
    const ok = await submit({ patientId: (await patient()).id, urgency: 'Critical' });
    expect(ok.verification).toBe('Verified');
    const file = new Blob(['dup'], { type: 'application/pdf' });
    await submit({ patientId: (await patient()).id, file });
    await expect(submit({ patientId: (await patient()).id, file, urgency: 'Critical' })).rejects.toBeInstanceOf(RequestRefusedError);
  });

  it('refuses a request that collects several medium warnings at once', async () => {
    for (let i = 0; i < 3; i += 1) await submit({ patientId: (await patient()).id });
    const stale = new Date(now - 20 * 24 * HOUR).toISOString().slice(0, 10);
    // Burst of requests, an old prescription and an unknown doctor together.
    await expect(submit({ patientId: (await patient()).id, issuedOn: stale, pmdc: '99999-Z' })).rejects.toBeInstanceOf(RequestRefusedError);
  });

  it('marks a burst of requests as unverified when it is the only warning', async () => {
    for (let i = 0; i < 3; i += 1) await submit({ patientId: (await patient()).id });
    const r = await submit({ patientId: (await patient()).id });
    expect(r.flags.map((f) => f.code)).toContain('request-burst');
    expect(r.verification).toBe('Unverified');
  });
});

describe('the server re-checks every donor', () => {
  async function ready() {
    const r = await submit({ patientId: (await patient()).id });
    const pool = await repo.getPool('G-8');
    return { r, pool };
  }
  const send = (requestId: string, donorId: string) =>
    repo.recordRound({ requestId, donors: [{ donorId, rank: 1, p: 0.5, cost: 0 }], audit });

  it('refuses an incompatible donor', async () => {
    const { r, pool } = await ready();
    const b = pool.donors.find((d) => d.group === 'B+' && d.available && d.daysSinceDonation >= 90)!;
    await expect(send(r.id, b.id)).rejects.toBeInstanceOf(DonorUnavailableError);
  });

  it('refuses a donor inside the 90-day interval or over the contact cap', async () => {
    const { r, pool } = await ready();
    const compatible = pool.donors.filter((d) => ['A+', 'A-', 'O+', 'O-'].includes(d.group) && d.available);
    const recent = compatible.find((d) => d.daysSinceDonation < 90)!;
    await expect(send(r.id, recent.id)).rejects.toBeInstanceOf(DonorUnavailableError);
    const capped = compatible.find((d) => d.contactsLast30d >= DEFAULT_CONFIG.contactCap && d.daysSinceDonation >= 90)!;
    await expect(send(r.id, capped.id)).rejects.toBeInstanceOf(DonorUnavailableError);
  });

  it('refuses more donors than the round needs, and a second round while donors are still being asked', async () => {
    const { r } = await ready();
    const pool = await repo.getPool('G-8');
    const many = pool.donors.filter((d) => ['A+', 'O+'].includes(d.group) && d.available && !d.heldBy && d.daysSinceDonation >= 90 && d.distanceKm <= 15 && d.contactsLast30d < 3).slice(0, 5);
    await expect(
      repo.recordRound({ requestId: r.id, donors: many.map((d, i) => ({ donorId: d.id, rank: i + 1, p: 0.5, cost: 0 })), audit }),
    ).rejects.toThrow(/More donors/);
    await round(r.id);
    await expect(round(r.id)).rejects.toThrow(/not ready/);
  });
});

describe('responses, time limits and confirmation', () => {
  it('lapses unanswered offers after the urgency’s time limit and releases the donors', async () => {
    const r = await submit({ patientId: (await patient()).id, urgency: 'Critical' });
    const { outcome } = await round(r.id);
    now += 31 * MIN;
    const detail = (await repo.getRequest(r.id))!;
    expect(detail.donors.every((d) => d.state === 'Expired')).toBe(true);
    expect(detail.status).toBe('Unfilled');
    const pool = await repo.getPool('G-8');
    expect(pool.donors.filter((d) => outcome!.selected.some((s) => s.donor.id === d.id)).every((d) => d.heldBy === null)).toBe(true);
  });

  it('runs a wider second round that never asks the same donors again', async () => {
    const r = await submit({ patientId: (await patient()).id, urgency: 'Critical' });
    const first = await round(r.id);
    now += 31 * MIN;
    const second = await round(r.id);
    const firstIds = first.outcome!.selected.map((s) => s.donor.id);
    expect(second.outcome!.selected.some((s) => firstIds.includes(s.donor.id))).toBe(false);
    expect((await repo.getRequest(r.id))!.round).toBe(2);
    now += 31 * MIN;
    await round(r.id);
    now += 31 * MIN;
    await expect(round(r.id)).rejects.toThrow(/every matching round/);
  });

  it('keeps accepted donors held after confirmation until the seeker confirms the donation', async () => {
    const r = await submit({ patientId: (await patient()).id });
    await round(r.id);
    const row = (await repo.getRequest(r.id))!.donors[0];
    expect(await repo.respond(row.id, 'Accepted')).toBe('Confirmed');
    expect((await repo.getPool('G-8')).donors.find((d) => d.id === row.donor.id)!.heldBy).toBe(r.id);
    await repo.confirmDonation(row.id, 'Donated', '  Thank you, you saved my father.  ');
    const d = (await repo.getPool('G-8')).donors.find((x) => x.id === row.donor.id)!;
    expect(d.heldBy).toBeNull();
    expect(d.daysSinceDonation).toBe(0);
    const after = (await repo.getRequest(r.id))!;
    expect(after.donors[0]).toMatchObject({ state: 'Donated', feedback: 'Thank you, you saved my father.' });
    expect(after.status).toBe('Confirmed');
  });

  it('records a donation without a note, and refuses a note that is too long or an unconfirmed donor', async () => {
    const r = await submit({ patientId: (await patient()).id });
    await round(r.id);
    const row = (await repo.getRequest(r.id))!.donors[0];
    await expect(repo.confirmDonation(row.id, 'Donated')).rejects.toThrow(/not waiting/);
    await repo.respond(row.id, 'Accepted');
    await expect(repo.confirmDonation(row.id, 'Donated', 'x'.repeat(201))).rejects.toThrow(/200/);
    await repo.confirmDonation(row.id, 'Donated');
    expect((await repo.getRequest(r.id))!.donors[0].feedback).toBeNull();
    await expect(repo.confirmDonation(row.id, 'No show')).rejects.toThrow(/not waiting/);
  });

  it('shows the donor how many times they donated and the seeker’s thank-you, without naming the seeker', async () => {
    await auth.signOut();
    await auth.signUp({ role: 'donor', email: 'd@example.com', password: 'secret123', fullName: 'Dana Donor', donor: { bloodGroup: 'A+', sector: 'G-8' } });
    await auth.signOut();
    await auth.signIn('r@example.com', 'secret123');
    const r = await submit({ patientId: (await patient()).id });
    const mine = (await repo.getPool('G-8')).donors.find((d) => d.code === 'D-1001')!;
    await repo.recordRound({ requestId: r.id, audit, donors: [{ donorId: mine.id, rank: 1, p: 0.5, cost: 0 }] });
    await asDonor('d@example.com', async () => {
      const offer = (await repo.donorOffers())[0];
      expect(offer).toMatchObject({ verification: 'Verified', requestStatus: 'Awaiting response' });
      await repo.respond(offer.id, 'Accepted');
    });
    await repo.confirmDonation(`${r.id}:${mine.id}`, 'Donated', 'You are a hero.');
    await asDonor('d@example.com', async () => {
      const profile = (await repo.donorProfile())!;
      expect(profile.donated).toBe(1);
      expect(profile.thanks).toEqual([{ note: 'You are a hero.', at: expect.any(String) }]);
      expect(JSON.stringify(profile)).not.toContain('Rae');
    });
  });

  it('tells donors when a request went ahead unverified', async () => {
    await auth.signOut();
    await auth.signUp({ role: 'donor', email: 'd@example.com', password: 'secret123', fullName: 'Dana Donor', donor: { bloodGroup: 'A+', sector: 'G-8' } });
    await auth.signOut();
    await auth.signIn('r@example.com', 'secret123');
    const r = await submit({ patientId: (await patient()).id, pmdc: '99999-Z' });
    const mine = (await repo.getPool('G-8')).donors.find((d) => d.code === 'D-1001')!;
    await repo.recordRound({ requestId: r.id, audit, donors: [{ donorId: mine.id, rank: 1, p: 0.5, cost: 0 }] });
    await asDonor('d@example.com', async () => expect((await repo.donorOffers())[0].verification).toBe('Unverified'));
  });

  it('releases accepted donors 72 hours after confirmation even if the seeker never confirms', async () => {
    const r = await submit({ patientId: (await patient()).id });
    await round(r.id);
    const row = (await repo.getRequest(r.id))!.donors[0];
    await repo.respond(row.id, 'Accepted');
    now += 73 * HOUR;
    expect((await repo.getPool('G-8')).donors.find((d) => d.id === row.donor.id)!.heldBy).toBeNull();
  });

  it('a no-show reopens a confirmed request for another round', async () => {
    const r = await submit({ patientId: (await patient()).id });
    await round(r.id);
    const row = (await repo.getRequest(r.id))!.donors[0];
    await repo.respond(row.id, 'Accepted');
    await repo.confirmDonation(row.id, 'No show', 'ignored');
    const after = (await repo.getRequest(r.id))!;
    expect(after.status).toBe('Unfilled');
    expect(after.donors[0]).toMatchObject({ state: 'No show', feedback: null });
    await expect(round(r.id)).resolves.toMatchObject({ status: 'Awaiting response' });
  });

  it('only the seeker who raised the request can confirm', async () => {
    const r = await submit({ patientId: (await patient()).id });
    await round(r.id);
    const row = (await repo.getRequest(r.id))!.donors[0];
    await repo.respond(row.id, 'Accepted');
    await auth.signOut();
    await auth.signUp({ role: 'recipient', email: 'o@example.com', password: 'secret123', fullName: 'Other Person' });
    await expect(repo.confirmDonation(row.id, 'Donated')).rejects.toThrow(/not waiting/);
  });

  it('counts contacts in a rolling 30-day window', async () => {
    const r = await submit({ patientId: (await patient()).id });
    const { outcome } = await round(r.id);
    const id = outcome!.selected[0].donor.id;
    const before = (await repo.getPool('G-8')).donors.find((d) => d.id === id)!.contactsLast30d;
    now += 31 * 24 * HOUR;
    expect((await repo.getPool('G-8')).donors.find((d) => d.id === id)!.contactsLast30d).toBeLessThan(before);
  });
});

describe('conflicts between requests', () => {
  it('a critical request takes a donor a routine request is waiting on, when free donors run out', async () => {
    // Three routine AB- requests of 4 units hold every free rhesus-negative donor near G-8.
    const routine: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await submit({ patientId: (await patient({ bloodGroup: 'AB-' })).id, group: 'AB-', urgency: 'Routine', units: 4 });
      await round(r.id);
      routine.push(r.id);
    }
    const pool = (await repo.getPool('G-8')).donors;
    expect(pool.filter((d) => ['O-', 'A-', 'B-', 'AB-'].includes(d.group) && d.available && !d.heldBy && d.daysSinceDonation >= 90 && d.contactsLast30d < 3)).toEqual([]);

    const critical = await submit({ patientId: (await patient({ bloodGroup: 'AB-' })).id, group: 'AB-', urgency: 'Critical' });
    const { outcome, status } = await round(critical.id);
    expect(status).toBe('Awaiting response');
    expect(outcome!.preempted.length).toBe(outcome!.selected.length);
    expect(outcome!.preempted.length).toBeGreaterThan(0);
    const reassigned = (await Promise.all(routine.map((id) => repo.getRequest(id))))
      .flatMap((r) => r!.donors)
      .filter((d) => d.state === 'Reassigned')
      .map((d) => d.donor.id);
    expect(reassigned.sort()).toEqual(outcome!.preempted.slice().sort());
    const now2 = (await repo.getPool('G-8')).donors.filter((d) => outcome!.preempted.includes(d.id));
    expect(now2.every((d) => d.heldBy === critical.id)).toBe(true);
  });

  it('refuses to take a donor for a non-critical request', async () => {
    const a = await submit({ patientId: (await patient()).id });
    const { outcome } = await round(a.id);
    const b = await submit({ patientId: (await patient()).id, urgency: 'Urgent' });
    await expect(
      repo.recordRound({ requestId: b.id, audit, donors: [{ donorId: outcome!.selected[0].donor.id, rank: 1, p: 0.5, cost: 0 }] }),
    ).rejects.toBeInstanceOf(DonorUnavailableError);
  });
});

describe('scam reports from donors', () => {
  async function donorAccount(email: string) {
    await auth.signOut();
    await auth.signUp({ role: 'donor', email, password: 'secret123', fullName: 'Dana Donor', donor: { bloodGroup: 'A+', sector: 'G-8' } });
    await auth.signOut();
    await auth.signIn('r@example.com', 'secret123');
  }

  async function askDonor(requestId: string, code: string) {
    const d = (await repo.getPool('G-8')).donors.find((x) => x.code === code)!;
    await repo.recordRound({ requestId, audit, donors: [{ donorId: d.id, rank: 1, p: 0.5, cost: 0 }] });
  }

  it('lets a donor report only requests they were asked about, once per kind', async () => {
    await donorAccount('d@example.com');
    const r = await submit({ patientId: (await patient()).id });
    await asDonor('d@example.com', () => expect(repo.reportRequest({ requestId: r.id, kind: 'Suspected fraud', note: 'Looks fake to me.' })).rejects.toThrow(/asked about/));
    await askDonor(r.id, 'D-1001');
    await asDonor('d@example.com', async () => {
      await expect(repo.reportRequest({ requestId: r.id, kind: 'Suspected fraud', note: 'hi' })).rejects.toThrow(/5 to 500/);
      await repo.reportRequest({ requestId: r.id, kind: 'Suspected fraud', note: 'The family asked me to pay for the bag.' });
      await expect(repo.reportRequest({ requestId: r.id, kind: 'Suspected fraud', note: 'Again, the same thing.' })).rejects.toThrow(/already reported/);
      expect(await repo.myReports()).toEqual([expect.objectContaining({ requestCode: expect.any(String), kind: 'Suspected fraud' })]);
    });
    await expect(repo.reportRequest({ requestId: r.id, kind: 'Other', note: 'A recipient reporting.' })).rejects.toThrow(/donors/);
  });

  it('one report does not flag an account: a single donor can be wrong or hostile', async () => {
    await donorAccount('d@example.com');
    const r = await submit({ patientId: (await patient()).id });
    await askDonor(r.id, 'D-1001');
    await asDonor('d@example.com', () => repo.reportRequest({ requestId: r.id, kind: 'Asked for payment', note: 'They asked me for money.' }));
    expect((await repo.getRequest(r.id))!.status).toBe('Awaiting response');
    const next = await submit({ patientId: (await patient()).id });
    expect(next.flags.map((f) => f.code)).not.toContain('account-flagged');
  });

  it('two different donors reporting fraud flag the account, close its open requests and refuse its next ones', async () => {
    await donorAccount('d@example.com');
    await auth.signOut();
    await auth.signUp({ role: 'donor', email: 'e@example.com', password: 'secret123', fullName: 'Eli Donor', donor: { bloodGroup: 'A+', sector: 'G-8' } });
    await auth.signOut();
    await auth.signIn('r@example.com', 'secret123');
    const r = await submit({ patientId: (await patient()).id });
    await askDonor(r.id, 'D-1001');
    const r2 = await submit({ patientId: (await patient()).id });
    await askDonor(r2.id, 'D-1002');
    await asDonor('d@example.com', () => repo.reportRequest({ requestId: r.id, kind: 'Asked for payment', note: 'They asked me for money.' }));
    expect((await repo.getRequest(r.id))!.status).toBe('Awaiting response');
    await asDonor('e@example.com', () => repo.reportRequest({ requestId: r2.id, kind: 'Suspected fraud', note: 'The details did not match.' }));
    expect((await repo.getRequest(r.id))!.status).toBe('Cancelled');
    expect((await repo.getRequest(r2.id))!.status).toBe('Cancelled');
    const error = await submit({ patientId: (await patient()).id }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RequestRefusedError);
    expect((error as RequestRefusedError).flags.map((f) => f.code)).toContain('account-flagged');
  });

  it('wrong-detail reports are kept but never count towards flagging an account', async () => {
    await donorAccount('d@example.com');
    const r = await submit({ patientId: (await patient()).id });
    await askDonor(r.id, 'D-1001');
    await asDonor('d@example.com', () => repo.reportRequest({ requestId: r.id, kind: 'Wrong details', note: 'The hospital was wrong.' }));
    expect((await repo.getRequest(r.id))!.status).toBe('Awaiting response');
  });
});
