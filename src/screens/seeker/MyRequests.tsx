import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Clock, MapPin, Plus, Users } from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, GroupChip } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { getDonor } from '../../mock/donors';
import { statusTone } from './shared';

export default function MyRequests() {
  const { requests } = useApp();

  return (
    <>
      <PageHeader
        title="My Requests"
        subtitle="All blood requests raised from this account in the current prototype session."
        actions={<Button to="/seeker/request/new"><Plus className="w-4 h-4" /> New Blood Request</Button>}
      />

      <PageBody>
        {requests.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList className="w-8 h-8" />}
              title="No requests yet"
              message="Requests you raise will appear here with their current status."
              action={<Button to="/seeker/request/new" size="sm"><Plus className="w-3.5 h-3.5" /> New request</Button>}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <Th>Request</Th>
                    <Th>Group</Th>
                    <Th>Units</Th>
                    <Th>Urgency</Th>
                    <Th>Location</Th>
                    <Th>Raised</Th>
                    <Th>Contacted</Th>
                    <Th>Status</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => {
                    const names = r.contactedDonorIds
                      .map((id) => getDonor(id)?.name)
                      .filter(Boolean) as string[];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <Td>
                          <p className="font-medium text-slate-900">{r.patientRef}</p>
                          <p className="text-[11px] text-slate-400 nums">{r.id}</p>
                        </Td>
                        <Td><GroupChip group={r.bloodGroup} size="sm" /></Td>
                        <Td className="nums">{r.units}</Td>
                        <Td>
                          <Badge tone={r.urgency === 'Critical' ? 'red' : r.urgency === 'Urgent' ? 'amber' : 'slate'}>
                            {r.urgency}
                          </Badge>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" /> {r.sector}
                          </span>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-1 text-slate-600 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-400" /> {r.createdLabel}
                          </span>
                        </Td>
                        <Td>
                          {names.length === 0 ? (
                            <span className="text-slate-400 text-xs">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                              <Users className="w-3 h-3 text-slate-400" />
                              {names.length === 1 ? names[0] : `${names.length} donors`}
                            </span>
                          )}
                        </Td>
                        <Td><Badge tone={statusTone(r.status)}>{r.status}</Badge></Td>
                        <Td>
                          <Link
                            to={`/seeker/request/${r.id}/matches`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-crimson-700 hover:text-crimson-800 whitespace-nowrap"
                          >
                            View donors <ArrowRight className="w-3 h-3" />
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
