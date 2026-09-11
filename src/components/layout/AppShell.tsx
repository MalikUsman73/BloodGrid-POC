/**
 * The application shell.
 *
 * One shell, one navigation structure. The workspace switcher in the header
 * moves between the individual and blood-bank experiences without leaving the
 * application, which is the point: BloodGrid is one system, not two.
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { Role } from '../../types';
import { useApp } from '../../store/AppStore';
import { OWN_BANK } from '../../mock/banks';

export function BloodGridLogo({ subdued = false }: { subdued?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`w-[18px] h-[18px] rounded-[3px] ${subdued ? 'bg-slate-400' : 'bg-crimson-700'}`}
        aria-hidden="true"
      />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        BloodGrid
      </span>
    </span>
  );
}

interface NavItem { to: string; label: string; end?: boolean }

const WORKSPACES: Record<Role, { label: string; context: string; nav: NavItem[] }> = {
  seeker: {
    label: 'Seeker',
    context: 'Individual account, Sector G-8',
    nav: [
      { to: '/seeker', label: 'Overview', end: true },
      { to: '/seeker/request/new', label: 'New request' },
      { to: '/seeker/requests', label: 'My requests' },
    ],
  },
  donor: {
    label: 'Donor',
    context: 'Registered donor, Sector G-9',
    nav: [
      { to: '/donor', label: 'Overview', end: true },
      { to: '/donor/requests', label: 'Requests' },
    ],
  },
  bank: {
    label: 'Blood bank',
    context: OWN_BANK.name,
    nav: [
      { to: '/bank', label: 'Overview', end: true },
      { to: '/bank/demand', label: 'Demand and forecast' },
      { to: '/bank/planning', label: 'Planning' },
      { to: '/bank/outreach', label: 'Donor outreach' },
      { to: '/bank/coordination', label: 'Inter-bank coordination' },
    ],
  },
};

const WORKSPACE_ORDER: Role[] = ['seeker', 'donor', 'bank'];
const WORKSPACE_HOME: Record<Role, string> = {
  seeker: '/seeker', donor: '/donor', bank: '/bank',
};

function WorkspaceSwitcher() {
  const { role, selectRole } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex items-center rounded-md border border-slate-300 overflow-hidden">
      {WORKSPACE_ORDER.map((option, index) => {
        const active = option === role;
        return (
          <button
            key={option}
            onClick={() => { selectRole(option); navigate(WORKSPACE_HOME[option]); }}
            aria-pressed={active}
            className={`px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              index > 0 ? 'border-l border-slate-300' : ''
            } ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {WORKSPACES[option].label}
          </button>
        );
      })}
    </div>
  );
}

export default function AppShell() {
  const { role } = useApp();
  const workspace = WORKSPACES[role];

  return (
    <div className="min-h-screen flex flex-col">
      <p className="bg-slate-900 px-5 py-1.5 text-center text-[12px] text-slate-300">
        Proposal-stage prototype. All data and all computational output shown here are simulated.
      </p>

      <header className="border-b border-slate-200 sticky top-0 z-20 bg-white">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-7 h-[56px] flex items-center justify-between gap-4">
          <NavLink to="/" aria-label="BloodGrid home"><BloodGridLogo /></NavLink>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-[13px] text-slate-500">{workspace.context}</span>
            <WorkspaceSwitcher />
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-7 flex gap-1 overflow-x-auto">
          {workspace.nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `py-3 px-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-crimson-700 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t border-slate-200 mt-10 bg-white">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-7 py-4">
          <p className="text-[12px] text-slate-500">
            BloodGrid proposal-stage proof of concept. Simulated demonstration data throughout.
            Multi-objective optimisation and the demand forecasting model are implementation-phase work.
          </p>
        </div>
      </footer>
    </div>
  );
}
