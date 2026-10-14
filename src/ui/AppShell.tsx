import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useSession } from '../state/Session';
import { IconDrop, IconLogout } from './icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <NavLink to={to} className="brand" aria-label="BloodGrid home">
      <span className="mark"><IconDrop /></span>
      BloodGrid
    </NavLink>
  );
}

/** The signed-in frame: sidebar on desktop, top bar and bottom tabs on a phone. */
export function AppShell({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const { profile, signOut } = useSession();
  const { mode, offlineReason } = useApp();
  const navigate = useNavigate();

  async function leave() {
    await signOut();
    navigate('/', { replace: true });
  }

  const name = profile?.fullName ?? '';
  return (
    <div className="shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar">
        <Brand />
        <div className="sb-label">{roleLabel}</div>
        <nav className="sb-nav" aria-label="Main">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="sb-link">
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="sb-mode" title={offlineReason ?? undefined}>
            <i className={mode === 'local' ? 'off' : ''} />
            {mode === 'supabase' ? 'Connected to Supabase' : 'Demo mode · data stays in this browser'}
          </div>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{initials(name)}</span>
            <div className="who">
              <b>{name}</b>
              <span>{roleLabel}</span>
            </div>
          </div>
          <button className="sb-signout" onClick={() => void leave()}>
            <IconLogout />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="mobile-bar">
          <Brand />
          <button className="avatar" onClick={() => void leave()} aria-label={`Sign out ${name}`} title="Sign out">
            {initials(name)}
          </button>
        </header>
        <main className="content" id="content" tabIndex={-1}>
          <Outlet />
        </main>
        <nav className="bottom-nav" aria-label="Main">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
