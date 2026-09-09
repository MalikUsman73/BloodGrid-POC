/**
 * Landing screen — establishes the core framing before anything else:
 * ONE application, TWO user groups, TWO computational components.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Droplet, LineChart, Map, ShieldCheck, Users,
} from 'lucide-react';
import { BloodGridMark, BloodGridWordmark } from '../components/layout/AppShell';
import { Badge, Button } from '../components/ui';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Prototype disclosure sits above everything, before the panel sees a single feature */}
      <div className="bg-amber-100 border-b border-amber-200 px-4 py-2">
        <p className="text-center text-[11px] sm:text-xs font-medium text-amber-900 max-w-4xl mx-auto leading-relaxed">
          Proposal-stage prototype. All data shown is simulated demonstration data and all
          computational output is simulated. NSGA-II optimisation and the forecasting model are
          committed implementation components, not part of this prototype.
        </p>
      </div>

      <header className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BloodGridMark size="lg" />
            <div>
              <BloodGridWordmark size="lg" />
              <p className="text-[11px] text-slate-500 leading-3">Blood Coordination Platform</p>
            </div>
          </div>
          <Button to="/enter" size="md">
            Enter Demo <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">

          {/* Hero */}
          <div className="max-w-3xl">
            <Badge tone="red" dot className="mb-4">Final Year Project · Proposal Defense Prototype</Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-slate-900 leading-tight">
              One platform connecting <span className="text-crimson-600">urgent blood requests</span> with
              donors — and blood banks with what they will need next.
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              BloodGrid brings individual donor coordination and blood-bank demand planning into a
              single system, so that a request raised at the bedside and a shortage forming weeks
              away are handled by the same platform.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to="/enter" size="lg">
                Start the demonstration <ArrowRight className="w-4 h-4" />
              </Button>
              <Button to="/enter" size="lg" variant="secondary">Choose a role</Button>
            </div>
          </div>

          {/* Architecture diagram — the "one application" framing, made visual */}
          <section className="mt-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              System framing
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5 sm:p-8">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-crimson-600 text-white font-semibold text-sm shadow-sm">
                  <Droplet className="w-4 h-4" fill="currentColor" /> BLOODGRID
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">a single integrated application</p>

                <div className="w-px h-6 bg-slate-300 mt-2" />
                <div className="w-full max-w-3xl h-px bg-slate-300" />

                <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 pt-0">
                  <Branch
                    icon={Users}
                    group="Individual Users"
                    role="Blood seekers · Donors"
                    steps={['Blood request', 'Candidate donors', 'Ranked donors', 'Map & contact']}
                    ccpLabel="CCP 1 — Donor Matching Optimization"
                    ccpFuture="Future: NSGA-II multi-objective optimization"
                  />
                  <Branch
                    icon={Building2}
                    group="Blood Banks"
                    role="Blood-bank administrators"
                    steps={['Historical demand', 'Prototype forecast', 'Shortage signal', 'Planning action']}
                    ccpLabel="CCP 2 — Demand Predictive Analysis"
                    ccpFuture="Future: trained forecasting model"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Capability strip */}
          <section className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Feature
              icon={LineChart}
              title="Two computational components"
              body="Donor matching optimisation and blood demand predictive analysis — the two problems the project commits to solving."
            />
            <Feature
              icon={Map}
              title="Privacy-preserving geography"
              body="Donors are located to sector level only. Exact residential addresses are never stored or displayed."
            />
            <Feature
              icon={ShieldCheck}
              title="Honest prototype status"
              body="Every computational output in this build is labelled as simulated. No accuracy or evaluation results are claimed."
            />
          </section>
        </div>
      </main>

      <footer className="px-4 sm:px-6 lg:px-8 py-6 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            BloodGrid — proposal-stage proof of concept. Simulated demonstration data throughout.
          </p>
          <Link to="/enter" className="text-xs font-medium text-crimson-700 hover:text-crimson-800">
            Enter demonstration →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Branch({
  icon: Icon, group, role, steps, ccpLabel, ccpFuture,
}: {
  icon: React.ElementType; group: string; role: string;
  steps: string[]; ccpLabel: string; ccpFuture: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-6 bg-slate-300" />
      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">{group}</p>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{role}</p>
      </div>

      <div className="w-px h-4 bg-slate-300" />
      <div className="w-full rounded-lg border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-center">
        <p className="text-xs font-semibold text-crimson-800">{ccpLabel}</p>
        <p className="text-[10px] text-crimson-700/80 mt-0.5">{ccpFuture}</p>
      </div>

      <div className="w-px h-4 bg-slate-300" />
      <ul className="w-full space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={s}
            className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5"
          >
            <span className="w-4 h-4 shrink-0 grid place-items-center rounded bg-slate-100 text-[9px] font-bold text-slate-500">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
      <Icon className="w-5 h-5 text-crimson-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}
