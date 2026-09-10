/**
 * Donor outreach.
 *
 * A campaign composer. The prototype records the campaign in session state and
 * transmits nothing: there is no SMS, email, or push delivery behind it.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BloodGroup } from '../../types';
import {
  Button, ChoiceGroup, Detail, DetailList, Field, Notice,
  Page, PageTitle, Section, Status, inputStyles,
} from '../../components/ui';
import { Footnote } from '../../components/PrototypeLabels';
import { useApp } from '../../store/AppStore';
import { donors } from '../../mock/donors';
import { COMPATIBLE_DONOR_GROUPS } from '../../engines/matching';
import { FORECAST_GROUPS } from '../../mock/demand';
import { availabilityTone } from '../../lib/status';
import { pluralDonors } from '../../lib/format';

export default function Outreach() {
  const [searchParams] = useSearchParams();
  const { outreach, startOutreach } = useApp();

  const requested = searchParams.get('group') as BloodGroup | null;
  const [group, setGroup] = useState<BloodGroup>(
    requested && FORECAST_GROUPS.includes(requested) ? requested : 'O+',
  );
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('available') === '1');
  const [message, setMessage] = useState('');
  const [lastCampaign, setLastCampaign] = useState<{ count: number; group: BloodGroup } | null>(null);

  const audience = useMemo(
    () =>
      donors.filter((donor) => {
        if (!COMPATIBLE_DONOR_GROUPS[group].includes(donor.bloodGroup)) return false;
        if (!donor.eligible) return false;
        if (availableOnly && donor.availability !== 'Available') return false;
        return true;
      }),
    [group, availableOnly],
  );

  const sectors = Array.from(new Set(audience.map((donor) => donor.sector))).sort();

  function launchCampaign() {
    startOutreach({ bloodGroup: group, sectors, donorCount: audience.length });
    setLastCampaign({ count: audience.length, group });
    setMessage('');
  }

  return (
    <Page>
      <PageTitle
        title="Donor outreach"
        description="Prepare a campaign to eligible, compatible donors."
        back={{ to: '/bank/planning', label: 'Back to planning' }}
      />

      {lastCampaign && (
        <div className="mb-7 max-w-[720px]">
          <Notice tone="good" title={`Campaign recorded for ${lastCampaign.group}`}>
            {pluralDonors(lastCampaign.count)} identified in the simulated pool. Nothing has been
            transmitted: this prototype records the campaign in the current session only.
          </Notice>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-x-10 gap-y-8 items-start">
        <div>
          <Section title="Campaign">
            <div className="space-y-5 max-w-[460px]">
              <Field label="Blood group in demand">
                <ChoiceGroup
                  ariaLabel="Blood group in demand"
                  options={FORECAST_GROUPS.map((option) => ({ value: option, label: option }))}
                  value={group}
                  onChange={setGroup}
                />
              </Field>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(event) => setAvailableOnly(event.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-crimson-700 focus:ring-crimson-600"
                />
                <span>
                  <span className="block text-[12.5px] font-medium text-slate-800">
                    Only donors marked available
                  </span>
                  <span className="block mt-0.5 text-[12px] text-slate-500">
                    Narrows the audience to donors who have declared availability.
                  </span>
                </span>
              </label>

              <Field
                label="Message (optional)"
                hint="Do not include anything that identifies a patient."
                htmlFor="campaign-message"
              >
                <textarea
                  id="campaign-message" rows={3} value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className={inputStyles}
                  placeholder={`For example: ${group} donations are needed over the coming fortnight.`}
                />
              </Field>
            </div>
          </Section>

          <Section title={`Audience, ${pluralDonors(audience.length)}`}>
            {audience.length === 0 ? (
              <p className="text-[13px] text-slate-500">No donors match this filter.</p>
            ) : (
              <ul className="border border-slate-200 rounded-lg shadow-surface divide-y divide-slate-100 max-w-[560px] max-h-[320px] overflow-y-auto">
                {audience.map((donor) => (
                  <li key={donor.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-900">
                        {donor.name}
                        <span className="ml-2 text-slate-500 tabular-nums">{donor.bloodGroup}</span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">
                        Sector {donor.sector}, last donated {donor.lastDonationDays} days ago
                      </p>
                    </div>
                    <Status tone={availabilityTone(donor.availability)}>{donor.availability}</Status>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="lg:sticky lg:top-[76px] border border-slate-200 rounded-lg shadow-surface p-5">
          <h2 className="text-[13px] font-semibold text-slate-900">Summary</h2>
          <div className="mt-3">
            <DetailList>
              <Detail label="Blood group"><span className="tabular-nums font-medium">{group}</span></Detail>
              <Detail label="Donors"><span className="tabular-nums">{audience.length}</span></Detail>
              <Detail label="Sectors"><span className="tabular-nums">{sectors.length}</span></Detail>
            </DetailList>
          </div>

          <p className="mt-3 text-[11.5px] leading-[1.6] text-slate-500">
            {sectors.length > 0 ? sectors.join(', ') : 'No sectors covered'}
          </p>

          <Button
            variant="primary" block className="mt-4"
            onClick={launchCampaign} disabled={audience.length === 0}
          >
            Start outreach
          </Button>

          {outreach.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h3 className="text-[12px] font-medium text-slate-700">This session</h3>
              <ul className="mt-2 space-y-1.5">
                {outreach.map((campaign) => (
                  <li key={campaign.id} className="text-[12px] text-slate-600 tabular-nums">
                    {campaign.bloodGroup}, {pluralDonors(campaign.donorCount)}
                    <span className="text-slate-400"> ({campaign.id})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <Footnote>
              This prototype transmits nothing. The campaign is recorded so the workflow can be
              followed end to end.
            </Footnote>
          </div>
        </aside>
      </div>
    </Page>
  );
}
