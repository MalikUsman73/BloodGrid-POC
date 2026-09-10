/**
 * Inter-bank coordination.
 *
 * Deliberately an ordinary application workflow: it raises a request to a
 * partner facility and records it in session state. It runs no optimisation,
 * no redistribution planning, no routing, and no allocation solver, and it is
 * not a computational component of this project.
 *
 * Partner facilities and their indicative stock are fictional.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BloodGroup } from '../../types';
import {
  Button, ChoiceGroup, Detail, DetailList, Field, Notice,
  Page, PageTitle, Section, inputStyles,
} from '../../components/ui';
import { Footnote } from '../../components/PrototypeLabels';
import { useApp } from '../../store/AppStore';
import { partnerBanks } from '../../mock/banks';
import { FORECAST_GROUPS } from '../../mock/demand';

const DEFAULT_UNITS = 20;
const MAX_UNITS = 200;

export default function Coordination() {
  const [searchParams] = useSearchParams();
  const { interBank, requestFromPartnerBank } = useApp();

  const requested = searchParams.get('group') as BloodGroup | null;
  const [group, setGroup] = useState<BloodGroup>(
    requested && FORECAST_GROUPS.includes(requested) ? requested : 'O+',
  );
  const [units, setUnits] = useState(Number(searchParams.get('units')) || DEFAULT_UNITS);
  const [bankId, setBankId] = useState(partnerBanks[0].id);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const bank = partnerBanks.find((partner) => partner.id === bankId)!;

  function sendCoordinationRequest() {
    const created = requestFromPartnerBank({
      bankId: bank.id, bankName: bank.name, bloodGroup: group, units,
    });
    setLastRequestId(created.id);
  }

  return (
    <Page>
      <PageTitle
        title="Inter-bank coordination"
        description="Request units from a partner facility. A standard workflow, with no optimisation behind it."
        back={{ to: '/bank/planning', label: 'Back to planning' }}
      />

      {lastRequestId && (
        <div className="mb-7 max-w-[720px]">
          <Notice tone="good" title={`Request ${lastRequestId} recorded`}>
            {units} units of {group} requested from {bank.name}. Nothing has been transmitted:
            this prototype records the request in the current session only.
          </Notice>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-x-10 gap-y-8 items-start">
        <div>
          <Section title="Partner facility">
            <ul className="border border-slate-200 rounded-lg shadow-surface divide-y divide-slate-100 max-w-[560px]">
              {partnerBanks.map((partner) => {
                const selected = partner.id === bankId;
                return (
                  <li key={partner.id}>
                    <button
                      type="button"
                      onClick={() => setBankId(partner.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-4 transition-colors ${
                        selected ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-4 shrink-0 ${
                          selected ? 'border-crimson-700 bg-white' : 'border-slate-300 bg-white'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-slate-900">{partner.name}</span>
                        <span className="block mt-0.5 text-[11.5px] text-slate-500">
                          Sector {partner.sector}, {partner.distanceKm} km
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[13px] font-medium text-slate-900 tabular-nums">
                          {partner.indicativeStock?.[group] ?? 0}
                        </span>
                        <span className="block text-[11px] text-slate-500">units of {group}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 max-w-[560px]">
              <Footnote>
                Indicative stock figures are simulated. In the implemented system these would come
                from a partner-facility integration, which is implementation-phase work.
              </Footnote>
            </div>
          </Section>

          <Section title="Request">
            <div className="space-y-5 max-w-[460px]">
              <Field label="Blood group required">
                <ChoiceGroup
                  ariaLabel="Blood group required"
                  options={FORECAST_GROUPS.map((option) => ({ value: option, label: option }))}
                  value={group}
                  onChange={setGroup}
                />
              </Field>

              <Field label="Units requested" htmlFor="coordination-units">
                <input
                  id="coordination-units" type="number" min={1} max={MAX_UNITS} value={units}
                  onChange={(event) => setUnits(Math.max(1, Number(event.target.value)))}
                  className={`${inputStyles} max-w-[120px]`}
                />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-[76px] border border-slate-200 rounded-lg shadow-surface p-5">
          <h2 className="text-[13px] font-semibold text-slate-900">Summary</h2>
          <div className="mt-3">
            <DetailList>
              <Detail label="Blood group"><span className="tabular-nums font-medium">{group}</span></Detail>
              <Detail label="Units"><span className="tabular-nums">{units}</span></Detail>
              <Detail label="Partner">{bank.name}</Detail>
              <Detail label="Distance"><span className="tabular-nums">{bank.distanceKm} km</span></Detail>
            </DetailList>
          </div>

          <Button variant="primary" block className="mt-4" onClick={sendCoordinationRequest}>
            Send request
          </Button>

          {interBank.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h3 className="text-[12px] font-medium text-slate-700">This session</h3>
              <ul className="mt-2 space-y-1.5">
                {interBank.map((entry) => (
                  <li key={entry.id} className="text-[12px] text-slate-600">
                    <span className="tabular-nums">{entry.units} units of {entry.bloodGroup}</span>
                    <span className="block text-slate-400 truncate">{entry.bankName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <Footnote>
              Inter-bank coordination is not a computational component of this project. BloodGrid
              has exactly two: donor matching optimisation and blood demand predictive analysis.
            </Footnote>
          </div>
        </aside>
      </div>
    </Page>
  );
}
