import type { ReactNode } from 'react';
import { Brand } from '../../ui/AppShell';
import { IconCheck } from '../../ui/icons';
import { Alert } from '../../ui/kit';
import { useApp } from '../../state/AppContext';

const POINTS = [
  'Donors stay anonymous. Recipients and hospitals only ever see a code, a blood group and a sector.',
  'Every match screens for compatibility, availability, the 90-day interval and distance.',
  'Accounts are role-based: what you can see depends on whether you donate or request.',
];

export function AuthLayout({ children }: { children: ReactNode }) {
  const { mode, offlineReason } = useApp();
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Brand />
        <h2>The right donors, notified in the right order.</h2>
        <p>BloodGrid screens the donor pool and picks the people most likely to help quickly, without exposing who they are.</p>
        <ul>
          {POINTS.map((p) => (
            <li key={p}><IconCheck />{p}</li>
          ))}
        </ul>
        <div className="foot">Final-year project · Islamabad pilot · synthetic data</div>
      </aside>
      <div className="auth-main">
        <div className="auth-box">
          {children}
          {mode === 'local' && (
            <div className="mode-note">
              <Alert tone="info" title="Demo mode">
                {offlineReason ? 'The database could not be reached, so ' : 'No database is configured, so '}
                accounts are kept in this browser only.
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
