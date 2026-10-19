import type { AlgorithmId, ObjectiveKey } from '../engine';

export const OBJECTIVES: {
  key: ObjectiveKey;
  code: string;
  label: string;
  goal: 'Lower is better' | 'Higher is better';
  format: (v: number) => string;
}[] = [
  { key: 'travel', code: 'O1', label: 'Average travel', goal: 'Lower is better', format: (v) => `${v.toFixed(1)} km` },
  { key: 'recovery', code: 'O2', label: 'Average rest since last gift', goal: 'Higher is better', format: (v) => `${Math.round(v)} days` },
  { key: 'fulfilment', code: 'O3', label: 'Chance someone responds', goal: 'Higher is better', format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'preservation', code: 'O4', label: 'Rare-blood cost', goal: 'Lower is better', format: (v) => v.toFixed(0) },
];

export const ALGORITHMS: Record<AlgorithmId, { label: string; note: string }> = {
  nsga3: { label: 'NSGA-III', note: 'Evolutionary search over contact sets; one chosen from the non-dominated sets by urgency' },
  pareto: { label: 'Exact Pareto selection', note: 'Every contact set evaluated, when the pool is small enough; used to check NSGA-III' },
  weighted: { label: 'Weighted sum', note: 'The prototype score: one number per donor, top k taken' },
  greedy: { label: 'Sequential greedy', note: 'Nearest first, then exact group, then rarity' },
  nearest: { label: 'Nearest compatible', note: 'The k closest eligible donors' },
};

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export type RequestTone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';

export function requestTone(status: string): RequestTone {
  if (status === 'Confirmed') return 'ok';
  if (status === 'Unfilled') return 'bad';
  if (status === 'Cancelled') return 'neutral';
  return 'warn';
}

export const STATUS_LABEL: Record<string, string> = {
  'Awaiting response': 'Waiting for donors',
  Confirmed: 'Confirmed',
  Unfilled: 'Not filled',
  Cancelled: 'Cancelled',
};

export const DONOR_STATE_LABEL: Record<string, string> = {
  Sent: 'Asked',
  Accepted: 'Accepted',
  Declined: 'Declined',
  'Stood Down': 'Not needed',
  Expired: 'No answer in time',
  Reassigned: 'Taken by an emergency',
  Donated: 'Donated',
  'No show': 'Did not arrive',
};

export function donorStateTone(state: string): RequestTone {
  if (state === 'Accepted' || state === 'Donated') return 'ok';
  if (state === 'Declined' || state === 'No show') return 'bad';
  if (state === 'Sent') return 'info';
  if (state === 'Expired' || state === 'Reassigned') return 'warn';
  return 'neutral';
}

export const VERIFICATION_LABEL: Record<string, string> = {
  Verified: 'Checks passed',
  Unverified: 'Unverified: some details could not be checked',
};

export function verificationTone(v: string): RequestTone {
  return v === 'Verified' ? 'ok' : 'warn';
}

export const severityTone = (s: string): RequestTone => (s === 'high' ? 'bad' : s === 'medium' ? 'warn' : 'neutral');

/** Time left until an ISO deadline, in words, or null once it has passed. */
export function timeLeft(deadline: string, now = Date.now()): string | null {
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return null;
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  return `${hours} h ${mins % 60} min left`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
