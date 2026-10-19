import { describe, expect, it } from 'vitest';
import {
  BURST_LIMIT, NO_HISTORY, decide, detectFlags, validateRequest, type RequestInput,
} from '../src/workflow';

const NOW = new Date('2026-10-19T09:00:00Z');
const HASH = 'a'.repeat(64);

function input(overrides: { patient?: Partial<RequestInput['patient']>; prescription?: Partial<RequestInput['prescription']>; units?: number; urgency?: RequestInput['urgency'] } = {}): RequestInput {
  return {
    units: overrides.units ?? 2,
    urgency: overrides.urgency ?? 'Urgent',
    patient: { fullName: 'Ali Raza', mrNumber: 'CGH-2026-0042', hospitalId: 'H-CGH', bloodGroup: 'A+', birthYear: 1980, ...overrides.patient },
    prescription: {
      doctorName: 'Dr. Sana Malik', pmdcNumber: '10234-P', hospitalId: 'H-CGH', issuedOn: '2026-10-18', bloodGroup: 'A+',
      unitsPrescribed: 2, diagnosis: 'Post-operative anaemia',
      document: { name: 'rx.pdf', type: 'application/pdf', size: 120_000, hash: HASH },
      ...overrides.prescription,
    },
  };
}

describe('request validation', () => {
  it('accepts a complete, consistent request', () => {
    expect(validateRequest(input(), NO_HISTORY, NOW)).toEqual({});
  });

  it('requires a prescription document of an allowed type and size', () => {
    expect(validateRequest(input({ prescription: { document: null } }), NO_HISTORY, NOW).document).toMatch(/Attach/);
    const doc = { name: 'x.exe', type: 'application/x-msdownload', size: 10, hash: HASH };
    expect(validateRequest(input({ prescription: { document: doc } }), NO_HISTORY, NOW).document).toMatch(/PDF/);
    const big = { name: 'x.pdf', type: 'application/pdf', size: 6 * 1024 * 1024, hash: HASH };
    expect(validateRequest(input({ prescription: { document: big } }), NO_HISTORY, NOW).document).toMatch(/5 MB/);
    const empty = { name: 'x.pdf', type: 'application/pdf', size: 0, hash: HASH };
    expect(validateRequest(input({ prescription: { document: empty } }), NO_HISTORY, NOW).document).toMatch(/empty/);
  });

  it('refuses more units than the doctor prescribed', () => {
    expect(validateRequest(input({ units: 3 }), NO_HISTORY, NOW).units).toMatch(/allows 2 units/);
  });

  it('refuses a prescription whose blood group disagrees with the patient record', () => {
    expect(validateRequest(input({ prescription: { bloodGroup: 'B+' } }), NO_HISTORY, NOW).prescriptionGroup).toMatch(/B\+.*A\+/);
  });

  it('checks the PMDC number format and the record number', () => {
    const e = validateRequest(input({ prescription: { pmdcNumber: '12' }, patient: { mrNumber: '?' } }), NO_HISTORY, NOW);
    expect(e.pmdcNumber).toBeDefined();
    expect(e.mrNumber).toBeDefined();
  });

  it('refuses future and expired prescriptions', () => {
    expect(validateRequest(input({ prescription: { issuedOn: '2026-10-20' } }), NO_HISTORY, NOW).issuedOn).toMatch(/future/);
    expect(validateRequest(input({ prescription: { issuedOn: '2026-08-01' } }), NO_HISTORY, NOW).issuedOn).toMatch(/older than 30/);
    expect(validateRequest(input({ prescription: { issuedOn: 'yesterday' } }), NO_HISTORY, NOW).issuedOn).toBeDefined();
  });

  it('refuses an unknown hospital and an implausible birth year', () => {
    const e = validateRequest(input({ patient: { hospitalId: 'H-NOPE', birthYear: 1850 } }), NO_HISTORY, NOW);
    expect(e.hospitalId).toBeDefined();
    expect(e.birthYear).toBeDefined();
  });

  it('blocks a second open request for the same patient', () => {
    expect(validateRequest(input(), { ...NO_HISTORY, openForPatient: 1 }, NOW).duplicate).toMatch(/already has an open request/);
  });

  it('refuses zero, fractional and too many units', () => {
    for (const units of [0, 1.5, 5]) {
      expect(validateRequest(input({ units, prescription: { unitsPrescribed: 10 } }), NO_HISTORY, NOW).units).toBeDefined();
    }
  });
});

