/**
 * Demo role selection.
 *
 * There is no authentication in this prototype and none is required for the
 * proposal defense. Roles are selected directly; the same BloodGrid application
 * is entered in every case.
 */

import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, HeartHandshake, Users,
} from 'lucide-react';
import type { Role } from '../types';
import { useApp } from '../store/AppStore';
import { BloodGridMark, BloodGridWordmark } from '../components/layout/AppShell';
import { Badge, Button } from '../components/ui';
import { OWN_BANK } from '../mock/banks';

const ROLES: {
  role: Role; title: string; persona: string; icon: React.ElementType;
  blurb: string; ccp: string; primary?: boolean; tier2?: boolean;
}[] = [
  {
    role: 'seeker', title: 'Blood Seeker', persona: 'Attendant · Islamabad G-8',
    icon: Users, primary: true,
    blurb: 'Raise a blood request for a patient and review ranked donor recommendations on a map.',
    ccp: 'Demonstrates CCP 1 — Donor Matching Optimization',
  },
  {
    role: 'bank', title: 'Blood Bank Administrator', persona: OWN_BANK.name,
    icon: Building2, primary: true,
    blurb: 'Review inventory, historical demand, the prototype forecast, and resulting planning actions.',
    ccp: 'Demonstrates CCP 2 — Demand Predictive Analysis',
  },
  {
    role: 'donor', title: 'Donor', persona: 'Registered donor · Islamabad G-9',
    icon: HeartHandshake, tier2: true,
    blurb: 'Manage availability and respond to incoming requests, closing the coordination loop.',
    ccp: 'Supporting workflow — no separate computational component',
  },
];

export default function RoleSelect() {
  const { setRole } = useApp();
  const navigate = useNavigate();

  const enter = (role: Role) => {
    setRole(role);
    navigate(role === 'seeker' ? '/seeker' : role === 'bank' ? '/bank' : '/donor');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-amber-100 border-b border-amber-200 px-4 py-2">
        <p className="text-center text-[11px] sm:text-xs font-medium text-amber-900">
          Proposal-stage prototype — simulated demonstration data and simulated computational output.
        </p>
      </div>

      <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BloodGridMark />
            <BloodGridWordmark />
          </div>
          <Button to="/" variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Choose a demonstration role
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              All three roles are views of the same BloodGrid application. You can switch between
              them at any time from the top bar — no sign-out required.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              No authentication is implemented in this prototype. Production authentication is
              scheduled for the implementation phase.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.role}
                  onClick={() => enter(r.role)}
                  className="group text-left bg-white border border-slate-200 rounded-xl shadow-card p-5 hover:shadow-lift hover:border-crimson-300 transition-all focus-visible:border-crimson-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-10 h-10 grid place-items-center rounded-lg bg-crimson-50 border border-crimson-100">
                      <Icon className="w-5 h-5 text-crimson-600" />
                    </span>
                    {r.tier2
                      ? <Badge tone="slate">Supporting</Badge>
                      : <Badge tone="red" dot>Core demo</Badge>}
                  </div>

                  <h2 className="mt-4 text-base font-semibold text-slate-900">{r.title}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">{r.persona}</p>
                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">{r.blurb}</p>

                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-medium text-slate-500 leading-relaxed">
                    {r.ccp}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-crimson-700 group-hover:gap-2.5 transition-all">
                    Enter as {r.title} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
