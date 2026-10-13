import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RequestDetail as Detail } from '../data';
import { DEFAULT_CONFIG, type AlgorithmOutcome, type MatchOutcome, type ObjectiveKey } from '../engine';
import { ALGORITHMS, OBJECTIVES, formatDate, pct } from '../lib/labels';
import { useApp } from '../state/AppContext';
import { recallOutcome } from '../state/outcomes';
import { Funnel } from '../ui/Funnel';
import { ObjectiveStrip } from '../ui/ObjectiveStrip';
import { SectorMap } from '../ui/SectorMap';
import { EmptyState, ErrorState, Loading } from '../ui/States';
import { statusTone } from './Requests';

type Tab = 'donors' | 'screening' | 'compare';

export function RequestDetail() {
  const { id = '' } = useParams();
  const { repo, ready } = useApp();
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('donors');
  const [pending, setPending] = useState<string | null>(null);
  const outcome = useMemo(() => recallOutcome(id), [id]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await repo.getRequest(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the request.');
    }
  }, [repo, id]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function respond(rowId: string, state: 'Accepted' | 'Declined') {
    setPending(rowId);
    try {
      await repo.respond(rowId, state);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the response.');
    } finally {
      setPending(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (detail === undefined) return <section className="card"><Loading rows={6} /></section>;
  if (detail === null) {
    return (
      <section className="card">
        <EmptyState title="Request not found" action={<Link className="btn" to="/requests">Back to requests</Link>}>
          It may have been cleared when the demo data was reset.
        </EmptyState>
      </section>
    );
  }

  const picked: Record<string, number> = {};
  for (const r of detail.donors) picked[r.donor.sector] = (picked[r.donor.sector] ?? 0) + 1;
  const accepted = detail.donors.filter((d) => d.state === 'Accepted').length;
  const partial = detail.donors.length < detail.k;

  return (
    <>
      <div className="page-head">
        <Link to="/requests" className="crumb">← Requests</Link>
        <h1>
          {detail.code} · {detail.recipientGroup}, {detail.units} {detail.units === 1 ? 'unit' : 'units'}
          {' '}<span className={`tag ${statusTone(detail.status)}`} style={{ verticalAlign: 'middle' }}>{detail.status}</span>
        </h1>
        <p>
          {detail.urgency} request in {detail.sector}, raised {formatDate(detail.createdAt)}.
          {' '}{accepted} of {detail.units} needed {detail.units === 1 ? 'donor has' : 'donors have'} accepted.
        </p>
      </div>

      {partial && (
        <div className="banner warn" role="status">
          <strong>Short contact set.</strong> {detail.k} donors were wanted, but only {detail.donors.length} were eligible. All of them were notified.
        </div>
      )}

      {detail.audit && (
        <section className="card" style={{ marginBottom: 20 }} aria-label="Objective values of the selected set">
          <ObjectiveStrip values={detail.audit.objectives} />
        </section>
      )}

      <section className="card">
        <div className="tabs" role="tablist">
          {(['donors', 'screening', 'compare'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'donors' ? 'Selected donors' : t === 'screening' ? 'Screening' : 'Compare methods'}
            </button>
          ))}
        </div>

        {tab === 'donors' && (
          <div className="detail-grid">
            <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Donor</th><th>Group</th><th>Sector</th>
                    <th className="r">Distance</th><th className="r">Last gave</th><th className="r">Responds</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {detail.donors.map((r) => (
                    <tr key={r.id}>
                      <td className="muted num">{r.rank}</td>
                      <td className="code">{r.donor.code}</td>
                      <td className="group">{r.donor.group}</td>
                      <td>{r.donor.sector}</td>
                      <td className="r num nowrap">{r.donor.distanceKm.toFixed(1)} km</td>
                      <td className="r num nowrap">{r.donor.daysSinceDonation} d</td>
                      <td className="r num">{pct(r.p)}</td>
                      <td>
                        <span className={`tag ${r.state === 'Accepted' ? 'ok' : r.state === 'Declined' ? 'bad' : ''}`}>{r.state}</span>
                      </td>
                      <td className="r nowrap">
                        {r.state === 'Sent' && (
                          <>
                            <button className="btn small" disabled={pending === r.id} onClick={() => void respond(r.id, 'Accepted')}>Accept</button>{' '}
                            <button className="btn small quiet" disabled={pending === r.id} onClick={() => void respond(r.id, 'Declined')}>Decline</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="detail-lower">
              <div>
                <SectorMap requestSector={detail.sector} picked={picked} radiusKm={DEFAULT_CONFIG.radiusKm} />
                <div className="legend">
                  <span><i className="hollow" />Request sector</span>
                  <span><i />Selected donors</span>
                  <span><i className="grey" />Other sectors</span>
                </div>
              </div>
              <div className="prose">
                <p>Donors are shown by code and sector only; identity is outside this module.</p>
                <p>
                  Accept and Decline stand in for the donor's own app. When {detail.units === 1 ? 'a donor accepts' : `${detail.units} donors accept`},
                  the rest are stood down and become available again.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'screening' && (
          <div className="card-body">
            {outcome ? (
              <Screening outcome={outcome} />
            ) : detail.audit ? (
              <dl className="kv">
                <dt>Donor pool</dt><dd className="num">{detail.audit.poolSize}</dd>
                <dt>Passed screening</dt><dd className="num">{detail.audit.eligibleSize}</dd>
                <dt>Search</dt><dd>{detail.audit.evaluated.toLocaleString()} contact sets evaluated, {detail.audit.frontSize} non-dominated</dd>
                <dt>Engine</dt><dd>{detail.audit.engineVersion}</dd>
              </dl>
            ) : (
              <EmptyState title="No screening record" />
            )}
          </div>
        )}

        {tab === 'compare' && (
          <div>
            {outcome && outcome.comparison.length > 0 ? (
              <Compare outcome={outcome} />
            ) : (
              <EmptyState title="Comparison not available">
                The method comparison is kept for the session in which a request is created. Create a new request to see it.
              </EmptyState>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function Screening({ outcome }: { outcome: MatchOutcome }) {
  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' }}>
      <Funnel stages={outcome.stages} poolSize={outcome.poolSize} />
      <dl className="kv" style={{ alignContent: 'start' }}>
        <dt>Donor pool</dt><dd className="num">{outcome.poolSize}</dd>
        <dt>Passed screening</dt><dd className="num">{outcome.eligibleCount}</dd>
        <dt>Contact set size</dt><dd className="num">{outcome.k}</dd>
        <dt>Sets evaluated</dt><dd className="num">{outcome.evaluated.toLocaleString()}</dd>
        <dt>Non-dominated</dt><dd className="num">{outcome.front.length}</dd>
        {outcome.warnings.map((w) => (<span key={w} style={{ gridColumn: '1 / -1' }} className="hint">{w}</span>))}
      </dl>
    </div>
  );
}

function bestFor(key: ObjectiveKey, rows: AlgorithmOutcome[]): number {
  const minimise = key === 'travel' || key === 'preservation';
  const values = rows.map((r) => r.objectives[key]);
  return minimise ? Math.min(...values) : Math.max(...values);
}

function Compare({ outcome }: { outcome: MatchOutcome }) {
  const chosen = new Set(outcome.comparison[0].donors.map((d) => d.donor.id));
  const best = Object.fromEntries(OBJECTIVES.map((o) => [o.key, bestFor(o.key, outcome.comparison)])) as Record<ObjectiveKey, number>;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              {OBJECTIVES.map((o) => <th className="r" key={o.key}>{o.label}</th>)}
              <th className="r">Shared with chosen</th>
              <th>Against the front</th>
            </tr>
          </thead>
          <tbody>
            {outcome.comparison.map((row) => (
              <tr key={row.algorithm}>
                <td>
                  <div className="cmp-name">{ALGORITHMS[row.algorithm].label}</div>
                  <div className="cmp-note">{ALGORITHMS[row.algorithm].note}</div>
                </td>
                {OBJECTIVES.map((o) => (
                  <td className={`r num${Math.abs(row.objectives[o.key] - best[o.key]) < 1e-9 ? ' best' : ''}`} key={o.key}>
                    {o.format(row.objectives[o.key])}
                  </td>
                ))}
                <td className="r num">{row.donors.filter((d) => chosen.has(d.donor.id)).length} of {row.donors.length}</td>
                <td>
                  <span className={`tag ${row.dominated ? 'bad' : 'ok'}`}>{row.dominated ? 'Beaten by another set' : 'Not beaten'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ padding: '12px 20px 16px' }}>
        A dot marks the best value in each column. “Beaten by another set” means some contact set is at least as good on all four objectives and
        better on one, so the method left value on the table.
      </p>
    </>
  );
}
