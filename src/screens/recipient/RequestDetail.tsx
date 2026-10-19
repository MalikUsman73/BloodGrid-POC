import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RequestDetail as Detail, RequestDonorRow } from '../../data';
import { type AlgorithmOutcome, type MatchOutcome, type ObjectiveKey } from '../../engine';
import {
  ALGORITHMS, DONOR_STATE_LABEL, fileSize, OBJECTIVES, STATUS_LABEL, VERIFICATION_LABEL, donorStateTone, formatDate, pct, plural, requestTone,
  severityTone, timeLeft, verificationTone,
} from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { recallOutcome, rememberOutcome } from '../../state/outcomes';
import { runRound } from '../../state/rounds';
import { Funnel } from '../../ui/Funnel';
import { ObjectiveStrip } from '../../ui/ObjectiveStrip';
import { NearbyBanks } from '../../ui/NearbyBanks';
import { SectorMap } from '../../ui/SectorMap';
import { Alert, Badge, Button, GroupChip, PageHeader, TextInput } from '../../ui/kit';
import { IconChevron } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { canEscalate, findDoctor, findHospital, matchConfigFor, MAX_ROUNDS } from '../../workflow';

type Tab = 'donors' | 'documents' | 'screening' | 'compare';
const TAB_LABEL: Record<Tab, string> = { donors: 'Donors', documents: 'Documents', screening: 'Screening', compare: 'Compare methods' };
const OPEN = ['Awaiting response', 'Unfilled'];

