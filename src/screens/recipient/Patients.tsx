import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Patient, RequestRow } from '../../data';
import { formatDate, plural } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { Badge, GroupChip, PageHeader } from '../../ui/kit';
import { IconPlus } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { findHospital } from '../../workflow';
import { RequestTable } from './Requests';

/** Every patient this account has raised a request for, with their full request history. Records are kept when requests are cleared. */
export function Patients() {
  const { repo, ready } = useApp();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, r] = await Promise.all([repo.listPatients(), repo.listRequests()]);
      setPatients(p);
      setRows(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load patient records.');
    }
  }, [repo]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Patient records you have created, with every request raised for each. Only you can see them."
        actions={<Link className="btn primary" to="/recipient/new"><IconPlus />New request</Link>}
      />
      <section className="card">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !patients ? (
          <Loading />
        ) : patients.length === 0 ? (
          <EmptyState title="No patient records yet" action={<Link className="btn primary" to="/recipient/new">Raise a request</Link>}>
            A record is created the first time you raise a request for a patient.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="cards">
              <thead>
                <tr><th>Patient</th><th>Record number</th><th>Hospital</th><th>Group</th><th className="r">Born</th><th>Requests</th><th>Added</th></tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const mine = rows.filter((r) => r.patientId === p.id);
                  const live = mine.filter((r) => ['Pending verification', 'Awaiting response', 'Unfilled'].includes(r.status)).length;
                  return (
                    <tr key={p.id} className="link" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                      <td className="first" data-label="Patient">{p.fullName}</td>
                      <td className="mono" data-label="Record number">{p.mrNumber}</td>
                      <td data-label="Hospital">{findHospital(p.hospitalId)?.name ?? p.hospitalId}</td>
                      <td data-label="Group"><GroupChip group={p.bloodGroup} /></td>
                      <td className="r num" data-label="Born">{p.birthYear}</td>
                      <td data-label="Requests">
                        {plural(mine.length, 'request')}
                        {live > 0 && <> <Badge tone="info">{live} open</Badge></>}
                      </td>
                      <td className="muted num nowrap" data-label="Added">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && patients && (
        <section className="card" style={{ marginTop: 20 }} aria-labelledby="ph-h">
          <div className="card-head">
            <h2 id="ph-h">Requests for {patients.find((p) => p.id === open)?.fullName}</h2>
          </div>
          {rows.some((r) => r.patientId === open) ? (
            <RequestTable rows={rows.filter((r) => r.patientId === open)} />
          ) : (
            <EmptyState title="No requests on record">Cleared requests are archived and no longer listed.</EmptyState>
          )}
        </section>
      )}
    </>
  );
}
