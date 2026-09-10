/**
 * Planning.
 *
 * This screen is for deciding what to do. It carries one line of context per
 * blood group and then the recommendation, the reason, and the actions. The
 * chart and the full statistics stay on the demand screen, where they belong.
 *
 * Scope note: the coordination action below is an ordinary application
 * workflow. It performs no optimisation, no redistribution planning, and no
 * routing. It is not a third computational component.
 */

import { Link } from 'react-router-dom';
import { Button, EmptyState, Page, PageTitle, Section, Status } from '../../components/ui';
import { Footnote, SimulatedMark } from '../../components/PrototypeLabels';
import { buildPlanningItems } from '../../engines/forecast';
import { COMPATIBLE_DONOR_GROUPS } from '../../engines/matching';
import { donors } from '../../mock/donors';
import { pluralDonors } from '../../lib/format';

export default function Planning() {
  const items = buildPlanningItems();

  return (
    <Page>
      <PageTitle
        title="Planning"
        description="What the current demand signals suggest doing. Every action needs your confirmation."
        actions={<Button to="/bank/demand">View the underlying demand</Button>}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          message="No blood group currently exceeds the elevated-demand or shortage-risk thresholds."
        />
      ) : (
        <div className="space-y-8">
          {items.map((item) => {
            const eligibleDonors = donors.filter(
              (donor) =>
                COMPATIBLE_DONOR_GROUPS[item.bloodGroup].includes(donor.bloodGroup) && donor.eligible,
            ).length;

            return (
              <Section key={item.id}>
                <div className="border-l-2 pl-4"
                     style={{ borderColor: item.priority === 'high' ? '#dc2626' : '#f59e0b' }}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-[15px] font-semibold text-slate-900 tabular-nums">
                      {item.bloodGroup}
                    </h2>
                    <Status tone={item.priority === 'high' ? 'urgent' : 'attention'}>
                      {item.priority === 'high' ? 'High priority' : 'Medium priority'}
                    </Status>
                    <SimulatedMark />
                  </div>

                  <p className="mt-2 text-[13px] leading-[1.6] text-slate-700 max-w-[74ch]">
                    {item.context}
                  </p>

                  <dl className="mt-4 space-y-2.5 max-w-[74ch]">
                    <div className="flex gap-3">
                      <dt className="w-[128px] shrink-0 text-[12.5px] text-slate-500">Recommended</dt>
                      <dd className="text-[13px] font-medium text-slate-900">{item.recommendedAction}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-[128px] shrink-0 text-[12.5px] text-slate-500">Reason</dt>
                      <dd className="text-[12.5px] leading-[1.6] text-slate-700">{item.reason}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-[128px] shrink-0 text-[12.5px] text-slate-500">Donors reachable</dt>
                      <dd className="text-[12.5px] text-slate-700">
                        {pluralDonors(eligibleDonors)} compatible and eligible in the simulated pool
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Button
                      variant={item.priority === 'high' ? 'primary' : 'secondary'}
                      to={`/bank/outreach?group=${encodeURIComponent(item.bloodGroup)}`}
                    >
                      Start outreach
                    </Button>
                    <Button to={`/bank/outreach?group=${encodeURIComponent(item.bloodGroup)}&available=1`}>
                      Contact available donors
                    </Button>
                    <Button
                      to={`/bank/coordination?group=${encodeURIComponent(item.bloodGroup)}&units=${item.priority === 'high' ? 40 : 20}`}
                    >
                      Request inter-bank coordination
                    </Button>
                  </div>
                </div>
              </Section>
            );
          })}
        </div>
      )}

      <Section title="How these recommendations are produced">
        <div className="space-y-2.5 max-w-[74ch]">
          <Footnote>
            A group is flagged when its projected peak exceeds 118 percent of the 30-day average,
            or when projected demand exceeds held stock plus expected routine collection. These are
            simple threshold rules over the prototype forecast. No trained model, optimisation
            algorithm, or autonomous decision process is involved.{' '}
            <Link to="/bank/demand" className="text-crimson-800 hover:underline">
              See the demand and forecast screen
            </Link>{' '}
            for the full analysis.
          </Footnote>
          <Footnote>
            Inter-bank coordination is an ordinary application workflow in BloodGrid. It is not a
            computational component of this project and performs no redistribution or
            transportation optimisation.
          </Footnote>
        </div>
      </Section>
    </Page>
  );
}
