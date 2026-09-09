/**
 * The single BloodGrid application shell.
 *
 * One shell, one visual identity, one navigation structure. The role switcher
 * in the top bar swaps the working context between the individual experience
 * and the blood-bank experience without a reload or a second application.
 */

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bell, Building2, ClipboardList, Droplet, HeartHandshake,
  LayoutDashboard, LineChart, Radio, Search, Send, Users,
} from 'lucide-react';
import type { Role } from '../../types';
import { useApp } from '../../store/AppStore';
import { OWN_BANK } from '../../mock/banks';

/* ------------------------------------------------------------- Branding */

export function BloodGridMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const icon = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <span className={`${box} shrink-0 grid place-items-center rounded-lg bg-crimson-600 shadow-sm`}>
      <Droplet className={`${icon} text-white`} fill="currentColor" />
    </span>
  );
}

export function BloodGridWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const t = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span className={`${t} font-semibold tracking-tight text-slate-900`}>
      Blood<span className="text-crimson-600">Grid</span>
    </span>
  );
}

/* ---------------------------------------------------------- Role config */

interface NavItem { to: string; label: string; icon: React.ElementType; end?: boolean }

const ROLE_CONFIG: Record<Role, {
  label: string; context: string; contextIcon: React.ElementType; nav: NavItem[];
}> = {
  seeker: {
    label: 'Blood Seeker',
    context: 'Individual · Islamabad G-8',
    contextIcon: Users,
    nav: [
      { to: '/seeker', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/seeker/request/new', label: 'New Blood Request', icon: Droplet },
      { to: '/seeker/requests', label: 'My Requests', icon: ClipboardList },
    ],
  },
  donor: {
    label: 'Donor',
    context: 'Individual · Islamabad G-9',
    contextIcon: HeartHandshake,
    nav: [
      { to: '/donor', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/donor/requests', label: 'Incoming Requests', icon: Bell },
    ],
  },
  bank: {
    label: 'Blood Bank',
    context: OWN_BANK.name,
    contextIcon: Building2,
    nav: [
      { to: '/bank', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/bank/demand', label: 'Demand & Forecast', icon: LineChart },
      { to: '/bank/planning', label: 'Planning', icon: AlertTriangle },
      { to: '/bank/outreach', label: 'Donor Outreach', icon: Radio },
      { to: '/bank/coordination', label: 'Inter-Bank Coordination', icon: Send },
    ],
  },
};

const ROLE_ORDER: Role[] = ['seeker', 'donor', 'bank'];
const ROLE_HOME: Record<Role, string> = { seeker: '/seeker', donor: '/donor', bank: '/bank' };

/* ----------------------------------------------------- Prototype banner */

function PrototypeBanner() {
  return (
    <div className="bg-amber-100/90 border-b border-amber-200">
      <div className="px-4 sm:px-6 py-1.5 flex items-center justify-center gap-2 text-center">
        <Activity className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <p className="text-[11px] sm:text-xs font-medium text-amber-900 leading-4">
          Proposal-stage prototype — all data is simulated demonstration data and all
          computational output is simulated. No real donor, patient, or blood-bank data is used.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Role switch */

function RoleSwitcher() {
  const { role, setRole } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
      {ROLE_ORDER.map((r) => {
        const active = r === role;
        const Icon = ROLE_CONFIG[r].contextIcon;
        return (
          <button
            key={r}
            onClick={() => { setRole(r); navigate(ROLE_HOME[r]); }}
            aria-pressed={active}
            title={`Switch to the ${ROLE_CONFIG[r].label} experience`}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
              active ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                     : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ROLE_CONFIG[r].label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Shell */

export default function AppShell() {
  const { role } = useApp();
  const cfg = ROLE_CONFIG[role];
  const ContextIcon = cfg.contextIcon;
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <PrototypeBanner />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" title="BloodGrid home">
            <BloodGridMark />
            <span className="hidden sm:block">
              <BloodGridWordmark />
              <span className="block text-[10px] text-slate-400 leading-3 -mt-0.5">
                Blood Coordination Platform
              </span>
            </span>
          </NavLink>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 pr-3 border-r border-slate-200">
              <ContextIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="max-w-[220px] truncate">{cfg.context}</span>
            </div>
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="px-4 pt-5 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {cfg.label} Workspace
            </p>
          </div>
          <nav className="px-3 pb-4 space-y-0.5">
            {cfg.nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-crimson-50 text-crimson-700'
                               : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto p-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                One Platform
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Individual coordination and blood-bank planning run on the same BloodGrid
                system. Use the switcher above to move between them.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex">
          {cfg.nav.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to} to={item.to} end={item.end}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  active ? 'text-crimson-700' : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-full px-1">{item.label.split(' ')[0]}</span>
              </NavLink>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Page heading */

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: string; subtitle?: React.ReactNode;
  actions?: React.ReactNode; breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="px-4 sm:px-6 lg:px-8 py-5">
        {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function PageBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 sm:px-6 lg:px-8 py-6 ${className}`}>{children}</div>;
}
