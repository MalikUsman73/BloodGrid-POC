import { useNavigate } from 'react-router-dom';
import { DEFAULT_CONFIG } from '../../engine';
import { eligibleOn } from '../../data/dates';
import { useSession } from '../../state/Session';
import { Button, GroupChip, PageHeader } from '../../ui/kit';
import { IconLogout } from '../../ui/icons';
import { ErrorState, Loading } from '../../ui/States';
import { useDonorData } from './useDonorData';

export function Profile() {
  const { profile: account, signOut } = useSession();
  const navigate = useNavigate();
  const { profile, error, reload } = useDonorData(60_000);

  return (
    <>
      <PageHeader title="Profile" subtitle="What BloodGrid knows about you. Nothing here is shown to recipients." />
      <div className="stack" style={{ maxWidth: 720 }}>
        <section className="card">
          <div className="card-head"><h2>Account</h2></div>
          <div className="card-body">
            <dl className="kv">
              <dt>Name</dt><dd>{account?.fullName}</dd>
              <dt>Email</dt><dd>{account?.email}</dd>
              <dt>Account type</dt><dd>Donor</dd>
            </dl>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Donor details</h2></div>
          {error ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : !profile ? (
            <Loading rows={4} />
          ) : (
            <div className="card-body">
              <dl className="kv">
                <dt>Donor code</dt><dd className="mono">{profile.code}</dd>
                <dt>Blood group</dt><dd><GroupChip group={profile.group} /></dd>
                <dt>Sector</dt><dd>{profile.sector}</dd>
                <dt>Last donation</dt><dd>{profile.lastDonationDate} ({profile.daysSinceDonation} days ago)</dd>
                <dt>Eligible again</dt><dd>{profile.daysSinceDonation >= DEFAULT_CONFIG.cooldownDays ? 'Now' : eligibleOn(profile.lastDonationDate, DEFAULT_CONFIG.cooldownDays)}</dd>
                <dt>Requests answered yes</dt><dd className="num">{profile.accepted}</dd>
              </dl>
              <p className="hint" style={{ marginTop: 16 }}>To change your group or sector, contact the BloodGrid team. These are checked against health records in a full deployment.</p>
            </div>
          )}
        </section>
        <div>
          <Button onClick={() => void signOut().then(() => navigate('/', { replace: true }))}><IconLogout />Sign out</Button>
        </div>
      </div>
    </>
  );
}
