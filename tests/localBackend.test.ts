import { beforeEach, describe, expect, it } from 'vitest';
import { LocalAuth } from '../src/auth/localAuth';
import { AuthError } from '../src/auth/types';
import { LocalRepository } from '../src/data/localRepository';
import { DonorUnavailableError } from '../src/data';
import type { ObjectiveValues } from '../src/engine';

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
const audit = {
  algorithm: 'pareto', engineVersion: 'test', poolHash: 'x', poolSize: 1, eligibleSize: 1, frontSize: 1, evaluated: 1, shortlisted: false, objectives,
};

let storage: MemoryStorage;
let repo: LocalRepository;
let auth: LocalAuth;

beforeEach(() => {
  storage = new MemoryStorage();
  repo = new LocalRepository();
  auth = new LocalAuth(repo, storage);
});

const donorInput = { role: 'donor' as const, email: 'd@example.com', password: 'secret123', fullName: 'Dana Donor', donor: { bloodGroup: 'A+' as const, sector: 'G-8' } };
const recipientInput = { role: 'recipient' as const, email: 'r@example.com', password: 'secret123', fullName: 'Rae Recipient' };

async function raise(donorCodes: string[], units = 1) {
  return repo.createRequest({
    request: { recipientGroup: 'A+', units, urgency: 'Urgent', sector: 'G-8', k: donorCodes.length },
    donors: donorCodes.map((c, i) => ({ donorId: c, rank: i + 1, p: 0.5, cost: 0 })),
    audit,
  });
}

describe('demo accounts', () => {
  it('signs up, signs out and signs back in with the same password', async () => {
    const r = await auth.signUp(recipientInput);
    expect(r.status).toBe('signed-in');
    await auth.signOut();
    expect(await auth.current()).toBeNull();
    const p = await auth.signIn('R@Example.com', 'secret123');
    expect(p.role).toBe('recipient');
    expect(p.fullName).toBe('Rae Recipient');
  });

  it('rejects a wrong password and a duplicate email', async () => {
    await auth.signUp(recipientInput);
    await auth.signOut();
    await expect(auth.signIn('r@example.com', 'wrong-pass1')).rejects.toMatchObject({ code: 'invalid-credentials' });
    await expect(auth.signUp(recipientInput)).rejects.toBeInstanceOf(AuthError);
  });

  it('keeps no plain-text password in storage', async () => {
    await auth.signUp(recipientInput);
    expect(storage.getItem('bloodgrid.demo-accounts.v1')).not.toContain('secret123');
  });

  it('restores the session and re-adds donors after a reload', async () => {
    await auth.signUp(donorInput);
    const repo2 = new LocalRepository();
    const auth2 = new LocalAuth(repo2, storage);
    expect((await auth2.current())?.role).toBe('donor');
    expect((await repo2.donorProfile())?.group).toBe('A+');
  });

  it('puts a new donor in the pool with no history, so they are eligible', async () => {
    await auth.signUp(donorInput);
    const me = await repo.donorProfile();
    expect(me).toMatchObject({ code: 'D-1001', group: 'A+', sector: 'G-8', available: true, onHold: false });
    expect(me!.daysSinceDonation).toBeGreaterThanOrEqual(90);
    const pool = await repo.getPool('G-8');
    expect(pool.donors.some((d) => d.code === 'D-1001')).toBe(true);
  });
});

describe('roles', () => {
  it('stops a donor raising a request', async () => {
    await auth.signUp(donorInput);
    await expect(raise(['D-0001'])).rejects.toThrow(/recipient/);
  });

  it('shows a recipient only their own requests', async () => {
    await auth.signUp(recipientInput);
    const id = await raise(['D-0001']);
    expect((await repo.listRequests()).map((r) => r.id)).toEqual([id]);
    await auth.signOut();
    await auth.signUp({ ...recipientInput, email: 'other@example.com' });
    expect(await repo.listRequests()).toEqual([]);
    expect(await repo.getRequest(id)).toBeNull();
  });

  it('shows a donor only offers addressed to them, without the recipient', async () => {
    await auth.signUp(donorInput);
    await auth.signOut();
    await auth.signUp(recipientInput);
    await raise(['D-1001', 'D-0002']);
    await auth.signOut();
    await auth.signIn(donorInput.email, donorInput.password);
    const offers = await repo.donorOffers();
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ requestCode: 'BR-1001', state: 'Sent', units: 1 });
    expect(JSON.stringify(offers)).not.toContain('Rae');
  });
});

describe('responses', () => {
  async function setup() {
    await auth.signUp(donorInput);
    await auth.signOut();
    await auth.signUp(recipientInput);
    const id = await raise(['D-1001', 'D-0002'], 1);
    const detail = await repo.getRequest(id);
    const own = detail!.donors.find((d) => d.donor.code === 'D-1001')!.id;
    const pool = detail!.donors.find((d) => d.donor.code === 'D-0002')!.id;
    return { id, own, pool };
  }

  it('lets a recipient simulate an answer for a pool donor but not for a donor with an account', async () => {
    const { own, pool } = await setup();
    await expect(repo.respond(own, 'Accepted')).rejects.toThrow(/own account/);
    await expect(repo.respond(pool, 'Declined')).resolves.toBe('Awaiting response');
  });

  it('lets the donor accept for themselves, confirming the request and standing down the rest', async () => {
    const { id, own } = await setup();
    await auth.signOut();
    await auth.signIn(donorInput.email, donorInput.password);
    await expect(repo.respond(own, 'Accepted')).resolves.toBe('Confirmed');
    await auth.signOut();
    await auth.signIn(recipientInput.email, recipientInput.password);
    const detail = await repo.getRequest(id);
    expect(detail!.donors.map((d) => d.state).sort()).toEqual(['Accepted', 'Stood Down']);
  });

  it("refuses another donor's offer", async () => {
    const { own } = await setup();
    await auth.signOut();
    await auth.signUp({ ...donorInput, email: 'd2@example.com', fullName: 'Second Donor' });
    await expect(repo.respond(own, 'Accepted')).rejects.toThrow(/own account/);
  });

  it('will not answer an offer twice', async () => {
    const { pool } = await setup();
    await repo.respond(pool, 'Declined');
    await expect(repo.respond(pool, 'Accepted')).rejects.toThrow(/already/);
  });
});

describe('availability and holds', () => {
  it('keeps a paused donor out of new requests', async () => {
    await auth.signUp(donorInput);
    await repo.setAvailability(false);
    await auth.signOut();
    await auth.signUp(recipientInput);
    await expect(raise(['D-1001'])).rejects.toBeInstanceOf(DonorUnavailableError);
  });

  it('does not let a donor claim a donor already held by another request', async () => {
    await auth.signUp(recipientInput);
    await raise(['D-0001']);
    await expect(raise(['D-0001'])).rejects.toBeInstanceOf(DonorUnavailableError);
  });

  it('clearing requests releases the donors they held', async () => {
    await auth.signUp(recipientInput);
    await raise(['D-0001']);
    await repo.reset();
    expect(await repo.listRequests()).toEqual([]);
    await expect(raise(['D-0001'])).resolves.toMatch(/^local-/);
  });

  it('only lets donors change availability', async () => {
    await auth.signUp(recipientInput);
    await expect(repo.setAvailability(false)).rejects.toThrow(/donor/);
  });
});
