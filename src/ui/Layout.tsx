import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../state/AppContext';

export function Layout() {
  const { repo, offlineReason } = useApp();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/new" className="brand">
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c4 6 9 10 9 16a9 9 0 0 1-18 0c0-6 5-10 9-16z" /></svg>
            BloodGrid <small>Donor matching</small>
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/new">New request</NavLink>
            <NavLink to="/requests">Requests</NavLink>
            <NavLink to="/method">Method</NavLink>
          </nav>
          <div className="spacer" />
          <div className="source" title={offlineReason ?? undefined}>
            <i className={`dot${repo.source === 'local' ? ' off' : ''}`} />
            <span>{repo.source === 'supabase' ? 'Supabase · synthetic data' : 'Offline · synthetic data'}</span>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
