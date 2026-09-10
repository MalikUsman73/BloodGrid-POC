/**
 * Workspace selection.
 *
 * There is no authentication in this prototype and none is needed for the
 * proposal defense. All three workspaces are views of the same application and
 * can be switched at any time from the header.
 */

import { useNavigate } from 'react-router-dom';
import type { Role } from '../types';
import { useApp } from '../store/AppStore';
import { BloodGridLogo } from '../components/layout/AppShell';
import { Button } from '../components/ui';
import { OWN_BANK } from '../mock/banks';

const WORKSPACE_OPTIONS: {
  role: Role; title: string; who: string; purpose: string; note: string;
}[] = [
  {
    role: 'seeker',
    title: 'Blood seeker',
    who: 'Attendant, Sector G-8',
    purpose: 'Raise a blood request and review the donors BloodGrid suggests.',
    note: 'Demonstrates CCP 1, donor matching optimisation',
  },
  {
    role: 'bank',
    title: 'Blood bank administrator',
    who: OWN_BANK.name,
    purpose: 'Review stock, demand and forecast, and decide what action to take.',
    note: 'Demonstrates CCP 2, blood demand predictive analysis',
  },
  {
    role: 'donor',
    title: 'Donor',
    who: 'Registered donor, Sector G-9',
    purpose: 'Manage availability and respond to requests sent through BloodGrid.',
    note: 'Supporting workflow, not a separate computational component',
  },
];

const WORKSPACE_HOME: Record<Role, string> = {
  seeker: '/seeker', bank: '/bank', donor: '/donor',
};

export default function RoleSelect() {
  const { selectRole } = useApp();
  const navigate = useNavigate();

  function enterWorkspace(role: Role) {
    selectRole(role);
    navigate(WORKSPACE_HOME[role]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <p className="bg-slate-100 border-b border-slate-200 px-5 py-1.5 text-center text-[11.5px] text-slate-600">
        Proposal-stage prototype. All data and all computational output shown here are simulated.
      </p>

      <header className="border-b border-slate-200">
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 h-[52px] flex items-center justify-between">
          <BloodGridLogo />
          <Button size="sm" to="/">Back</Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-14">
          <h1 className="text-[20px] font-semibold tracking-[-0.011em] text-slate-900">
            Choose a workspace
          </h1>
          <p className="mt-2 text-[13px] leading-[1.6] text-slate-600 max-w-[62ch]">
            All three are views of the same BloodGrid application. You can switch between them at
            any time from the header, without signing out. No authentication is implemented at the
            proposal stage.
          </p>

          <ul className="mt-8 border border-slate-200 rounded-lg shadow-surface divide-y divide-slate-200">
            {WORKSPACE_OPTIONS.map((option) => (
              <li key={option.role}>
                <button
                  type="button"
                  onClick={() => enterWorkspace(option.role)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-medium text-slate-900">{option.title}</span>
                    <span className="text-[12px] text-slate-500">{option.who}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-[1.6] text-slate-600 max-w-[64ch]">
                    {option.purpose}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-slate-500">{option.note}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
