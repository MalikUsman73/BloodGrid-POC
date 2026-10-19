import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../../data';
import { formatDate, requestTone, STATUS_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { Badge, GroupChip, PageHeader, Select, type Tone } from '../../ui/kit';
import { ReportProblem } from '../../ui/ReportProblem';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { findHospital } from '../../workflow';
import { useDonorData } from './useDonorData';

const answerTone = (s: string): Tone =>
  s === 'Accepted' || s === 'Donated' ? 'ok' : s === 'Declined' || s === 'No show' ? 'bad' : s === 'Sent' ? 'info' : s === 'Expired' ? 'warn' : 'neutral';
const ANSWER: Record<string, string> = {
  Sent: 'Waiting for you',
  Accepted: 'You said yes',
  Declined: 'You said no',
  'Stood Down': 'Not needed in the end',
  Expired: 'No answer in time',
  Reassigned: 'Moved to an emergency',
  Donated: 'You donated',
  'No show': 'Recorded as not arrived',
};

export function History() {
  const { repo } = useApp();
  const toast = useToast();
  const { offers, error, reload } = useDonorData(60_000);
  const [about, setAbout] = useState('');
  const [reports, setReports] = useState<Report[]>([]);

  const loadReports = useCallback(async () => {
    try {
      setReports(await repo.myReports());
    } catch {
      /* the history still works without the report list */
    }
  }, [repo]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const chosen = offers?.find((o) => o.requestId === about) ?? offers?.[0] ?? null;

  return (
    <>
      <PageHeader title="History" subtitle="Every request you were asked about, newest first." />
      <section className="card">
        {error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : offers === null ? (
          <Loading />
        ) : offers.length === 0 ? (
          <EmptyState title="No requests yet">When a request matches your group and sector, it will be listed here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="cards">
              <thead>
                <tr><th>Request</th><th>Group</th><th>Units</th><th>Urgency</th><th>Hospital</th><th>Your answer</th><th>Request status</th><th>Asked</th></tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td className="first mono" data-label="Request">{o.requestCode}</td>
                    <td data-label="Group"><GroupChip group={o.group} /></td>
                    <td className="num" data-label="Units">{o.units}</td>
                    <td data-label="Urgency">{o.urgency}</td>
                    <td data-label="Hospital">{findHospital(o.hospitalId)?.name ?? o.sector}</td>
                    <td data-label="Your answer"><Badge tone={answerTone(o.state)}>{ANSWER[o.state] ?? o.state}</Badge></td>
                    <td data-label="Request status"><Badge tone={requestTone(o.requestStatus)}>{STATUS_LABEL[o.requestStatus] ?? o.requestStatus}</Badge></td>
                    <td className="muted num nowrap" data-label="Asked">{formatDate(o.offeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {chosen && (
        <section className="card" style={{ marginTop: 20 }} aria-labelledby="rep-h">
          <div className="card-head"><h2 id="rep-h">Report a problem</h2></div>
          <div className="card-body stack-sm">
            <p className="hint">
              Donation through BloodGrid is always free. If anyone asked you for money, gave details that did not match, or the request looked
              fake, report it here. When several donors report fraud or payment demands on the same account, BloodGrid flags it and
              closes its open requests.
            </p>
            <div className="field">
              <label className="label" htmlFor="rep-req">Request</label>
              <Select id="rep-req" value={chosen.requestId} onChange={(e) => setAbout(e.target.value)}>
                {offers!.map((o) => <option key={o.id} value={o.requestId}>{o.requestCode} · {formatDate(o.offeredAt)}</option>)}
              </Select>
            </div>
            <ReportProblem
              key={chosen.requestId}
              repo={repo}
              requestId={chosen.requestId}
              onDone={() => {
                toast.success('Report sent. Thank you.');
                void loadReports();
              }}
            />
            {reports.length > 0 && (
              <ul className="plain-list" style={{ marginTop: 8 }}>
                {reports.map((d) => (
                  <li key={d.id}>
                    <span>{d.requestCode} · {d.kind}</span>
                    <span className="hint">{formatDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}
