import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poolHash, SECTORS, DonorUnavailableError, type Pool } from '../data';
import {
  BLOOD_GROUPS, DEFAULT_CONFIG, ENGINE_VERSION, URGENCIES, contactSetSize, runMatch, screenDonors,
  type BloodGroup, type MatchOutcome, type MatchRequest, type Urgency,
} from '../engine';
import { rememberOutcome } from '../state/outcomes';
import { useApp } from '../state/AppContext';
import { Funnel } from '../ui/Funnel';
import { EmptyState, ErrorState, Loading } from '../ui/States';

const LEAN: Record<Urgency, string> = {
  Routine: 'Leans toward donor recovery and conserving scarce blood groups.',
  Urgent: 'Balances speed, response likelihood, recovery and conservation.',
  Critical: 'Leans toward response likelihood and short travel.',
};

export function NewRequest() {
  const { repo, ready } = useApp();
  const navigate = useNavigate();
  const [group, setGroup] = useState<BloodGroup>('A+');
  const [units, setUnits] = useState(2);
  const [urgency, setUrgency] = useState<Urgency>('Urgent');
  const [sector, setSector] = useState('G-8');
  const [pool, setPool] = useState<Pool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<MatchOutcome | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPool(await repo.getPool(sector));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load donors.');
    }
  }, [repo, sector]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const request: MatchRequest = { recipientGroup: group, units, urgency, sector };
  const k = contactSetSize(units, urgency);
  const screening = useMemo(
    () => (pool ? screenDonors(pool.donors, request, DEFAULT_CONFIG) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, group, units, urgency, sector],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    setFailed(null);
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const fresh = await repo.getPool(sector);
        const outcome = runMatch(fresh.donors, request);
        if (outcome.status === 'empty-pool' || outcome.status === 'none-eligible') {
          setFailed(outcome);
          return;
        }
        try {
          const id = await repo.createRequest({
            request: { ...request, k: outcome.k },
            donors: outcome.selected.map((s, i) => ({ donorId: s.donor.id, rank: i + 1, p: s.p, cost: s.cost })),
            audit: {
              algorithm: 'pareto',
              engineVersion: ENGINE_VERSION,
              poolHash: poolHash(fresh.donors),
              poolSize: outcome.poolSize,
              eligibleSize: outcome.eligibleCount,
              frontSize: outcome.front.length,
              evaluated: outcome.evaluated,
              shortlisted: outcome.shortlisted,
              objectives: outcome.objectives!,
            },
          });
          rememberOutcome(id, outcome);
          navigate(`/requests/${id}`);
          return;
        } catch (e) {
          // Another request claimed a donor between reading the pool and saving. Re-read and match again.
          if (!(e instanceof DonorUnavailableError) || attempt === 1) throw e;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>New blood request</h1>
        <p>BloodGrid screens the donor pool, then chooses a set of donors to notify. The seeker never browses or picks donors.</p>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="req-h">
          <div className="card-head"><h2 id="req-h">Request</h2></div>
          <div className="card-body">
            <div className="field">
              <span className="label" id="g-l">Recipient blood group</span>
              <div className="choices groups" role="group" aria-labelledby="g-l">
                {BLOOD_GROUPS.map((g) => (
                  <button key={g} type="button" className="choice" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label" id="u-l">Units needed</span>
              <div className="stepper" role="group" aria-labelledby="u-l">
                <button type="button" aria-label="Fewer units" disabled={units <= 1} onClick={() => setUnits(units - 1)}>−</button>
                <output aria-live="polite">{units}</output>
                <button type="button" aria-label="More units" disabled={units >= 4} onClick={() => setUnits(units + 1)}>+</button>
              </div>
            </div>
            <div className="field">
              <span className="label" id="urg-l">Urgency</span>
              <div className="choices urgency" role="group" aria-labelledby="urg-l">
                {URGENCIES.map((u) => (
                  <button key={u} type="button" className="choice" aria-pressed={urgency === u} onClick={() => setUrgency(u)}>{u}</button>
                ))}
              </div>
              <span className="hint">{LEAN[urgency]}</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="sector">Sector of the hospital</label>
              <select id="sector" value={sector} onChange={(e) => setSector(e.target.value)}>
                {SECTORS.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={() => void submit()} disabled={busy || !pool}>
                {busy ? 'Matching…' : 'Find donors'}
              </button>
              <span className="hint">Saves the request and notifies the selected donors.</span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="prev-h">
          <div className="card-head">
            <h2 id="prev-h">Before you submit</h2>
            <span className="meta">Updates as you change the request</span>
          </div>
          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : !screening || !pool ? (
            <Loading rows={5} />
          ) : (
            <>
              <div className="facts">
                <div className="fact"><div className="v num">{k}</div><div className="l">Donors to notify</div></div>
                <div className="fact"><div className="v num">{screening.eligible.length}</div><div className="l">Pass every screening rule</div></div>
                <div className="fact"><div className="v num">{pool.donors.length}</div><div className="l">In the donor pool</div></div>
              </div>
              <div className="card-body">
                {screening.eligible.length === 0 && (
                  <div className="banner bad" role="status">
                    <strong>No donor can be notified for this request.</strong> See where the pool is lost below.
                  </div>
                )}
                {screening.eligible.length > 0 && screening.eligible.length < k && (
                  <div className="banner warn" role="status">
                    <strong>Only {screening.eligible.length} eligible.</strong> Every eligible donor would be notified.
                  </div>
                )}
                <Funnel stages={screening.stages} poolSize={pool.donors.length} />
              </div>
            </>
          )}
        </section>
      </div>

      {failed && (
        <section className="card" style={{ marginTop: 20 }} aria-live="polite">
          <EmptyState title={failed.status === 'empty-pool' ? 'The donor pool is empty' : 'No eligible donors'}>
            {failed.status === 'empty-pool'
              ? 'There are no donors on record, so nobody can be notified.'
              : `No donor passes every rule for a ${failed.request.recipientGroup} request in ${failed.request.sector}. Nothing was saved and nobody was contacted. Try another sector, or check the screening rules above.`}
          </EmptyState>
        </section>
      )}
    </>
  );
}
