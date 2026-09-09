/**
 * Inter-bank coordination workflow (Tier 2).
 *
 * SCOPE NOTE — this is deliberately an ORDINARY APPLICATION WORKFLOW.
 * It raises a request to a partner facility and records it in session state.
 * It performs NO optimisation: no redistribution planning, no transportation
 * or routing optimisation, no allocation solver. It is not a third
 * computational component of this project, and must never be presented as one.
 *
 * Partner facilities and their indicative stock are fictional. No real blood
 * bank is integrated with, or partnered with, this project.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Info, MapPin, Send } from 'lucide-react';
import type { BloodGroup } from '../../types';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Field, SegmentedOptions, inputClass } from '../../components/ui';
import { IllustrativeNote, SimulatedTag } from '../../components/SimulatedBadge';
import { useApp } from '../../store/AppStore';
import { partnerBanks } from '../../mock/banks';
import { FORECAST_GROUPS } from '../../mock/demand';
import { getSeries } from '../../engines/forecast';

export default function Coordination() {
  const [params] = useSearchParams();
  const { interBank, addInterBank } = useApp();

  const initialGroup = (params.get('group') as BloodGroup) ?? 'O+';
  const [group, setGroup] = useState<BloodGroup>(
    FORECAST_GROUPS.includes(initialGroup) ? initialGroup : 'O+',
  );
  const [units, setUnits] = useState(Number(params.get('units')) || 20);
  const [bankId, setBankId] = useState(partnerBanks[0].id);
  const [sent, setSent] = useState<string | null>(null);

  const s = getSeries(group);
  const bank = partnerBanks.find((b) => b.id === bankId)!;

  const submit = () => {
    const req = addInterBank({ bankId: bank.id, bankName: bank.name, bloodGroup: group, units });
    setSent(req.id);
  };

  return (
    <>
      <PageHeader
        title="Inter-Bank Coordination"
        subtitle="Raise a coordination request with a partner facility. A standard application workflow — no optimisation is performed."
      />

      <PageBody>
        {/* Scope clarification, stated on the screen itself */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5">
          <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-xs text-sky-900 leading-relaxed">
            <strong>Scope note:</strong> inter-bank coordination is an ordinary application workflow
            in BloodGrid. It is not one of the project's computational components, and it performs no
            redistribution, allocation, or transportation optimisation. The project's two
            computational components are donor matching optimisation and blood demand predictive
            analysis.
          </p>
        </div>

        {sent && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 animate-fadeUp">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Coordination request {sent} recorded
              </p>
              <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
                {units} units of {group} requested from {bank.name}. Nothing has been transmitted —
                this prototype records the request in session state only.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Select partner facility"
                subtitle="Fictional demonstration facilities — no real blood bank is integrated"
                icon={<Building2 className="w-4 h-4" />}
                action={<SimulatedTag />}
              />
              <ul className="divide-y divide-slate-100">
                {partnerBanks.map((b) => {
                  const active = b.id === bankId;
                  const indicative = b.indicativeStock?.[group];
                  return (
                    <li key={b.id}>
                      <button
                        onClick={() => setBankId(b.id)}
                        className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors ${
                          active ? 'bg-crimson-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-4 h-4 shrink-0 rounded-full border-[5px] transition-colors ${
                          active ? 'border-crimson-600 bg-white' : 'border-slate-200 bg-white'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{b.name}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> Sector {b.sector} · {b.distanceKm} km
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">
                            Indicative {group}
                          </p>
                          <p className="text-sm font-semibold text-slate-900 nums">
                            {indicative ?? '—'}<span className="text-xs font-normal text-slate-400"> units</span>
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                <IllustrativeNote>
                  Indicative stock figures are simulated demonstration values. In the implemented
                  system these would come from a partner-facility integration, which is scheduled
                  for the implementation phase.
                </IllustrativeNote>
              </div>
            </Card>

            <Card>
              <CardHeader title="Request details" />
              <div className="p-5 grid sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <Field label="Blood group required" required>
                    <SegmentedOptions
                      options={FORECAST_GROUPS.map((g) => ({ value: g, label: g }))}
                      value={group} onChange={setGroup} columns={4}
                    />
                  </Field>
                </div>
                <Field label="Units requested" required hint="Prefilled from the indicative shortfall where available.">
                  <input
                    type="number" min={1} max={200} value={units}
                    onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Requesting facility">
                  <input type="text" value="Central Regional Blood Centre" readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
                </Field>
              </div>
            </Card>
          </div>

          <div className="lg:sticky lg:top-20 space-y-4">
            <Card>
              <CardHeader title="Request summary" />
              <div className="p-5 space-y-3">
                <Row label="Blood group"><span className="font-semibold text-crimson-700 nums">{group}</span></Row>
                <Row label="Units"><span className="nums">{units}</span></Row>
                <Row label="Partner"><span className="text-right">{bank.name}</span></Row>
                <Row label="Distance"><span className="nums">{bank.distanceKm} km</span></Row>
                <Row label="Our signal">
                  <Badge tone={s.shortageRisk ? 'red' : s.highDemand ? 'amber' : 'green'}>
                    {s.shortageRisk ? 'Shortage risk' : s.highDemand ? 'Elevated demand' : 'Stable'}
                  </Badge>
                </Row>
                <div className="pt-3 border-t border-slate-100">
                  <Button full size="lg" onClick={submit}>
                    <Send className="w-4 h-4" /> Send coordination request
                  </Button>
                </div>
              </div>
            </Card>

            {interBank.length > 0 && (
              <Card>
                <CardHeader title="Requests this session" />
                <ul className="divide-y divide-slate-100">
                  {interBank.map((r) => (
                    <li key={r.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900 nums">
                          {r.units} units of {r.bloodGroup}
                        </p>
                        <Badge tone="blue">Pending</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {r.bankName} · {r.id}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-800 min-w-0">{children}</span>
    </div>
  );
}
