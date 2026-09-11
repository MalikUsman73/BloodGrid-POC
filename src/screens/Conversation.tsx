/**
 * In-application conversation between a seeker and a donor.
 *
 * This is a prototype conversation: messages are held in session state and are
 * not delivered anywhere. There is no messaging backend, and the screen says so.
 * It exists to demonstrate the communication model, which is that contact
 * happens inside BloodGrid and only after a donor accepts a request.
 *
 * One component serves both sides; `viewer` decides whose messages sit right.
 */

import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BloodGroup as BloodGroupTag, Button, Notice, Page, PageTitle, inputStyles } from '../components/ui';
import { Footnote } from '../components/PrototypeLabels';
import { DEMO_DONOR_ID, useApp } from '../store/AppStore';

export default function Conversation({ viewer }: { viewer: 'seeker' | 'donor' }) {
  const params = useParams();
  const requestId = params.id!;
  const donorId = viewer === 'donor' ? DEMO_DONOR_ID : params.donorId!;

  const { findRequest, findDonorRequest, sendMessage, findDonor } = useApp();
  const [draft, setDraft] = useState('');

  const request = findRequest(requestId);
  const donor = findDonor(donorId);
  const thread = findDonorRequest(requestId, donorId);

  if (!request || !donor) {
    return <Navigate to={viewer === 'donor' ? '/donor/requests' : '/seeker'} replace />;
  }

  // Contact is only available after acceptance, so guard the route itself.
  if (!thread || thread.state !== 'Accepted') {
    return (
      <Page>
        <PageTitle
          title="Conversation not available yet"
          description="A conversation opens once the donor accepts the request."
          back={
            viewer === 'donor'
              ? { to: '/donor/requests', label: 'Back to requests' }
              : { to: `/seeker/request/${request.id}/matches`, label: 'Back to suitable donors' }
          }
        />
        <div className="max-w-[560px]">
          <Notice tone="info" title="Awaiting the donor's response">
            BloodGrid keeps donor contact details private. Messaging becomes available after the
            donor accepts.
          </Notice>
        </div>
      </Page>
    );
  }

  const otherParty = viewer === 'seeker' ? donor.name : 'the requesting attendant';

  function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendMessage(requestId, donorId, viewer, text);
    setDraft('');
  }

  return (
    <Page>
      <PageTitle
        title={viewer === 'seeker' ? donor.name : request.patientRef}
        description={
          viewer === 'seeker'
            ? `Arranging ${request.units} ${request.units === 1 ? 'unit' : 'units'} of ${request.bloodGroup} for ${request.patientRef}.`
            : `You accepted this request on ${thread.sentLabel}.`
        }
        back={
          viewer === 'donor'
            ? { to: '/donor/requests', label: 'Back to requests' }
            : { to: `/seeker/request/${request.id}/matches`, label: 'Back to suitable donors' }
        }
        actions={<BloodGroupTag group={request.bloodGroup} />}
      />

      <div className="max-w-[620px]">
        <div className="border border-slate-200 rounded-lg shadow-surface">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-slate-600">
              {request.facility}, Sector {request.sector}
            </p>
            <span className="text-[11px] text-slate-500">Prototype conversation</span>
          </div>

          <ul className="p-4 space-y-3 min-h-[220px]">
            {thread.messages.map((message) => {
              const mine = message.from === viewer;
              return (
                <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                  <div className="max-w-[80%]">
                    <div
                      className={`rounded-md px-3 py-2 text-[13px] leading-[1.55] ${
                        mine ? 'bg-crimson-700 text-white' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {message.text}
                    </div>
                    <p className={`mt-1 text-[11px] text-slate-500 ${mine ? 'text-right' : ''}`}>
                      {mine ? 'You' : otherParty}, {message.timeLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={submitMessage} className="border-t border-slate-200 p-3 flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={inputStyles}
              placeholder="Write a message"
              aria-label="Message"
            />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>Send</Button>
          </form>
        </div>

        <div className="mt-4">
          <Footnote>
            Messages are held in this browser session only. BloodGrid has no messaging backend at
            the proposal stage; real in-application messaging is implementation-phase work.
          </Footnote>
        </div>
      </div>
    </Page>
  );
}
