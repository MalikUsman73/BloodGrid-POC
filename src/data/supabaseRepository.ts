import type { SupabaseClient } from '@supabase/supabase-js';
import type { BloodGroup, Donor, Urgency } from '../engine';
import { sectorDistanceKm } from './sectors';
import {
  DonorUnavailableError,
  type AuditRow,
  type DonorOffer,
  type DonorProfile,
  type DonorState,
  type Repository,
  type RequestDetail,
  type RequestRow,
  type RequestStatus,
} from './types';

import { daysSince } from './dates';

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

  constructor(private readonly client: SupabaseClient) {}

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
      if (error.message.includes('not_allowed')) throw new Error('Only recipient accounts can raise requests.');
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
    if (error) {
      if (error.message.includes('not_allowed')) throw new Error('This donor answers from their own account.');
      if (error.message.includes('not_open')) throw new Error('This offer has already been answered or closed.');
      throw new Error(error.message);
    }
    return data as RequestStatus;
  }

  async reset() {
    const { error } = await this.client.rpc('reset_demo');
    if (error) throw new Error(error.message);
  }

  async donorProfile(): Promise<DonorProfile | null> {
    const { data, error } = await this.client.rpc('donor_profile');
    if (error) throw new Error(error.message);
    const r = (data as Record<string, unknown>[] | null)?.[0];
    if (!r) return null;
    return {
      code: String(r.code),
      group: r.blood_group as BloodGroup,
      sector: String(r.sector_id),
      lastDonationDate: String(r.last_donation_date),
      daysSinceDonation: daysSince(String(r.last_donation_date)),
      available: Boolean(r.available),
      accepted: Number(r.accepted_count),
      received: Number(r.received_count),
      onHold: Boolean(r.on_hold),
    };
  }

  async donorOffers(): Promise<DonorOffer[]> {
    const { data, error } = await this.client.rpc('donor_offers');
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.request_donor_id),
      requestCode: String(r.request_code),
      group: r.recipient_group as BloodGroup,
      units: Number(r.units),
      urgency: r.urgency as Urgency,
      sector: String(r.sector_id),
      state: r.state as DonorState,
      requestStatus: r.request_status as RequestStatus,
      offeredAt: String(r.offered_at),
    }));
  }

  async setAvailability(available: boolean) {
    const { error } = await this.client.rpc('set_availability', { p_available: available });
    if (error) throw new Error(error.message);
  }
}
