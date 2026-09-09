import { Link } from 'react-router-dom';
import {
  ArrowRight, ClipboardList, Clock, Droplet, MapPin, Plus, Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, GroupChip, StatTile } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { donors } from '../../mock/donors';
import { statusTone } from './shared';

export default function SeekerDashboard() {
  const { requests } = useApp();
  const active = requests.filter((r) => r.status !== 'Fulfilled');
  const availableDonors = donors.filter((d) => d.availability === 'Available' && d.eligible).length;

  return (
    <>
      <PageHeader
        title="Blood Seeker Dashboard"
        subtitle="Raise a request for a patient and review ranked donor recommendations."
        actions={
          <Button to="/seeker/request/new">
            <Plus className="w-4 h-4" /> New Blood Request
          </Button>
        }
      />

      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Active requests" value={active.length}
            icon={<ClipboardList className="w-4 h-4" />}
            hint="Requests still awaiting fulfilment"
          />
          <StatTile
            label="Registered donors" value={donors.length}
            icon={<Users className="w-4 h-4" />} tone="blue"
            hint="Simulated donor pool in this prototype"
          />
          <StatTile
            label="Available now" value={availableDonors}
            icon={<Droplet className="w-4 h-4" />} tone="green"
            hint="Eligible and marked available"
          />
          <StatTile
            label="Your location" value="G-8"
            icon={<MapPin className="w-4 h-4" />}
            hint="Sector-level only, by design"
          />
        </div>

        {/* Primary call to action — the entry point to CCP 1 */}
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center p-6 bg-gradient-to-r from-crimson-50 to-white">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Need blood for a patient?</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-xl">
                Create a request with the required blood group, urgency and location. BloodGrid
                screens the donor pool for compatibility and eligibility, then ranks suitable
                donors against proximity, availability, donation recency and reliability.
              </p>
            </div>
            <Button to="/seeker/request/new" size="lg" className="shrink-0">
              Create Blood Request <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your requests"
            subtitle="Simulated demonstration records"
            icon={<ClipboardList className="w-4 h-4" />}
            action={
              requests.length > 0 && (
                <Button to="/seeker/requests" variant="ghost" size="sm">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )
            }
          />
          {requests.length === 0 ? (
            <EmptyState
              icon={<Droplet className="w-8 h-8" />}
              title="No requests yet"
              message="Create your first blood request to see ranked donor recommendations."
              action={<Button to="/seeker/request/new" size="sm"><Plus className="w-3.5 h-3.5" /> New request</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link
                    to={r.status === 'Matching' ? `/seeker/request/${r.id}/matches` : `/seeker/requests`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <GroupChip group={r.bloodGroup} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r.units} unit{r.units > 1 ? 's' : ''} · {r.patientRef}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Sector {r.sector}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.createdLabel}
                        </span>
                      </p>
                    </div>
                    <Badge tone={r.urgency === 'Critical' ? 'red' : r.urgency === 'Urgent' ? 'amber' : 'slate'}>
                      {r.urgency}
                    </Badge>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
