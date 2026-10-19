import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RequestDetail as Detail } from '../../data';
import { DEFAULT_CONFIG, type AlgorithmOutcome, type MatchOutcome, type ObjectiveKey } from '../../engine';
import { ALGORITHMS, OBJECTIVES, formatDate, pct, plural, requestTone, STATUS_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { recallOutcome } from '../../state/outcomes';
import { Funnel } from '../../ui/Funnel';
import { ObjectiveStrip } from '../../ui/ObjectiveStrip';
import { SectorMap } from '../../ui/SectorMap';
import { Alert, Badge, Button, GroupChip, PageHeader, type Tone } from '../../ui/kit';
import { IconChevron } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type Tab = 'donors' | 'screening' | 'compare';
const TAB_LABEL: Record<Tab, string> = { donors: 'Selected donors', screening: 'Screening', compare: 'Compare methods' };
const stateTone = (s: string): Tone => (s === 'Accepted' ? 'ok' : s === 'Declined' ? 'bad' : s === 'Stood Down' ? 'neutral' : 'info');

export function RequestDetail() {
  const { id = '' } = useParams();
  const { repo, ready } = useApp();
  const toast = useToast();
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

  // Donors answer from their own accounts, so check back while the request is open.
  useEffect(() => {
    if (detail?.status !== 'Awaiting response') return;
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [detail?.status, load]);

  async function respond(rowId: string, state: 'Accepted' | 'Declined') {
    setPending(rowId);
    try {
      await repo.respond(rowId, state);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record the response.');
    } finally {
      setPending(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (detail === undefined) return <section className="card"><Loading rows={6} /></section>;
  if (detail === null) {
    return (
      <section className="card">
        <EmptyState title="Request not found" action={<Link className="btn" to="/recipient/requests">Back to requests</Link>}>
          It may belong to another account, or it was cleared.
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
      <Link to="/recipient/requests" className="crumb"><IconChevron />Requests</Link>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {detail.code}
            <GroupChip group={detail.recipientGroup} />
            <Badge tone={requestTone(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
          </span>
        }
        subtitle={
          <>
            {plural(detail.units, 'unit')} · {detail.urgency} · {detail.sector} · raised {formatDate(detail.createdAt)}.
            {' '}{accepted} of {detail.units} {detail.units === 1 ? 'donor has' : 'donors have'} accepted.
          </>
        }
      />

      {partial && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="warn" title="Short contact set">
            {detail.k} donors were wanted, but only {detail.donors.length} were eligible. All of them were notified.
          </Alert>
        </div>
      )}

      {detail.audit && (
        <section className="card" style={{ marginBottom: 20 }} aria-label="Objective values of the selected set">
          <ObjectiveStrip values={detail.audit.objectives} />
        </section>
      )}

      <section className="card">
        <div className="tabs" role="tablist">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>
          ))}
        </div>

        {tab === 'donors' && (
          <>
            <div className="table-wrap">
              <table className="cards">
                <thead>
                  <tr>
                    <th>#</th><th>Donor</th><th>Group</th><th>Sector</th>
                    <th className="r">Distance</th><th className="r">Last gave</th><th className="r">Likelihood</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {detail.donors.map((r) => (
                    <tr key={r.id}>
                      <td className="muted num" data-label="Rank">{r.rank}</td>
                      <td className="first mono" data-label="Donor">{r.donor.code}</td>
                      <td data-label="Group"><GroupChip group={r.donor.group} /></td>
                      <td data-label="Sector">{r.donor.sector}</td>
                      <td className="r num nowrap" data-label="Distance">{r.donor.distanceKm.toFixed(1)} km</td>
                      <td className="r num nowrap" data-label="Last gave">{r.donor.daysSinceDonation} d ago</td>
                      <td className="r num" data-label="Likelihood">{pct(r.p)}</td>
                      <td data-label="Status"><Badge tone={stateTone(r.state)}>{r.state}</Badge></td>
                      <td className="r nowrap" data-label="">
                        {r.state === 'Sent' && (
                          <span style={{ display: 'inline-flex', gap: 6 }} title="Demo only: answers on behalf of a pool donor who has no account">
                            <Button size="sm" disabled={pending === r.id} onClick={() => void respond(r.id, 'Accepted')}>Simulate accept</Button>
                            <Button size="sm" variant="ghost" disabled={pending === r.id} onClick={() => void respond(r.id, 'Declined')}>Decline</Button>
                          </span>
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
                <p>Donors are shown by code and sector only. Their names and contact details are never visible to you.</p>
                <p>
                  Donors with a BloodGrid account answer from their own app. For pool donors without one, the simulate buttons stand in so the
                  flow can be demonstrated. When {detail.units === 1 ? 'a donor accepts' : `${detail.units} donors accept`}, the rest are stood
                  down and become available again.
                </p>
              </div>
            </div>
          </>
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

        {tab === 'compare' &&
          (outcome && outcome.comparison.length > 0 ? (
            <Compare outcome={outcome} />
          ) : (
            <EmptyState title="Comparison not available">
              The method comparison is kept for the session in which a request is created. Raise a new request to see it.
            </EmptyState>
          ))}
      </section>
    </>
  );
}

function Screening({ outcome }: { outcome: MatchOutcome }) {
  return (
    <div className="builder" style={{ gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' }}>
      <Funnel stages={outcome.stages} poolSize={outcome.poolSize} />
      <dl className="kv" style={{ alignContent: 'start' }}>
        <dt>Donor pool</dt><dd className="num">{outcome.poolSize}</dd>
        <dt>Passed screening</dt><dd className="num">{outcome.eligibleCount}</dd>
        <dt>Contact set size</dt><dd className="num">{outcome.k}</dd>
        <dt>Sets evaluated</dt><dd className="num">{outcome.evaluated.toLocaleString()}</dd>
        <dt>Non-dominated</dt><dd className="num">{outcome.front.length}</dd>
        {outcome.algorithm === 'nsga3' && outcome.generations > 0 && (
          <><dt>Generations</dt><dd className="num">{outcome.generations}</dd></>
        )}
        {outcome.igd !== null && (
          <><dt>Gap to exact front</dt><dd className="num">{outcome.igd === 0 ? 'none' : outcome.igd.toFixed(3)}</dd></>
        )}
        {outcome.warnings.map((w) => (<span key={w} className="hint kv-wide">{w}</span>))}
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
                <td><Badge tone={row.dominated ? 'bad' : 'ok'}>{row.dominated ? 'Beaten by another set' : 'Not beaten'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ padding: '12px 20px 16px' }}>
        A dot marks the best value in each column. “Beaten by another set” means some contact set is at least as good on all four objectives
        and better on one, so the method left value on the table.
      </p>
    </>
  );
}
