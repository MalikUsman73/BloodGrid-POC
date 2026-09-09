/**
 * Create Blood Request — the input to CCP 1.
 *
 * Pre-filled with the values used in the defense script (O+, Urgent, G-8,
 * 2 units) so the demonstration is repeatable, while every field stays editable.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Info, MapPin, ShieldCheck } from 'lucide-react';
import type { BloodGroup, Urgency } from '../../types';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import {
  Badge, Button, Card, CardHeader, Field, GroupChip, SegmentedOptions, inputClass,
} from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { SECTORS, donors } from '../../mock/donors';
import { DEMO_REQUEST_DEFAULTS } from '../../mock/requests';
import { COMPATIBILITY } from '../../engines/matching';

const GROUPS: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const URGENCIES: Urgency[] = ['Routine', 'Urgent', 'Critical'];

const URGENCY_HINT: Record<Urgency, string> = {
  Routine: 'Planned or scheduled transfusion. Donor wellbeing and reliability weigh more heavily.',
  Urgent: 'Needed within hours. Proximity and availability weigh more heavily.',
  Critical: 'Immediate need. Proximity and availability dominate the ranking.',
};

export default function CreateRequest() {
  const navigate = useNavigate();
  const { createRequest } = useApp();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(DEMO_REQUEST_DEFAULTS.bloodGroup);
  const [urgency, setUrgency] = useState<Urgency>(DEMO_REQUEST_DEFAULTS.urgency);
  const [sector, setSector] = useState(DEMO_REQUEST_DEFAULTS.sector);
  const [units, setUnits] = useState(DEMO_REQUEST_DEFAULTS.units);
  const [hospital, setHospital] = useState(DEMO_REQUEST_DEFAULTS.hospital);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const acceptable = COMPATIBILITY[bloodGroup];
  const poolCount = donors.filter(
    (d) => acceptable.includes(d.bloodGroup) && d.eligible,
  ).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (units < 1 || units > 10) {
      setError('Units required must be between 1 and 10.');
      return;
    }
    if (!hospital.trim()) {
      setError('Please enter the receiving facility.');
      return;
    }
    setError(null);
    const req = createRequest({ bloodGroup, urgency, sector, units, hospital: hospital.trim(), note: note.trim() || undefined });
    navigate(`/seeker/request/${req.id}/matching`);
  };

  return (
    <>
      <PageHeader
        title="Create Blood Request"
        subtitle="BloodGrid will screen the donor pool for compatibility and eligibility, then rank suitable donors."
        breadcrumb={
          <Button to="/seeker" variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Button>
        }
      />

      <PageBody>
        <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Patient requirement"
                subtitle="Blood group and quantity required for the transfusion"
              />
              <div className="p-5 space-y-5">
                <Field label="Blood group required" required>
                  <SegmentedOptions
                    options={GROUPS.map((g) => ({ value: g, label: g }))}
                    value={bloodGroup} onChange={setBloodGroup} columns={4}
                  />
                </Field>

                <Field
                  label="Units required" required
                  hint="One unit is approximately 450 ml of whole blood."
                >
                  <input
                    type="number" min={1} max={10} value={units}
                    onChange={(e) => setUnits(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Urgency"
                subtitle="Urgency changes how BloodGrid weighs the ranking criteria"
              />
              <div className="p-5 space-y-3">
                <SegmentedOptions
                  options={URGENCIES.map((u) => ({ value: u, label: u }))}
                  value={urgency} onChange={setUrgency} columns={3}
                />
                <p className="flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed">
                  <Info className="w-3.5 h-3.5 mt-px shrink-0 text-slate-400" />
                  {URGENCY_HINT[urgency]}
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Location & facility"
                subtitle="Sector-level location only — no street address is collected"
              />
              <div className="p-5 grid sm:grid-cols-2 gap-5">
                <Field label="Sector" required hint="Used to compute approximate donor distance.">
                  <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass}>
                    {SECTORS.map((s) => (
                      <option key={s.name} value={s.name}>Sector {s.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Receiving facility" required>
                  <input
                    type="text" value={hospital} onChange={(e) => setHospital(e.target.value)}
                    className={inputClass} placeholder="e.g. Central Regional Hospital"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Note for donors (optional)" hint="Do not include patient-identifying information.">
                    <textarea
                      value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                      className={inputClass} placeholder="e.g. Transfusion scheduled for this evening."
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-xs text-red-800 leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          {/* Live summary */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card>
              <CardHeader title="Request summary" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <GroupChip group={bloodGroup} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {units} unit{units > 1 ? 's' : ''} required
                    </p>
                    <Badge
                      tone={urgency === 'Critical' ? 'red' : urgency === 'Urgent' ? 'amber' : 'slate'}
                      className="mt-1"
                    >
                      {urgency}
                    </Badge>
                  </div>
                </div>

                <dl className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <Row label="Location"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />Sector {sector}</span></Row>
                  <Row label="Facility">{hospital || '—'}</Row>
                  <Row label="Accepts">{acceptable.join(', ')}</Row>
                  <Row label="Eligible pool">
                    <span className="font-semibold text-slate-900 nums">{poolCount} donors</span>
                  </Row>
                </dl>

                <Button type="submit" size="lg" full>
                  Find Matching Donors <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Patients are referenced by case number only. This prototype stores no patient
                records and no donor addresses.
              </p>
            </div>
          </div>
        </form>
      </PageBody>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-800 text-right min-w-0">{children}</dd>
    </div>
  );
}
