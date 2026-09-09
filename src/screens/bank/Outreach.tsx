/**
 * Donor outreach workflow (Tier 2).
 *
 * A campaign composer that records intent in local session state. No SMS,
 * email, push notification, or message of any kind is transmitted by this
 * prototype. Real notification delivery is scheduled for the implementation
 * phase.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, MapPin, Radio, Send, Users } from 'lucide-react';
import type { BloodGroup } from '../../types';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Field, SegmentedOptions, inputClass } from '../../components/ui';
import { IllustrativeNote, SimulatedTag } from '../../components/SimulatedBadge';
import { useApp } from '../../store/AppStore';
import { donors } from '../../mock/donors';
import { COMPATIBILITY } from '../../engines/matching';
import { FORECAST_GROUPS } from '../../mock/demand';
import { getSeries } from '../../engines/forecast';
import { availabilityTone } from '../seeker/shared';

export default function Outreach() {
  const [params] = useSearchParams();
  const { outreach, addOutreach } = useApp();

  const initialGroup = (params.get('group') as BloodGroup) ?? 'O+';
  const [group, setGroup] = useState<BloodGroup>(
    FORECAST_GROUPS.includes(initialGroup) ? initialGroup : 'O+',
  );
  const [availableOnly, setAvailableOnly] = useState(params.get('available') === '1');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<{ count: number; group: BloodGroup } | null>(null);

  const s = getSeries(group);

  const targets = useMemo(
    () =>
      donors.filter((d) => {
        if (!COMPATIBILITY[group].includes(d.bloodGroup)) return false;
        if (!d.eligible) return false;
        if (availableOnly && d.availability !== 'Available') return false;
        return true;
      }),
    [group, availableOnly],
  );

  const sectors = Array.from(new Set(targets.map((d) => d.sector))).sort();

  const launch = () => {
    addOutreach({ bloodGroup: group, sectors, donorCount: targets.length });
    setSent({ count: targets.length, group });
    setMessage('');
  };

  return (
    <>
      <PageHeader
        title="Donor Outreach"
        subtitle="Prepare an outreach campaign to eligible, compatible donors in response to a forecast signal."
      />

      <PageBody>
        {sent && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 animate-fadeUp">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Outreach campaign recorded for {sent.group}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
                {sent.count} compatible, eligible donor{sent.count === 1 ? '' : 's'} identified in the
                simulated pool. No message has been transmitted — this prototype records the campaign
                in session state only.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Campaign target" subtitle="Blood group and audience filter" icon={<Radio className="w-4 h-4" />} />
              <div className="p-5 space-y-5">
                <Field label="Blood group in demand" required>
                  <SegmentedOptions
                    options={FORECAST_GROUPS.map((g) => ({ value: g, label: g }))}
                    value={group} onChange={setGroup} columns={4}
                  />
                </Field>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox" checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
                  />
                  <span>
                    <span className="block text-xs font-medium text-slate-700">
                      Only donors currently marked available
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Narrows the audience to donors who have declared availability.
                    </span>
                  </span>
                </label>

                <Field
                  label="Campaign message (optional)"
                  hint="Do not include patient-identifying information."
                >
                  <textarea
                    rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                    className={inputClass}
                    placeholder={`e.g. ${group} donations are needed at Central Regional Blood Centre over the coming fortnight.`}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={`Matched audience — ${targets.length} donor${targets.length === 1 ? '' : 's'}`}
                subtitle="Compatible with the selected group and outside the 90-day donation interval"
                icon={<Users className="w-4 h-4" />}
                action={<SimulatedTag />}
              />
              {targets.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-slate-500">
                    No donors in the simulated pool match this filter.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                  {targets.map((d) => (
                    <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="w-9 h-8 shrink-0 grid place-items-center rounded-md bg-crimson-50 text-crimson-700 border border-crimson-200 text-[11px] font-bold nums">
                        {d.bloodGroup}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Sector {d.sector} · last donated {d.lastDonationDays} days ago
                        </p>
                      </div>
                      <Badge tone={availabilityTone(d.availability)}>{d.availability}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="lg:sticky lg:top-20 space-y-4">
            <Card>
              <CardHeader title="Campaign summary" />
              <div className="p-5 space-y-3">
                <Row label="Blood group"><span className="font-semibold text-crimson-700 nums">{group}</span></Row>
                <Row label="Audience"><span className="nums">{targets.length} donors</span></Row>
                <Row label="Sectors covered"><span className="nums">{sectors.length}</span></Row>
                <Row label="Forecast signal">
                  <Badge tone={s.shortageRisk ? 'red' : s.highDemand ? 'amber' : 'green'}>
                    {s.shortageRisk ? 'Shortage risk' : s.highDemand ? 'Elevated demand' : 'Stable'}
                  </Badge>
                </Row>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                    Sectors: {sectors.join(', ') || '—'}
                  </p>
                  <Button full size="lg" onClick={launch} disabled={targets.length === 0}>
                    <Send className="w-4 h-4" /> Launch outreach campaign
                  </Button>
                </div>

                <IllustrativeNote>
                  This prototype transmits nothing. The campaign is recorded in session state so the
                  workflow can be demonstrated end to end.
                </IllustrativeNote>
              </div>
            </Card>

            {outreach.length > 0 && (
              <Card>
                <CardHeader title="Campaigns this session" />
                <ul className="divide-y divide-slate-100">
                  {outreach.map((c) => (
                    <li key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 nums">
                          {c.bloodGroup} · {c.donorCount} donors
                        </p>
                        <p className="text-[11px] text-slate-500">{c.id} · {c.createdLabel}</p>
                      </div>
                      <Badge tone="green">Recorded</Badge>
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
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}