describe('fraud and misuse flags', () => {
  it('raises nothing for a clean request from a registered doctor', () => {
    expect(detectFlags(input(), NO_HISTORY, NOW)).toEqual([]);
  });

  it('flags a reused prescription document as high severity', () => {
    const flags = detectFlags(input(), { ...NO_HISTORY, documentUses: 2 }, NOW);
    expect(flags).toEqual([expect.objectContaining({ code: 'document-reused', severity: 'high' })]);
  });

  it('flags a record number seen with another blood group', () => {
    const flags = detectFlags(input(), { ...NO_HISTORY, patientGroups: ['A+', 'O-'] }, NOW);
    expect(flags.map((f) => f.code)).toEqual(['patient-group-conflict']);
    expect(flags[0].message).toContain('O-');
  });

  it('flags a burst of requests, a flagged account, an old prescription and an unknown doctor', () => {
    const flags = detectFlags(
      input({ prescription: { issuedOn: '2026-10-05', pmdcNumber: '99999-Z' } }),
      { ...NO_HISTORY, requestsLast24h: BURST_LIMIT, accountFlagged: true },
      NOW,
    );
    expect(flags.map((f) => f.code).sort()).toEqual(['account-flagged', 'request-burst', 'stale-prescription', 'unregistered-doctor']);
  });

  it('notes a doctor registered elsewhere and a prescription from another hospital', () => {
    const flags = detectFlags(input({ prescription: { pmdcNumber: '31455-F', hospitalId: 'H-FMC' } }), NO_HISTORY, NOW);
    expect(flags.map((f) => f.code).sort()).toEqual(['hospital-mismatch']);
    const elsewhere = detectFlags(input({ prescription: { pmdcNumber: '31455-F' } }), NO_HISTORY, NOW);
    expect(elsewhere.map((f) => [f.code, f.severity])).toEqual([['doctor-elsewhere', 'low']]);
  });

  it('notes many units on a routine request', () => {
    const flags = detectFlags(input({ units: 3, urgency: 'Routine', prescription: { unitsPrescribed: 4 } }), NO_HISTORY, NOW);
    expect(flags.map((f) => f.code)).toEqual(['many-units']);
  });
});

describe('verification decision', () => {
  const medium = (code: 'stale-prescription' | 'request-burst' | 'unregistered-doctor') => ({ code, severity: 'medium' as const, message: '' });

  it('verifies a request with no flags or only low ones', () => {
    expect(decide([])).toBe('Verified');
    expect(decide([{ code: 'many-units', severity: 'low', message: '' }])).toBe('Verified');
  });

  it('lets a request with one or two medium flags go ahead as unverified, so a legitimate odd detail is not refused', () => {
    expect(decide([medium('stale-prescription')])).toBe('Unverified');
    expect(decide([medium('stale-prescription'), medium('request-burst')])).toBe('Unverified');
  });

  it('refuses a request with a serious flag', () => {
    for (const code of ['document-reused', 'patient-group-conflict', 'account-flagged'] as const) {
      expect(decide([{ code, severity: 'high', message: '' }])).toBe('Rejected');
    }
  });

  it('refuses a request that collects several medium flags', () => {
    expect(decide([medium('stale-prescription'), medium('request-burst'), medium('unregistered-doctor')])).toBe('Rejected');
  });
});
