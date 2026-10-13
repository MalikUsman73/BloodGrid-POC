import type { BloodGroup, Donor, ObjectiveValues, Urgency } from '../engine';
import { sectorDistanceKm } from './sectors';
import { generateDonors, type DonorRow } from './synthetic';
import {
  DonorUnavailableError,
  type AuditRow,
  type DonorState,
  type Repository,
  type RequestDetail,
  type RequestRow,
  type RequestStatus,
} from './types';

interface LocalRequest extends RequestRow {
  rows: { id: string; donorId: string; rank: number; state: DonorState; p: number; cost: number }[];
  audit: AuditRow;
}

/**
 * In-memory stand-in used when the database cannot be reached, so a demo never dies on
 * a network problem. State lasts until the page is reloaded. It follows the same rules
 * as the database functions.
 */
export class LocalRepository implements Repository {
  readonly source = 'local' as const;
  private base: DonorRow[] = generateDonors();
  private donors = new Map<string, DonorRow & { heldBy: string | null }>();
  private requests: LocalRequest[] = [];
  private seq = 1001;

  constructor() {
    this.resetDonors();
  }

  private resetDonors() {
    this.donors = new Map(this.base.map((d) => [d.code, { ...d, heldBy: null }]));
  }

  private toDonor(row: DonorRow & { heldBy: string | null }, sector: string): Donor {
    return {
      id: row.code,
      code: row.code,
      group: row.group,
      sector: row.sector,
      distanceKm: sectorDistanceKm(row.sector, sector),
      daysSinceDonation: row.daysSinceDonation,
      available: row.available,
      heldBy: row.heldBy,
      contactsLast30d: row.contactsLast30d,
      accepted: row.accepted,
      received: row.received,
    };
  }

  async getPool(sector: string) {
    return { donors: [...this.donors.values()].map((d) => this.toDonor(d, sector)), source: this.source };
  }

  async createRequest({ request, donors, audit }: Parameters<Repository['createRequest']>[0]) {
    for (const d of donors) {
      if (this.donors.get(d.donorId)?.heldBy) throw new DonorUnavailableError();
    }
    const id = `local-${this.seq}`;
    const code = `BR-${this.seq}`;
    this.seq += 1;
    this.requests.unshift({
      id,
      code,
      recipientGroup: request.recipientGroup as BloodGroup,
      units: request.units,
      urgency: request.urgency as Urgency,
      sector: request.sector,
      k: request.k,
      status: 'Awaiting response',
      createdAt: new Date().toISOString(),
      rows: donors.map((d) => ({ id: `${id}:${d.donorId}`, ...d, state: 'Sent' as DonorState })),
      audit: {
        algorithm: audit.algorithm,
        engineVersion: audit.engineVersion,
        poolSize: audit.poolSize,
        eligibleSize: audit.eligibleSize,
        frontSize: audit.frontSize,
        evaluated: audit.evaluated,
        shortlisted: audit.shortlisted,
        objectives: audit.objectives as ObjectiveValues,
      },
    });
    for (const d of donors) {
      const row = this.donors.get(d.donorId);
      if (row) {
        row.heldBy = id;
        row.contactsLast30d += 1;
        row.received += 1;
      }
    }
    return id;
  }

  async listRequests() {
    return this.requests.map((r) => ({
      id: r.id, code: r.code, recipientGroup: r.recipientGroup, units: r.units, urgency: r.urgency,
      sector: r.sector, k: r.k, status: r.status, createdAt: r.createdAt,
    }));
  }

  async getRequest(id: string): Promise<RequestDetail | null> {
    const r = this.requests.find((x) => x.id === id);
    if (!r) return null;
    const { rows, audit, ...request } = r;
    return {
      ...request,
      audit,
      donors: rows.map((row) => ({
        id: row.id,
        rank: row.rank,
        state: row.state,
        p: row.p,
        cost: row.cost,
        donor: this.toDonor(this.donors.get(row.donorId) as DonorRow & { heldBy: string | null }, r.sector),
      })),
    };
  }

  async respond(requestDonorId: string, state: 'Accepted' | 'Declined'): Promise<RequestStatus> {
    const r = this.requests.find((x) => requestDonorId.startsWith(`${x.id}:`));
    const row = r?.rows.find((x) => x.id === requestDonorId);
    if (!r || !row || row.state !== 'Sent') throw new Error('not_open');
    row.state = state;
    const donor = this.donors.get(row.donorId);
    if (donor) {
      if (state === 'Accepted') donor.accepted += 1;
      else donor.heldBy = null;
    }
    if (r.rows.filter((x) => x.state === 'Accepted').length >= r.units) {
      for (const x of r.rows.filter((y) => y.state === 'Sent')) {
        x.state = 'Stood Down';
        const d = this.donors.get(x.donorId);
        if (d) d.heldBy = null;
      }
      r.status = 'Confirmed';
    } else if (r.rows.every((x) => x.state !== 'Sent')) {
      r.status = 'Unfilled';
    }
    return r.status;
  }

  async reset() {
    this.requests = [];
    this.resetDonors();
  }
}
