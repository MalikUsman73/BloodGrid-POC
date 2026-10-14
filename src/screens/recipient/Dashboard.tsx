import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RequestRow } from '../../data';
import { useApp } from '../../state/AppContext';
import { useSession } from '../../state/Session';
import { Button, PageHeader, Stat } from '../../ui/kit';
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

  const open = rows?.filter((r) => r.status === 'Awaiting response').length ?? 0;
  const confirmed = rows?.filter((r) => r.status === 'Confirmed').length ?? 0;
  const notified = rows?.reduce((n, r) => n + r.k, 0) ?? 0;
  const first = profile?.fullName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`Welcome, ${first}`}
        subtitle="Raise a request and follow how donors respond."
        actions={<Link className="btn primary" to="/recipient/new"><IconPlus />New request</Link>}
      />

      <div className="stats" style={{ marginBottom: 20 }}>
        <Stat label="Requests raised" value={rows?.length ?? '–'} icon={<IconActivity />} />
        <Stat label="Waiting for donors" value={rows ? open : '–'} icon={<IconClock />} />
        <Stat label="Confirmed" value={rows ? confirmed : '–'} icon={<IconCheck />} />
        <Stat label="Donors notified" value={rows ? notified : '–'} icon={<IconUsers />} />
      </div>

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
            Choose the blood group, units and urgency. BloodGrid does the rest.
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
