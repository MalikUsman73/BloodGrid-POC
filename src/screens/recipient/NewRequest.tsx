import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poolHash, SECTORS, DonorUnavailableError, type Pool } from '../../data';
import {
  BLOOD_GROUPS, DEFAULT_CONFIG, ENGINE_VERSION, URGENCIES, contactSetSize, runMatch, screenDonors,
  type BloodGroup, type MatchOutcome, type MatchRequest, type Urgency,
} from '../../engine';
import { rememberOutcome } from '../../state/outcomes';
import { useApp } from '../../state/AppContext';
import { Funnel } from '../../ui/Funnel';
import { Alert, Button, Field, PageHeader, Segmented, Select } from '../../ui/kit';
import { EmptyState, ErrorState, Loading } from '../../ui/States';

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
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setSubmitError(null);
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
          navigate(`/recipient/requests/${id}`);
          return;
        } catch (e) {
          // Another request claimed a donor between reading the pool and saving. Re-read and match again.
          if (!(e instanceof DonorUnavailableError) || attempt === 1) throw e;
        }
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'The request could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New blood request"
        subtitle="Tell us what is needed. BloodGrid screens the donor pool and notifies the best set of donors for you."
      />

      <div className="builder">
        <section className="card" aria-labelledby="req-h">
          <div className="card-head"><h2 id="req-h">Request details</h2></div>
          <div className="card-body">
            <div className="field">
              <span className="label" id="g-l">Blood group needed</span>
              <Segmented label="Blood group needed" value={group} options={BLOOD_GROUPS} onChange={setGroup} />
            </div>
            <div className="field">
              <span className="label" id="u-l">Units</span>
              <div className="stepper" role="group" aria-labelledby="u-l">
                <button type="button" aria-label="Fewer units" disabled={units <= 1} onClick={() => setUnits(units - 1)}>−</button>
                <output aria-live="polite">{units}</output>
                <button type="button" aria-label="More units" disabled={units >= 4} onClick={() => setUnits(units + 1)}>+</button>
              </div>
            </div>
            <div className="field">
              <span className="label">Urgency</span>
              <Segmented label="Urgency" value={urgency} options={URGENCIES} onChange={setUrgency} columns={3} />
              <p className="hint">{LEAN[urgency]}</p>
            </div>
            <Field label="Hospital sector" htmlFor="sector">
              <Select id="sector" value={sector} onChange={(e) => setSector(e.target.value)} style={{ maxWidth: 200 }}>
                {SECTORS.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </Select>
            </Field>

            {submitError && (
              <div style={{ marginTop: 18 }}><Alert tone="bad" title="Could not send the request">{submitError}</Alert></div>
            )}
            <div className="form-actions">
              <Button variant="primary" size="lg" onClick={() => void submit()} loading={busy} disabled={!pool}>
                {busy ? 'Finding donors' : 'Find donors'}
              </Button>
              <span className="hint">Saves the request and notifies the selected donors.</span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="prev-h">
          <div className="card-head">
            <h2 id="prev-h">Live screening preview</h2>
            <span className="sub end">Updates as you edit</span>
          </div>
          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : !screening || !pool ? (
            <Loading rows={5} />
          ) : (
            <>
              <div className="facts">
                <div className="fact"><div className="v num">{k}</div><div className="l">Donors to notify</div></div>
                <div className="fact"><div className="v num">{screening.eligible.length}</div><div className="l">Pass every rule</div></div>
                <div className="fact"><div className="v num">{pool.donors.length}</div><div className="l">In the pool</div></div>
              </div>
              <div className="card-body">
                {screening.eligible.length === 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Alert tone="bad" title="No donor can be notified for this request">See where the pool is lost below, or try another sector.</Alert>
                  </div>
                )}
                {screening.eligible.length > 0 && screening.eligible.length < k && (
                  <div style={{ marginBottom: 16 }}>
                    <Alert tone="warn" title={`Only ${screening.eligible.length} eligible`}>Every eligible donor would be notified.</Alert>
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
              : `No donor passes every rule for a ${failed.request.recipientGroup} request in ${failed.request.sector}. Nothing was saved and nobody was contacted.`}
          </EmptyState>
        </section>
      )}
    </>
  );
}
