import { Link } from 'react-router-dom';
import { Brand } from '../../ui/AppShell';
import { IconBuilding } from '../../ui/icons';

/** Placeholder until the blood bank portal is built. */
export function BankSoon() {
  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Brand />
          <div className="site-actions">
            <Link className="btn ghost" to="/login">Sign in</Link>
            <Link className="btn primary" to="/signup">Create account</Link>
          </div>
        </div>
      </header>
      <main className="wrap" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '64px 24px' }}>
        <div className="state" style={{ maxWidth: 520 }}>
          <div className="art"><IconBuilding /></div>
          <h3 style={{ fontSize: 22 }}>The blood bank portal is coming</h3>
          <p>
            Stock levels, demand forecasts and requests between blood banks are the next module. Blood bank accounts open when it is ready.
            Donors and recipients can use BloodGrid today.
          </p>
          <Link className="btn primary" to="/">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
