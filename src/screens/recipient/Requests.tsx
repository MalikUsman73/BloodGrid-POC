import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RequestRow } from '../../data';
import { formatDate, requestTone, STATUS_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { Badge, Button, GroupChip, PageHeader } from '../../ui/kit';
import { IconPlus } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type Filter = 'all' | 'open' | 'confirmed' | 'unfilled';
const FILTERS: { id: Filter; label: string; match: (r: RequestRow) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'open', label: 'Open', match: (r) => r.status === 'Awaiting response' },
  { id: 'confirmed', label: 'Confirmed', match: (r) => r.status === 'Confirmed' },
  { id: 'unfilled', label: 'Not filled', match: (r) => r.status === 'Unfilled' },
];

export function RequestTable({ rows }: { rows: RequestRow[] }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="cards">
        <thead>
          <tr>
            <th>Request</th><th>Needs</th><th>Urgency</th><th>Sector</th><th className="r">Notified</th><th>Status</th><th>Raised</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="link" onClick={() => navigate(`/recipient/requests/${r.id}`)}>
              <td className="first mono" data-label="Request">
                <Link to={`/recipient/requests/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.code}</Link>
              </td>
              <td data-label="Needs"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><GroupChip group={r.recipientGroup} /><span className="muted">{r.units} {r.units === 1 ? 'unit' : 'units'}</span></span></td>
              <td data-label="Urgency">{r.urgency}</td>
              <td data-label="Sector">{r.sector}</td>
              <td className="r num" data-label="Notified">{r.k}</td>
              <td data-label="Status"><Badge tone={requestTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
              <td className="muted num nowrap" data-label="Raised">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Requests() {
  const { repo, ready } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
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

  const visible = useMemo(() => (rows ?? []).filter(FILTERS.find((f) => f.id === filter)!.match), [rows, filter]);

  async function reset() {
    setResetting(true);
    try {
      await repo.reset();
      await load();
      toast.success('Your requests were cleared and their donors released.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clear your requests.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Everything you have raised, newest first."
        actions={<Link className="btn primary" to="/recipient/new"><IconPlus />New request</Link>}
      />
      <section className="card">
        <div className="tabs" role="tablist" aria-label="Filter requests">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              {rows && <span className="count">{rows.filter(f.match).length}</span>}
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title="No requests yet" action={<Link className="btn primary" to="/recipient/new">Raise a request</Link>}>
            When you raise one, you will see the donors chosen and how each responds.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing in this view">No requests match this filter.</EmptyState>
        ) : (
          <RequestTable rows={visible} />
        )}
      </section>
      {rows && rows.length > 0 && (
        <p style={{ marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => void reset()} loading={resetting}>Clear my requests</Button>
          <span className="hint" style={{ marginLeft: 8 }}>Archives them and releases any donors still held.</span>
        </p>
      )}
    </>
  );
}
