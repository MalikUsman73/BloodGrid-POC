import type { ReactNode } from 'react';
import { IconAlert, IconInbox } from './icons';
import { Button } from './kit';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="art"><IconInbox /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="art"><IconAlert /></div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card-body" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${92 - i * 10}%`, marginBottom: 16 }} />
      ))}
    </div>
  );
}
