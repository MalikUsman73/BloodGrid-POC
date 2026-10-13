import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RequestRow } from '../data';
import { formatDate } from '../lib/labels';
import { useApp } from '../state/AppContext';
import { EmptyState, ErrorState, Loading } from '../ui/States';

export function statusTone(status: string): string {
  return status === 'Confirmed' ? 'ok' : status === 'Unfilled' ? 'bad' : 'warn';
}

export function Requests() {
  const { repo, ready } = useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await repo.listRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load requests.');
    }
  }, [repo]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function reset() {
    setResetting(true);
    try {
      await repo.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset the demo.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Requests</h1>
        <p>Every request raised in this demo, newest first.</p>
      </div>
      <section className="card">
        <div className="card-head">
          <h2>All requests</h2>
          <span className="meta">
            <button className="btn small quiet" onClick={() => void reset()} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset demo data'}
            </button>
          </span>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title="No requests yet" action={<Link className="btn primary" to="/new">Create a request</Link>}>
            Create one to see how donors are screened and selected.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th><th>Needs</th><th>Urgency</th><th>Sector</th>
                  <th className="r">Notified</th><th>Status</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="link" onClick={() => navigate(`/requests/${r.id}`)}>
                    <td className="code"><Link to={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.code}</Link></td>
                    <td><span className="group">{r.recipientGroup}</span> <span className="muted">· {r.units} {r.units === 1 ? 'unit' : 'units'}</span></td>
                    <td>{r.urgency}</td>
                    <td>{r.sector}</td>
                    <td className="r num">{r.k}</td>
                    <td><span className={`tag ${statusTone(r.status)}`}>{r.status}</span></td>
                    <td className="muted num">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
