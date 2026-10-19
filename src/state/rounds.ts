import { DonorUnavailableError, poolHash, type Repository, type RequestDetail, type RequestStatus } from '../data';
import { ENGINE_VERSION, runMatch, type MatchOutcome } from '../engine';
import { matchConfigFor } from '../workflow';

export interface RoundResult {
  status: RequestStatus;
  outcome: MatchOutcome;
}

/**
 * One matching round, the way the pipeline runs it: match donors for what is still needed at this
 * round's radius, skipping anyone already asked, then save the set. If a donor was claimed by someone
 * else in between, read the pool again and retry once.
 */
export async function runRound(repo: Repository, request: RequestDetail): Promise<RoundResult> {
  const round = request.round + 1;
  const accepted = request.donors.filter((d) => d.state === 'Accepted' || d.state === 'Donated').length;
  const need = request.units - accepted;
  const config = matchConfigFor({ urgency: request.urgency, round });
  const asked = request.donors.map((d) => d.donor.id);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pool = await repo.getPool(request.sector);
    // A 4 second budget: past it the greedy set is used and the result says so.
    const outcome = runMatch(
      pool.donors,
      { recipientGroup: request.recipientGroup, units: need, urgency: request.urgency, sector: request.sector, exclude: asked },
      config,
      {},
      { nsga3: { deadlineMs: 4000 } },
    );
    if (outcome.selected.length === 0) {
      throw new Error(
        outcome.status === 'empty-pool'
          ? 'There are no donors on record.'
          : `No eligible donor is available within ${config.radiusKm} km for this round.`,
      );
    }
    try {
      const status = await repo.recordRound({
        requestId: request.id,
        donors: outcome.selected.map((s, i) => ({ donorId: s.donor.id, rank: i + 1, p: s.p, cost: s.cost })),
        audit: {
          algorithm: outcome.algorithm,
          engineVersion: ENGINE_VERSION,
          poolHash: poolHash(pool.donors),
          poolSize: pool.donors.length,
          eligibleSize: outcome.eligibleCount,
          frontSize: outcome.front.length,
          evaluated: outcome.evaluated,
          shortlisted: outcome.shortlisted,
          objectives: outcome.objectives,
        },
      });
      return { status, outcome };
    } catch (e) {
      // Another request claimed a donor between reading and saving. Read again and match again.
      if (!(e instanceof DonorUnavailableError) || attempt === 1) throw e;
    }
  }
  throw new Error('unreachable');
}
