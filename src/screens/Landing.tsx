/**
 * Landing page.
 *
 * It has one job: make the framing clear before anything else is shown. One
 * application, two user groups, two computational components.
 */

import { Link } from 'react-router-dom';
import { BloodGridLogo } from '../components/layout/AppShell';
import { Button } from '../components/ui';

const BRANCHES = [
  {
    group: 'Individual users',
    who: 'Blood seekers and donors',
    component: 'CCP 1, donor matching optimisation',
    future: 'Future implementation: NSGA-II multi-objective optimisation',
    steps: ['Blood request', 'Compatible donors', 'Ranked donors', 'Request and conversation'],
  },
  {
    group: 'Blood banks',
    who: 'Blood-bank administrators',
    component: 'CCP 2, blood demand predictive analysis',
    future: 'Future implementation: trained forecasting model',
    steps: ['Recorded demand', 'Prototype forecast', 'Shortage signal', 'Planning action'],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <p className="bg-slate-100 border-b border-slate-200 px-5 py-2 text-center text-[11.5px] leading-[1.6] text-slate-600">
        Proposal-stage prototype. All data shown is simulated demonstration data and all
        computational output is simulated. NSGA-II optimisation and the forecasting model are
        committed implementation work, not part of this prototype.
      </p>

      <header className="border-b border-slate-200">
        <div className="max-w-[900px] mx-auto px-5 sm:px-8 h-[52px] flex items-center justify-between">
          <BloodGridLogo />
          <Button variant="primary" size="sm" to="/enter">Enter the prototype</Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-14">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Final year project, proposal defense prototype
          </p>
          <h1 className="mt-3 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-slate-900 max-w-[20ch]">
            One platform for blood requests and blood supply.
          </h1>
          <p className="mt-4 text-[14px] leading-[1.65] text-slate-600 max-w-[62ch]">
            BloodGrid connects a person searching for a donor with the donors who can actually
            help, and gives blood banks a view of the demand forming over the weeks ahead. Both
            run on the same system.
          </p>
          <div className="mt-7">
            <Button variant="primary" to="/enter">Enter the prototype</Button>
          </div>

          <section className="mt-16 border-t border-slate-200 pt-10">
            <h2 className="text-[14px] font-semibold text-slate-900">How the system is organised</h2>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-slate-600 max-w-[62ch]">
              Two user groups, each with one computational component behind their workflow.
            </p>

            <div className="mt-7 grid sm:grid-cols-2 gap-x-10 gap-y-9">
              {BRANCHES.map((branch) => (
                <div key={branch.group}>
                  <h3 className="text-[13.5px] font-semibold text-slate-900">{branch.group}</h3>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{branch.who}</p>

                  <p className="mt-3.5 text-[12.5px] font-medium text-crimson-800">
                    {branch.component}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">{branch.future}</p>

                  <ol className="mt-4 space-y-1.5">
                    {branch.steps.map((step, index) => (
                      <li key={step} className="flex gap-2.5 text-[12.5px] text-slate-700">
                        <span className="text-slate-400 tabular-nums">{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 border-t border-slate-200 pt-10">
            <h2 className="text-[14px] font-semibold text-slate-900">What this prototype is</h2>
            <dl className="mt-4 space-y-3.5 max-w-[68ch]">
              <div>
                <dt className="text-[13px] font-medium text-slate-800">Simulated, and labelled as such</dt>
                <dd className="mt-0.5 text-[12.5px] leading-[1.6] text-slate-600">
                  Both computational outputs are simulated. No accuracy or evaluation results are
                  claimed anywhere, because none exist yet.
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-slate-800">Private by construction</dt>
                <dd className="mt-0.5 text-[12.5px] leading-[1.6] text-slate-600">
                  Donors are located to sector level, never to an address, and their contact
                  details are never shown. Seekers and donors talk inside BloodGrid once a donor
                  accepts a request.
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-slate-800">Runs offline</dt>
                <dd className="mt-0.5 text-[12.5px] leading-[1.6] text-slate-600">
                  No external services, no API keys, no network access required.
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11.5px] text-slate-500">
            BloodGrid proposal-stage proof of concept. Simulated demonstration data throughout.
          </p>
          <Link to="/enter" className="text-[12px] font-medium text-crimson-800 hover:underline">
            Enter the prototype
          </Link>
        </div>
      </footer>
    </div>
  );
}
