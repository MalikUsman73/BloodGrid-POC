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

export type RequestTone = 'ok' | 'bad' | 'warn';

export function requestTone(status: string): RequestTone {
  return status === 'Confirmed' ? 'ok' : status === 'Unfilled' ? 'bad' : 'warn';
}

export const STATUS_LABEL: Record<string, string> = {
  'Awaiting response': 'Waiting for donors',
  Confirmed: 'Confirmed',
  Unfilled: 'Not filled',
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
