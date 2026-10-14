import { useState } from 'react';
import { Link } from 'react-router-dom';
import { eligibleOn } from '../../data/dates';
import { sectorDistanceKm } from '../../data/sectors';
import { DEFAULT_CONFIG } from '../../engine';
import type { DonorOffer } from '../../data';
import { formatDate, plural } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { useSession } from '../../state/Session';
import { Alert, Badge, Button, GroupChip, PageHeader, Switch, type Tone } from '../../ui/kit';
import { IconClock, IconPin, IconRefresh } from '../../ui/icons';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { useDonorData } from './useDonorData';

const urgencyTone = (u: string): Tone => (u === 'Critical' ? 'bad' : u === 'Urgent' ? 'warn' : 'neutral');

export function Home() {
  const { repo } = useApp();
  const { profile: account } = useSession();
  const toast = useToast();
  const { profile, offers, error, reload, setProfile } = useDonorData();
  const [pending, setPending] = useState<string | null>(null);

  async function answer(offer: DonorOffer, state: 'Accepted' | 'Declined') {
    setPending(offer.id);
    try {
      await repo.respond(offer.id, state);
      toast.success(state === 'Accepted' ? 'Thank you. The recipient will be told you can help.' : 'No problem. You will not be asked about this request again.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send your answer.');
      await reload();
    } finally {
      setPending(null);
    }
  }

  async function toggle(next: boolean) {
    if (!profile) return;
    setProfile({ ...profile, available: next });
    try {
      await repo.setAvailability(next);
      toast.success(next ? 'You are available. You can be matched to new requests.' : 'You are paused. You will not be matched to new requests.');
    } catch (e) {
      setProfile({ ...profile, available: !next });
      toast.error(e instanceof Error ? e.message : 'Could not update your availability.');
    }
  }

  if (error && !profile) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (profile === undefined || offers === null) return <section className="card"><Loading rows={6} /></section>;
  if (profile === null) {
    return (
      <section className="card">
        <EmptyState title="No donor record">This account is not linked to a donor profile.</EmptyState>
      </section>
    );
  }

  const open = offers.filter((o) => o.state === 'Sent' && o.requestStatus === 'Awaiting response');
  const waiting = offers.filter((o) => o.state === 'Accepted' && o.requestStatus === 'Awaiting response');
  const eligible = profile.daysSinceDonation >= DEFAULT_CONFIG.cooldownDays;
  const progress = Math.min(1, profile.daysSinceDonation / DEFAULT_CONFIG.cooldownDays);
  const first = account?.fullName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`Hello, ${first}`}
        subtitle="Requests that need your blood group appear here. Answer in one tap."
        actions={<Button size="sm" onClick={() => void reload()}><IconRefresh />Refresh</Button>}
      />

      <div className="donor-grid">
        <section className="card" aria-labelledby="offers-h">
          <div className="card-head">
            <h2 id="offers-h">Requests for you</h2>
            {open.length > 0 && <span className="end"><Badge tone="brand">{open.length} waiting</Badge></span>}
          </div>
          {open.length === 0 ? (
            <EmptyState title="Nothing needs you right now">
              {profile.available
                ? `When a request matches ${profile.group} in your area you will see it here.`
                : 'You are paused, so you will not be matched to new requests. Turn availability on to receive them.'}
            </EmptyState>
          ) : (
            open.map((o) => (
              <article className="offer" key={o.id} aria-label={`Request ${o.requestCode}`}>
                <div className="offer-top">
                  <GroupChip group={o.group} />
                  <div className="t">
                    <b>{plural(o.units, 'unit')} of {o.group} needed</b>
                    <span>Request {o.requestCode} · {formatDate(o.offeredAt)}</span>
                  </div>
                  <Badge tone={urgencyTone(o.urgency)}>{o.urgency}</Badge>
                </div>
                <div className="mini-kv">
                  <div><span>Hospital sector</span><b>{o.sector}</b></div>
                  <div><span>From your sector</span><b className="num">{sectorDistanceKm(profile.sector, o.sector).toFixed(1)} km</b></div>
                  <div><span>Your group</span><b>{profile.group}</b></div>
                </div>
                <div className="offer-actions">
                  <Button variant="primary" onClick={() => void answer(o, 'Accepted')} loading={pending === o.id} disabled={pending !== null}>I can donate</Button>
                  <Button onClick={() => void answer(o, 'Declined')} disabled={pending !== null}>Not this time</Button>
                </div>
              </article>
            ))
          )}
          {waiting.length > 0 && (
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <Alert tone="ok" title={`You said yes to ${plural(waiting.length, 'request')}`}>
                {waiting.map((w) => w.requestCode).join(', ')}. The recipient will confirm once enough donors have accepted.
              </Alert>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card avail">
            <div className="t">
              <b>{profile.available ? 'Available to donate' : 'Paused'}</b>
              <span>{profile.available ? 'You can be matched to new requests.' : 'You will not be matched to new requests.'}</span>
            </div>
            <Switch checked={profile.available} onChange={(v) => void toggle(v)} label="Available to donate" />
          </section>

          <section className="card card-body" aria-labelledby="elig-h">
            <h2 id="elig-h" style={{ fontSize: 15, fontWeight: 650, marginBottom: 12 }}>Donation interval</h2>
            <div className={`progress${eligible ? '' : ' wait'}`} role="img" aria-label={`${Math.round(progress * 100)} percent of the ${DEFAULT_CONFIG.cooldownDays}-day rest period`}>
              <i style={{ width: `${progress * 100}%` }} />
            </div>
            <p style={{ marginTop: 10, color: 'var(--text-2)' }}>
              {eligible
                ? `You last gave ${profile.daysSinceDonation} days ago and are eligible now.`
                : `You last gave ${profile.daysSinceDonation} days ago. You are eligible again on ${eligibleOn(profile.lastDonationDate, DEFAULT_CONFIG.cooldownDays)}.`}
            </p>
          </section>

          <section className="card card-body">
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Donor code</dt><dd className="mono">{profile.code}</dd>
              <dt>Blood group</dt><dd><GroupChip group={profile.group} /></dd>
              <dt><IconPin style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px' }} /> Sector</dt><dd>{profile.sector}</dd>
              <dt><IconClock style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px' }} /> Answered</dt><dd className="num">{profile.accepted} yes</dd>
            </dl>
            <p className="hint" style={{ marginTop: 14 }}><Link to="/donor/history">See all requests you were asked about</Link></p>
          </section>
        </div>
      </div>
    </>
  );
}
