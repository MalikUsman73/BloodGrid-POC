import type { MatchOutcome } from '../engine';

const KEY = 'bloodgrid.outcomes.v1';
const memory = new Map<string, MatchOutcome>();

function readAll(): Record<string, MatchOutcome> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, MatchOutcome>;
  } catch {
    return {};
  }
}

/** Remember the full engine result for a request so its screening and comparison can be shown again. */
export function rememberOutcome(id: string, outcome: MatchOutcome): void {
  memory.set(id, outcome);
  try {
    const all = readAll();
    // The front can hold thousands of sets and is not needed after creation.
    all[id] = { ...outcome, front: outcome.front.slice(0, 50) };
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable or full: the in-memory copy still works */
  }
}

export function recallOutcome(id: string): MatchOutcome | null {
  return memory.get(id) ?? readAll()[id] ?? null;
}
