/**
 * The request form. Its single job is to let a seeker describe what the patient
 * needs and submit it, so everything else on the screen stays out of the way.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BloodGroup, Urgency } from '../../types';
import {
  BloodGroup as BloodGroupTag, Button, ChoiceGroup, Detail, DetailList, Field,
  Notice, Page, PageTitle, Section, inputStyles,
} from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { SECTORS } from '../../mock/donors';
import { REQUEST_FORM_DEFAULTS } from '../../mock/requests';
import { COMPATIBLE_DONOR_GROUPS, donorsToNotify, isContactable } from '../../engines/matching';
import { pluralDonors } from '../../lib/format';

const BLOOD_GROUPS: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const URGENCY_LEVELS: Urgency[] = ['Routine', 'Urgent', 'Critical'];

const URGENCY_EXPLANATION: Record<Urgency, string> = {
  Routine: 'Planned transfusion. Donation recency and reliability carry more weight in the ranking.',
  Urgent: 'Needed within hours. Proximity and availability carry more weight.',
  Critical: 'Immediate need. Proximity and availability dominate the ranking.',
};

const MAX_UNITS = 10;

export default function CreateRequest() {
  const navigate = useNavigate();
  const { createBloodRequest, donors } = useApp();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(REQUEST_FORM_DEFAULTS.bloodGroup);
  const [urgency, setUrgency] = useState<Urgency>(REQUEST_FORM_DEFAULTS.urgency);
  const [sector, setSector] = useState(REQUEST_FORM_DEFAULTS.sector);
  const [units, setUnits] = useState(REQUEST_FORM_DEFAULTS.units);
  const [facility, setFacility] = useState(REQUEST_FORM_DEFAULTS.facility);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const acceptedGroups = COMPATIBLE_DONOR_GROUPS[bloodGroup];
  const contactablePool = donors.filter(
    (donor) =>
      acceptedGroups.includes(donor.bloodGroup) && donor.eligible && isContactable(donor),
  ).length;

  function submitBloodRequest(event: React.FormEvent) {
    event.preventDefault();

    if (!Number.isFinite(units) || units < 1 || units > MAX_UNITS) {
      setError(`Units required must be between 1 and ${MAX_UNITS}.`);
      return;
    }
    if (!facility.trim()) {
      setError('Enter the receiving facility.');
      return;
    }

    setError(null);
    const request = createBloodRequest({
      bloodGroup, urgency, sector, units,
      facility: facility.trim(),
      note: note.trim() || undefined,
    });
    navigate(`/seeker/request/${request.id}/matching`);
  }

  return (
    <Page>
      <PageTitle
        title="Create blood request"
        description="BloodGrid will screen registered donors for compatibility and eligibility, then rank those who remain."
        back={{ to: '/seeker', label: 'Back to blood requests' }}
      />

      <form onSubmit={submitBloodRequest} className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-x-10 gap-y-8 items-start">
        <div>
          <Section title="Requirement">
            <div className="space-y-5 max-w-[520px]">
              <Field label="Blood group required">
                <ChoiceGroup
                  ariaLabel="Blood group required"
                  options={BLOOD_GROUPS.map((group) => ({ value: group, label: group }))}
                  value={bloodGroup}
                  onChange={setBloodGroup}
                />
              </Field>

              <Field label="Units required" hint="One unit is roughly 450 ml of whole blood." htmlFor="units">
                <input
                  id="units" type="number" min={1} max={MAX_UNITS} value={units}
                  onChange={(event) => setUnits(Number(event.target.value))}
                  className={`${inputStyles} max-w-[120px]`}
                />
              </Field>

              <Field label="Urgency" hint={URGENCY_EXPLANATION[urgency]}>
                <ChoiceGroup
                  ariaLabel="Urgency"
                  options={URGENCY_LEVELS.map((level) => ({ value: level, label: level }))}
                  value={urgency}
                  onChange={setUrgency}
                  columns={3}
                />
              </Field>
            </div>
          </Section>

          <Section title="Location and facility" description="BloodGrid records the sector only. Street addresses are never collected.">
            <div className="grid sm:grid-cols-2 gap-5 max-w-[520px]">
              <Field label="Sector" htmlFor="sector">
                <select
                  id="sector" value={sector}
                  onChange={(event) => setSector(event.target.value)}
                  className={inputStyles}
                >
                  {SECTORS.map((entry) => (
                    <option key={entry.name} value={entry.name}>Sector {entry.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Receiving facility" htmlFor="facility">
                <input
                  id="facility" type="text" value={facility}
                  onChange={(event) => setFacility(event.target.value)}
                  className={inputStyles}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Note for donors (optional)" hint="Do not include anything that identifies the patient." htmlFor="note">
                  <textarea
                    id="note" rows={3} value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={inputStyles}
                    placeholder="For example: transfusion scheduled for this evening."
                  />
                </Field>
              </div>
            </div>
          </Section>

          {error && (
            <div className="mt-6 max-w-[520px]">
              <Notice tone="urgent">{error}</Notice>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-[76px] border border-slate-200 rounded-lg shadow-surface p-5">
          <h2 className="text-[13px] font-semibold text-slate-900">Summary</h2>

          <div className="mt-4 flex items-center gap-3">
            <BloodGroupTag group={bloodGroup} size="lg" />
            <div>
              <p className="text-[13px] font-medium text-slate-900">{units} required</p>
              <p className="text-[12px] text-slate-500">{urgency}</p>
            </div>
          </div>

          <div className="mt-4">
            <DetailList>
              <Detail label="Location">Sector {sector}</Detail>
              <Detail label="Facility">{facility || 'Not set'}</Detail>
              <Detail label="Accepts">{acceptedGroups.join(', ')}</Detail>
              <Detail label="Will notify">
                <span className="tabular-nums font-medium">
                  {Math.min(donorsToNotify(units, urgency), contactablePool)} donors
                </span>
              </Detail>
              <Detail label="Contactable donors">
                <span className="tabular-nums font-medium">{pluralDonors(contactablePool)}</span>
              </Detail>
            </DetailList>
          </div>

          <Button type="submit" variant="primary" block className="mt-5">
            Find matching donors
          </Button>

          <p className="mt-3 text-[11.5px] leading-[1.6] text-slate-500">
            Patients are recorded by case reference only. BloodGrid stores no patient records.
          </p>
        </aside>
      </form>
    </Page>
  );
}