export function RequestDetail() {
  const { id = '' } = useParams();
  const { repo, ready } = useApp();
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('donors');
  const [pending, setPending] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(() => recallOutcome(id));
  const [busy, setBusy] = useState<'round' | 'cancel' | 'doc' | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

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

  // Donors answer from their own accounts and offers lapse on their own, so check back while the request is open.
  const open = !!detail && (OPEN.includes(detail.status) || detail.status === 'Confirmed');
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      void load();
    }, 15_000);
    return () => clearInterval(t);
  }, [open, load]);

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

  async function confirm(row: RequestDonorRow, outcome: 'Donated' | 'No show') {
    setPending(row.id);
    try {
      await repo.confirmDonation(row.id, outcome, notes[row.id] ?? '');
      toast.success(outcome === 'Donated' ? 'Donation recorded. Your thank-you note goes to the donor.' : 'Recorded. You can search for another donor.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record this.');
    } finally {
      setPending(null);
    }
  }

  async function nextRound() {
    if (!detail) return;
    setBusy('round');
    try {
      const r = await runRound(repo, detail);
      rememberOutcome(detail.id, r.outcome);
      setOutcome(r.outcome);
      toast.success(`${plural(r.outcome.selected.length, 'donor')} notified.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The round could not run.');
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!detail || !window.confirm('Cancel this request? Donors still being asked are released.')) return;
    setBusy('cancel');
    try {
      await repo.cancelRequest(detail.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel the request.');
    } finally {
      setBusy(null);
    }
  }

  async function openDocument() {
    if (!detail) return;
    setBusy('doc');
    try {
      const url = await repo.prescriptionUrl(detail.id);
      if (url) window.open(url, '_blank', 'noopener');
      else toast.error('The document is not available.');
    } finally {
      setBusy(null);
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

  const hospital = findHospital(detail.hospitalId);
  const picked: Record<string, number> = {};
  for (const r of detail.donors) picked[r.donor.sector] = (picked[r.donor.sector] ?? 0) + 1;
  const accepted = detail.donors.filter((d) => d.state === 'Accepted' || d.state === 'Donated').length;
  const toConfirm = detail.status === 'Confirmed' ? detail.donors.filter((d) => d.state === 'Accepted') : [];
  const firstRound = detail.status === 'Awaiting response' && detail.round === 0;
  const wider = detail.status === 'Unfilled' && canEscalate(detail.urgency, detail.round);
  const radius = matchConfigFor({ urgency: detail.urgency, round: Math.max(1, detail.round) }).radiusKm;
  const nextRadius = matchConfigFor({ urgency: detail.urgency, round: detail.round + 1 }).radiusKm;

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
            {detail.patientName} at {hospital?.name ?? detail.hospitalId}. {plural(detail.units, 'unit')} · {detail.urgency} · raised{' '}
            {formatDate(detail.createdAt)}. {accepted} {accepted === 1 ? 'donor has' : 'donors have'} accepted.
          </>
        }
        actions={
          OPEN.includes(detail.status) && (
            <Button variant="ghost" onClick={() => void cancel()} loading={busy === 'cancel'}>Cancel request</Button>
          )
        }
      />

      <div className="stack-sm" style={{ marginBottom: 20 }}>
        {detail.verification === 'Unverified' && detail.status !== 'Cancelled' && (
          <Alert tone="warn" title="Unverified request">
            BloodGrid could not check every detail, so donors see this request marked unverified. They can still choose to help.
          </Alert>
        )}
        {detail.urgency === 'Critical' && OPEN.includes(detail.status) && <NearbyBanks sector={detail.sector} />}
        {toConfirm.length > 0 && (
          <Alert tone="info" title="Confirm who came">
            <span>Enough donors accepted. After each donor has been to the hospital, tell us whether they came, and say thanks if you like.</span>
            <ul className="plain-list" style={{ marginTop: 10 }}>
              {toConfirm.map((row) => (
                <li key={row.id} style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 220px' }}>
                    <b className="mono">Donor {row.donor.code}</b> · {row.donor.group} · {row.donor.sector}
                    <TextInput
                      aria-label={`Thank-you note for donor ${row.donor.code}`} placeholder="Thank-you note (optional)" maxLength={200}
                      value={notes[row.id] ?? ''} onChange={(e) => setNotes((cur) => ({ ...cur, [row.id]: e.target.value }))}
                    />
                  </span>
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <Button size="sm" variant="primary" disabled={pending === row.id} onClick={() => void confirm(row, 'Donated')}>Donated</Button>
                    <Button size="sm" variant="ghost" disabled={pending === row.id} onClick={() => void confirm(row, 'No show')}>Did not come</Button>
                  </span>
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {firstRound && (
          <Alert tone="ok" title="Ready to find donors">
            <span>No donor has been asked yet. Find donors to notify those within {radius} km.</span>
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" size="sm" onClick={() => void nextRound()} loading={busy === 'round'}>Find donors</Button>
            </div>
          </Alert>
        )}
        {detail.status === 'Unfilled' && (
          <Alert tone="warn" title={`Round ${detail.round} ended short`}>
            {wider ? (
              <>
                <span>Not enough donors accepted in time. The next round searches up to {nextRadius} km and skips everyone already asked.</span>
                <div style={{ marginTop: 10 }}>
                  <Button variant="primary" size="sm" onClick={() => void nextRound()} loading={busy === 'round'}>Search wider</Button>
                </div>
              </>
            ) : (
              <span>
                All {MAX_ROUNDS[detail.urgency]} rounds for a {detail.urgency.toLowerCase()} request have run. Contact a blood bank{' '}
                directly, or raise the urgency in a new request if the situation has changed.
              </span>
            )}
          </Alert>
        )}
      </div>

      {detail.audit && detail.audit.objectives && (
        <section className="card" style={{ marginBottom: 20 }} aria-label="Objective values of the selected set">
          <ObjectiveStrip values={detail.audit.objectives} />
        </section>
      )}

      <section className="card">
        <div className="tabs" role="tablist">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === 'donors' && (
          <>
            {detail.donors.length === 0 ? (
              <EmptyState title="No donor contacted yet">Run a round to notify donors.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="cards">
                  <thead>
                    <tr>
                      <th>Round</th><th>Donor</th><th>Group</th><th>Sector</th>
                      <th className="r">Distance</th><th className="r">Likelihood</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.donors.map((r) => {
                      const left = r.state === 'Sent' ? timeLeft(r.deadline) : null;
                      return (
                        <tr key={r.id}>
                          <td className="muted num" data-label="Round">{r.round}.{r.rank}</td>
                          <td className="first mono" data-label="Donor">{r.donor.code}</td>
                          <td data-label="Group"><GroupChip group={r.donor.group} /></td>
                          <td data-label="Sector">{r.donor.sector}</td>
                          <td className="r num nowrap" data-label="Distance">{r.donor.distanceKm.toFixed(1)} km</td>
                          <td className="r num" data-label="Likelihood">{pct(r.p)}</td>
                          <td data-label="Status">
                            <Badge tone={donorStateTone(r.state)}>{DONOR_STATE_LABEL[r.state] ?? r.state}</Badge>
                            {left && <span className="hint" style={{ marginLeft: 8 }}>{left}</span>}
                          </td>
                          <td className="r nowrap" data-label="">
                            {r.state === 'Sent' && (
                              <span style={{ display: 'inline-flex', gap: 6 }} title="Demo only: answers on behalf of a pool donor who has no account">
                                <Button size="sm" disabled={pending === r.id} onClick={() => void respond(r.id, 'Accepted')}>Simulate accept</Button>
                                <Button size="sm" variant="ghost" disabled={pending === r.id} onClick={() => void respond(r.id, 'Declined')}>Decline</Button>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="detail-lower">
              <div>
                <SectorMap requestSector={detail.sector} picked={picked} radiusKm={radius} />
                <div className="legend">
                  <span><i className="hollow" />Request sector</span>
                  <span><i />Selected donors</span>
                  <span><i className="grey" />Other sectors</span>
                </div>
              </div>
              <div className="prose">
                <p>Donors are shown by code and sector only. Their names and contact details are never visible to you.</p>
                <p>
                  {detail.urgency === 'Urgent' ? 'An' : 'A'} {detail.urgency.toLowerCase()} offer lapses if the donor does not answer in time, and that donor is released. When enough
                  donors accept, the rest are stood down. A critical request elsewhere can take a donor who has not answered yet; you will see
                  that donor marked as taken by an emergency.
                </p>
                <p>Once the request is confirmed, tell us whether each donor came. A thank-you note motivates donors to come back.</p>
              </div>
            </div>
          </>
        )}

        {tab === 'documents' && <Documents detail={detail} onOpen={() => void openDocument()} opening={busy === 'doc'} />}

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
              <EmptyState title="No screening record">Screening runs with the first round of donor matching.</EmptyState>
            )}
          </div>
        )}

        {tab === 'compare' &&
          (outcome && outcome.comparison.length > 0 ? (
            <Compare outcome={outcome} />
          ) : (
            <EmptyState title="Comparison not available">
              The method comparison is kept for the session in which a round runs. Run a round to see it.
            </EmptyState>
          ))}

      </section>
    </>
  );
}

function Documents({ detail, onOpen, opening }: { detail: Detail; onOpen: () => void; opening: boolean }) {
  const rx = detail.prescription;
  const doctor = findDoctor(rx.pmdcNumber);
  return (
    <div className="card-body stack">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone={verificationTone(detail.verification)}>{VERIFICATION_LABEL[detail.verification] ?? detail.verification}</Badge>
      </div>
      <dl className="kv">
        <dt>Doctor</dt><dd>{rx.doctorName} · PMDC {rx.pmdcNumber}{doctor ? '' : ' (not in the register)'}</dd>
        <dt>Hospital</dt><dd>{findHospital(rx.hospitalId)?.name ?? rx.hospitalId}</dd>
        <dt>Dated</dt><dd>{rx.issuedOn}</dd>
        <dt>Prescribed</dt><dd>{plural(rx.unitsPrescribed, 'unit')} of {rx.bloodGroup}</dd>
        {rx.diagnosis && (<><dt>Reason</dt><dd>{rx.diagnosis}</dd></>)}
        <dt>File</dt><dd>{rx.fileName} · {fileSize(rx.fileSize)}</dd>
        <dt>Fingerprint</dt><dd className="mono" style={{ wordBreak: 'break-all' }}>{rx.fileHash.slice(0, 16)}…</dd>
      </dl>
      <div>
        <Button size="sm" onClick={onOpen} loading={opening}>View document</Button>
      </div>
      <div>
        <h3 className="sub-h">Checks</h3>
        {detail.flags.length === 0 ? (
          <p className="hint">Every automatic check passed.</p>
        ) : (
          <ul className="plain-list">
            {detail.flags.map((f) => (
              <li key={f.code}>
                <span>{f.message}</span>
                <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
