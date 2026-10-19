import { DEFAULT_CONFIG, type MatchConfig, type Urgency } from '../engine';

/** How long a donor has to answer before the offer lapses and they are released. */
export const RESPONSE_MINUTES: Record<Urgency, number> = { Critical: 30, Urgent: 120, Routine: 720 };
/** After a request is confirmed, accepted donors stay held for this long unless the seeker confirms the outcome first. */
export const CONFIRMED_HOLD_HOURS = 72;
/** Service radius by matching round. Each round after the first searches further out. */
export const ROUND_RADIUS_KM = [15, 25, 40] as const;
/** Rounds allowed per request. A routine request does not widen past the second ring. */
export const MAX_ROUNDS: Record<Urgency, number> = { Routine: 2, Urgent: 3, Critical: 3 };

/** Matching rules for one round of one request: the service radius widens with each round. */
export function matchConfigFor(args: { urgency: Urgency; round: number; base?: MatchConfig }): MatchConfig {
  const base = args.base ?? DEFAULT_CONFIG;
  const round = Math.max(1, Math.min(args.round, MAX_ROUNDS[args.urgency]));
  return { ...base, radiusKm: Math.max(base.radiusKm, ROUND_RADIUS_KM[round - 1]) };
}

export function canEscalate(urgency: Urgency, round: number): boolean {
  return round < MAX_ROUNDS[urgency];
}

export function responseDeadline(sentAt: string, urgency: Urgency): string {
  return new Date(Date.parse(sentAt) + RESPONSE_MINUTES[urgency] * 60_000).toISOString();
}
