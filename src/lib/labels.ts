import type { AlgorithmId, ObjectiveKey } from '../engine';

export const OBJECTIVES: {
  key: ObjectiveKey;
  code: string;
  label: string;
  goal: 'Lower is better' | 'Higher is better';
  format: (v: number) => string;
}[] = [
  { key: 'travel', code: 'O1', label: 'Travel burden', goal: 'Lower is better', format: (v) => `${v.toFixed(1)} km` },
  { key: 'recovery', code: 'O2', label: 'Donor recovery', goal: 'Higher is better', format: (v) => `${Math.round(v)} days` },
  { key: 'fulfilment', code: 'O3', label: 'Expected fulfilment', goal: 'Higher is better', format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'preservation', code: 'O4', label: 'Type-preservation cost', goal: 'Lower is better', format: (v) => v.toFixed(0) },
];

export const ALGORITHMS: Record<AlgorithmId, { label: string; note: string }> = {
  pareto: { label: 'Exact Pareto selection', note: 'Every contact set evaluated; one chosen from the non-dominated sets by urgency' },
  weighted: { label: 'Weighted sum', note: 'The prototype score: one number per donor, top k taken' },
  greedy: { label: 'Sequential greedy', note: 'Nearest first, then exact group, then rarity' },
  nearest: { label: 'Nearest compatible', note: 'The k closest eligible donors' },
};

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
