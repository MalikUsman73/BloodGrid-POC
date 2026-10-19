import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RequestRow } from '../../data';
import { useApp } from '../../state/AppContext';
import { useSession } from '../../state/Session';
import { Alert, Button, PageHeader, Stat } from '../../ui/kit';
import { IconActivity, IconCheck, IconClock, IconPlus, IconUsers } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { RequestTable } from './Requests';

export function Dashboard() {
  const { repo, ready } = useApp();
  const { profile } = useSession();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setRows(await repo.listRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your requests.');
    }
  };

  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, repo]);

  const count = (s: RequestRow['status']) => rows?.filter((r) => r.status === s).length ?? 0;
  const attention = rows?.filter((r) => r.status === 'Unfilled') ?? [];
  const first = profile?.fullName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`Welcome, ${first}`}
        subtitle="Raise a request with the doctor’s prescription, and follow the donor responses."
        actions={<Link className="btn primary" to="/recipient/new"><IconPlus />New request</Link>}
      />

      <div className="stats" style={{ marginBottom: 20 }}>
        <Stat label="Needs another round" value={rows ? count('Unfilled') : '–'} icon={<IconActivity />} />
        <Stat label="Waiting for donors" value={rows ? count('Awaiting response') : '–'} icon={<IconClock />} />
        <Stat label="Confirmed" value={rows ? count('Confirmed') : '–'} icon={<IconCheck />} />
        <Stat label="Donors notified" value={rows ? rows.reduce((n, r) => n + r.k, 0) : '–'} icon={<IconUsers />} />
      </div>

      {attention.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="warn" title={`${attention.length === 1 ? 'One request needs' : `${attention.length} requests need`} another round`}>
            {attention.map((r, i) => (
              <span key={r.id}>{i > 0 && ', '}<Link to={`/recipient/requests/${r.id}`}>{r.code}</Link></span>
            ))}{' '}
            did not get enough donors in time. Open it to search wider.
          </Alert>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Recent requests</h2>
          <span className="end"><Link to="/recipient/requests">View all</Link></span>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title="No requests yet" action={<Link className="btn primary" to="/recipient/new">Raise your first request</Link>}>
            Add the patient, attach the prescription, and choose units and urgency. BloodGrid checks the request and asks donors near the hospital.
          </EmptyState>
        ) : (
          <RequestTable rows={rows.slice(0, 5)} />
        )}
      </section>
      <p className="hint" style={{ marginTop: 16 }}>
        <Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button>
      </p>
    </>
  );
}
