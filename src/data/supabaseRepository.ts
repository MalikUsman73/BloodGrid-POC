import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BloodGroup, Donor, Urgency } from '../engine';
import { sectorDistanceKm } from './sectors';
import {
  DonorUnavailableError,
  type AuditRow,
  type DonorState,
  type Repository,
  type RequestDetail,
  type RequestRow,
  type RequestStatus,
} from './types';

const DAY_MS = 86_400_000;

export function daysSince(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(`${isoDate}T00:00:00Z`)) / DAY_MS));
}

interface DonorDbRow {
  id: string;
  code: string;
  blood_group: BloodGroup;
  sector_id: string;
  last_donation_date: string;
  available: boolean;
  accepted_count: number;
  received_count: number;
  contacts_last_30d: number;
  held_by: string | null;
}

export function toDonor(row: DonorDbRow, requestSector: string): Donor {
  return {
    id: row.id,
    code: row.code,
    group: row.blood_group,
    sector: row.sector_id,
    distanceKm: sectorDistanceKm(row.sector_id, requestSector),
    daysSinceDonation: daysSince(row.last_donation_date),
    available: row.available,
    heldBy: row.held_by,
    contactsLast30d: row.contacts_last_30d,
    accepted: row.accepted_count,
    received: row.received_count,
  };
}

interface RequestDbRow {
  id: string;
  code: string;
  recipient_group: BloodGroup;
  units: number;
  urgency: Urgency;
  sector_id: string;
  k: number;
  status: RequestStatus;
  created_at: string;
}

const toRequest = (r: RequestDbRow): RequestRow => ({
  id: r.id,
  code: r.code,
  recipientGroup: r.recipient_group,
  units: r.units,
  urgency: r.urgency,
  sector: r.sector_id,
  k: r.k,
  status: r.status,
  createdAt: r.created_at,
});

export class SupabaseRepository implements Repository {
  readonly source = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async getPool(sector: string) {
    const { data, error } = await this.client.from('donors').select('*').order('code');
    if (error) throw new Error(error.message);
    return { donors: (data as DonorDbRow[]).map((r) => toDonor(r, sector)), source: this.source };
  }

  async createRequest({ request, donors, audit }: Parameters<Repository['createRequest']>[0]) {
    const { data, error } = await this.client.rpc('record_match', {
      p_request: {
        recipient_group: request.recipientGroup,
        units: request.units,
        urgency: request.urgency,
        sector_id: request.sector,
        k: request.k,
      },
      p_donors: donors.map((d) => ({ donor_id: d.donorId, rank: d.rank, p: d.p, cost: d.cost })),
      p_audit: {
        algorithm: audit.algorithm,
        engine_version: audit.engineVersion,
        pool_hash: audit.poolHash,
        pool_size: audit.poolSize,
        eligible_size: audit.eligibleSize,
        front_size: audit.frontSize,
        evaluated: audit.evaluated,
        shortlisted: audit.shortlisted,
        objectives: audit.objectives,
      },
    });
    if (error) {
      if (error.message.includes('donor_unavailable')) throw new DonorUnavailableError();
      throw new Error(error.message);
    }
    return data as string;
  }

  async listRequests() {
    const { data, error } = await this.client
      .from('blood_requests')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RequestDbRow[]).map(toRequest);
  }

  async getRequest(id: string): Promise<RequestDetail | null> {
    const { data: req, error } = await this.client.from('blood_requests').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) return null;
    const request = toRequest(req as RequestDbRow);
    const [rds, audit] = await Promise.all([
      this.client.from('request_donors').select('*, donors(*)').eq('request_id', id).order('rank'),
      this.client.from('match_audit').select('*').eq('request_id', id).maybeSingle(),
    ]);
    if (rds.error) throw new Error(rds.error.message);
    if (audit.error) throw new Error(audit.error.message);
    const donors = (
      rds.data as { id: string; rank: number; state: DonorState; p: number; cost: number; donors: DonorDbRow }[]
    ).map((r) => ({
      id: r.id,
      rank: r.rank,
      state: r.state,
      p: Number(r.p),
      cost: Number(r.cost),
      donor: toDonor(r.donors, request.sector),
    }));
    const a = audit.data as Record<string, unknown> | null;
    const auditRow: AuditRow | null = a
      ? {
          algorithm: String(a.algorithm),
          engineVersion: String(a.engine_version),
          poolSize: Number(a.pool_size),
          eligibleSize: Number(a.eligible_size),
          frontSize: Number(a.front_size),
          evaluated: Number(a.evaluated),
          shortlisted: Boolean(a.shortlisted),
          objectives: a.objectives as AuditRow['objectives'],
        }
      : null;
    return { ...request, donors, audit: auditRow };
  }

  async respond(requestDonorId: string, state: 'Accepted' | 'Declined') {
    const { data, error } = await this.client.rpc('respond_to_request', {
      p_request_donor: requestDonorId,
      p_state: state,
    });
    if (error) throw new Error(error.message);
    return data as RequestStatus;
  }

  async reset() {
    const { error } = await this.client.rpc('reset_demo');
    if (error) throw new Error(error.message);
  }
}
