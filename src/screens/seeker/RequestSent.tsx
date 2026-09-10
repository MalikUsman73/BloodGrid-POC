/**
 * Confirmation that a request reached a donor, and what happens next.
 *
 * Nothing leaves the application: the request is recorded in session state so
 * the workflow can be followed end to end during the demonstration.
 */

import { Navigate, useParams } from 'react-router-dom';
import { Button, Notice, Page, PageTitle, Section } from '../../components/ui';
import { Footnote } from '../../components/PrototypeLabels';
import { useApp } from '../../store/AppStore';
import { findDonor } from '../../mock/donors';

export default function RequestSent() {
  const { id, donorId } = useParams();
  const { findRequest, findDonorRequest } = useApp();
  const request = findRequest(id!);
  const donor = findDonor(donorId!);

  if (!request || !donor) return <Navigate to="/seeker" replace />;

  const sent = findDonorRequest(request.id, donor.id);
  const accepted = sent?.state === 'Accepted';
  const firstName = donor.name.split(' ')[0];

  const steps = [
    { label: `Request sent to ${donor.name}`, done: true, note: sent?.sentLabel ?? request.createdLabel },
    { label: 'Donor reviews the request', done: accepted, note: accepted ? 'Accepted' : 'Waiting for a response' },
    { label: 'Conversation opens in BloodGrid', done: accepted, note: accepted ? 'Available now' : 'Available once the donor accepts' },
    { label: 'Donation arranged and confirmed', done: false, note: 'Implementation-phase work' },
  ];

  return (
    <Page>
      <PageTitle
        title="Request sent"
        description={`BloodGrid has sent your request for ${request.patientRef} to ${donor.name}.`}
        back={{ to: `/seeker/request/${request.id}/matches`, label: 'Back to suitable donors' }}
      />

      <div className="max-w-[560px]">
        <Notice tone={accepted ? 'good' : 'info'} title={accepted ? 'Request accepted' : 'Waiting for a response'}>
          {accepted
            ? `${firstName} has accepted. You can arrange the donation in the conversation.`
            : `${firstName} will see this request in their BloodGrid donor workspace. You can contact other donors from the ranked list at any time.`}
        </Notice>

        <Section title="What happens next">
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.label} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      step.done ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  {index < steps.length - 1 && <span className="w-px flex-1 min-h-[26px] bg-slate-200 mt-1.5" />}
                </div>
                <div className="pb-1">
                  <p className={`text-[13px] ${step.done ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {accepted ? (
            <Button variant="primary" to={`/seeker/request/${request.id}/conversation/${donor.id}`}>
              Open conversation
            </Button>
          ) : (
            <Button variant="primary" to={`/seeker/request/${request.id}/matches`}>
              Back to suitable donors
            </Button>
          )}
          <Button to="/seeker/requests">View my requests</Button>
        </div>

        <div className="mt-6">
          <Footnote>
            This prototype sends no message, email, or notification outside the application.
            Donor contact details are never shown to the seeker.
          </Footnote>
        </div>
      </div>
    </Page>
  );
}
