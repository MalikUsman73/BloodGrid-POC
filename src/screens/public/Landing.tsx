import { Link, Navigate } from 'react-router-dom';
import { homeFor } from '../../auth/roles';
import { SECTORS } from '../../data';
import { useSession } from '../../state/Session';
import { Brand } from '../../ui/AppShell';
import { IconBuilding, IconHeart, IconShield, IconUsers, IconActivity, IconPin } from '../../ui/icons';

/** A quiet schematic of the pilot area: sectors as nodes, one request, a few selected donors. */
function HeroArt() {
  const lats = SECTORS.map((s) => s.lat);
  const lngs = SECTORS.map((s) => s.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const W = 480, H = 330, P = 34;
  const x = (lng: number) => P + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * P);
  const y = (lat: number) => P + (1 - (lat - minLat) / (maxLat - minLat)) * (H - 2 * P);
  const req = SECTORS.find((s) => s.id === 'G-8')!;
  const picked = ['G-9', 'H-8', 'F-8', 'G-7'].map((id) => SECTORS.find((s) => s.id === id)!);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schematic map of Islamabad sectors with a request and selected donors">
      <circle cx={x(req.lng)} cy={y(req.lat)} r="96" fill="none" stroke="var(--border-strong)" strokeDasharray="4 4" />
      {picked.map((s) => (
        <line key={s.id} x1={x(req.lng)} y1={y(req.lat)} x2={x(s.lng)} y2={y(s.lat)} stroke="var(--brand)" strokeOpacity="0.35" strokeWidth="1.5" />
      ))}
      {SECTORS.map((s) => (
        <g key={s.id}>
          <circle cx={x(s.lng)} cy={y(s.lat)} r="3.5" fill="var(--border-strong)" />
          <text x={x(s.lng) + 7} y={y(s.lat) - 6} fontSize="10" fill="var(--text-3)" fontFamily="var(--font)">{s.id}</text>
        </g>
      ))}
      {picked.map((s) => <circle key={s.id} cx={x(s.lng)} cy={y(s.lat)} r="8" fill="var(--brand)" />)}
      <circle cx={x(req.lng)} cy={y(req.lat)} r="13" fill="none" stroke="var(--text)" strokeWidth="2" />
      <circle cx={x(req.lng)} cy={y(req.lat)} r="4" fill="var(--text)" />
    </svg>
  );
}

export function Landing() {
  const { profile, loading } = useSession();
  if (!loading && profile) return <Navigate to={homeFor(profile.role)} replace />;

  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Brand />
          <nav className="site-links" aria-label="Sections">
            <a href="#roles">Who it is for</a>
            <a href="#how">How it works</a>
            <a href="#trust">Privacy</a>
          </nav>
          <div className="site-actions">
            <Link className="btn ghost" to="/login">Sign in</Link>
            <Link className="btn primary" to="/signup">Create account</Link>
          </div>
        </div>
      </header>

      <main>
        <div className="wrap hero">
          <div>
            <span className="eyebrow">Donor matching · Islamabad pilot</span>
            <h1>When blood is needed, reach the right donors first.</h1>
            <p className="lead">
              BloodGrid screens every donor for compatibility, availability and distance, then notifies the smallest set most likely to
              respond. Nobody scrolls a list, and no donor is exposed.
            </p>
            <div className="cta">
              <Link className="btn primary lg" to="/signup?role=recipient">I need blood</Link>
              <Link className="btn lg" to="/signup?role=donor">I want to donate</Link>
            </div>
          </div>
          <figure className="hero-art">
            <HeroArt />
            <figcaption className="cap"><span>Request in G-8, four donors selected</span><span>Synthetic data</span></figcaption>
          </figure>
        </div>

        <section className="section alt" id="roles">
          <div className="wrap">
            <h2>One platform, three kinds of account</h2>
            <p className="sub">Each account sees only what it needs. Sign up as the role that fits you.</p>
            <div className="role-cards">
              <article className="card role-card">
                <span className="ico"><IconHeart /></span>
                <h3>Donors</h3>
                <p>Set your blood group and sector once. Get asked only when your group is needed nearby, and answer in one tap.</p>
                <div className="links">
                  <Link className="btn primary sm" to="/signup?role=donor">Become a donor</Link>
                  <Link className="btn sm" to="/login?role=donor">Sign in</Link>
                </div>
              </article>
              <article className="card role-card">
                <span className="ico"><IconActivity /></span>
                <h3>Recipients and families</h3>
                <p>Raise a request with the blood group, units and urgency. BloodGrid finds and contacts donors, and shows you progress.</p>
                <div className="links">
                  <Link className="btn primary sm" to="/signup?role=recipient">Raise requests</Link>
                  <Link className="btn sm" to="/login?role=recipient">Sign in</Link>
                </div>
              </article>
              <article className="card role-card soon">
                <span className="ico"><IconBuilding /></span>
                <h3>Blood banks <span className="badge plain" style={{ marginLeft: 6 }}>Coming soon</span></h3>
                <p>Stock, demand forecasts and requests between banks. This is the next module and is not open yet.</p>
                <div className="links"><Link className="btn sm" to="/bank">Learn more</Link></div>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <h2>How a request is handled</h2>
            <p className="sub">Three steps, all automatic, all explained on screen.</p>
            <div className="steps">
              <div className="step"><h3>Screen</h3><p>Donors are removed, not scored down, if they are the wrong group, unavailable, gave blood within 90 days, or live too far away.</p></div>
              <div className="step"><h3>Select</h3><p>Four objectives are weighed across the whole set: travel, donor recovery, chance of fulfilment, and conserving rare blood.</p></div>
              <div className="step"><h3>Confirm</h3><p>Selected donors are asked. When enough accept, the rest are released so they are not held up for nothing.</p></div>
            </div>
          </div>
        </section>

        <section className="section alt" id="trust">
          <div className="wrap">
            <div className="facts-row">
              <div><IconShield width={22} height={22} style={{ marginBottom: 10, color: 'var(--brand-text)' }} /><h3>Anonymous by design</h3><p>Recipients see a donor code, group and sector. Never a name, phone number or address.</p></div>
              <div><IconPin width={22} height={22} style={{ marginBottom: 10, color: 'var(--brand-text)' }} /><h3>Sector-level location</h3><p>Distance is estimated between sector centres, so exact positions are never collected.</p></div>
              <div><IconUsers width={22} height={22} style={{ marginBottom: 10, color: 'var(--brand-text)' }} /><h3>Fair to donors</h3><p>A cap on how often one person is contacted, and a rest period between donations, protect donors.</p></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>BloodGrid · final-year project, pilot with synthetic data. Not for real emergencies.</span>
          <span><Link to="/bank">Blood banks</Link></span>
        </div>
      </footer>
    </div>
  );
}
