/** Shared UI primitives for BloodGrid. Hand-built; no component library. */

import React from 'react';
import { Link } from 'react-router-dom';

/* ---------------------------------------------------------------- Card */

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title, subtitle, icon, action, className = '',
}: {
  title: React.ReactNode; subtitle?: React.ReactNode;
  icon?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 text-slate-400 shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 leading-5">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Button */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  to?: string;
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

const BTN_VARIANT = {
  primary:   'bg-crimson-600 text-white hover:bg-crimson-700 active:bg-crimson-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:    'bg-red-600 text-white hover:bg-red-700',
};

const BTN_SIZE = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-sm px-5 py-2.5',
};

export function Button({
  variant = 'primary', size = 'md', to, full, className = '', children, ...rest
}: ButtonProps) {
  const cls = `${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${full ? 'w-full' : ''} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

/* --------------------------------------------------------------- Badge */

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'slate' | 'violet';

const TONE: Record<Tone, string> = {
  red:    'bg-red-50 text-red-700 border-red-200',
  amber:  'bg-amber-50 text-amber-800 border-amber-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue:   'bg-sky-50 text-sky-700 border-sky-200',
  slate:  'bg-slate-100 text-slate-600 border-slate-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

export function Badge({
  tone = 'slate', children, className = '', dot,
}: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${TONE[tone]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/** Blood group chip — a recurring identity element across the app. */
export function GroupChip({ group, size = 'md' }: { group: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-sm';
  return (
    <span className={`${s} shrink-0 inline-flex items-center justify-center rounded-lg bg-crimson-50 text-crimson-700 border border-crimson-200 font-bold nums`}>
      {group}
    </span>
  );
}

/* ------------------------------------------------------------ StatTile */

export function StatTile({
  label, value, unit, hint, tone = 'slate', icon,
}: {
  label: string; value: React.ReactNode; unit?: string;
  hint?: React.ReactNode; tone?: Tone; icon?: React.ReactNode;
}) {
  const accent = {
    red: 'text-red-600', amber: 'text-amber-600', green: 'text-emerald-600',
    blue: 'text-sky-600', slate: 'text-slate-900', violet: 'text-violet-600',
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {icon && <span className="text-slate-300">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-semibold nums ${accent}`}>
        {value}
        {unit && <span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </Card>
  );
}

/* ------------------------------------------------- Empty / Loading etc */

export function EmptyState({
  icon, title, message, action,
}: { icon?: React.ReactNode; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      {icon && <div className="text-slate-300 mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Field({
  label, hint, children, required,
}: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-crimson-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none transition-colors';

/** Segmented option selector used for blood group and urgency. */
export function SegmentedOptions<T extends string>({
  options, value, onChange, columns = 4,
}: {
  /** `options` is the sole inference site for T — the others must not widen it. */
  options: readonly { value: T; label: string }[];
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  columns?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value} type="button" onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
              active
                ? 'bg-crimson-600 border-crimson-600 text-white shadow-sm'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal proportion bar used for criteria breakdowns and stock levels. */
export function MeterBar({
  value, tone = 'crimson', className = '',
}: { value: number; tone?: 'crimson' | 'emerald' | 'amber' | 'red' | 'sky'; className?: string }) {
  const bg = {
    crimson: 'bg-crimson-500', emerald: 'bg-emerald-500',
    amber: 'bg-amber-500', red: 'bg-red-500', sky: 'bg-sky-500',
  }[tone];
  return (
    <div className={`h-1.5 w-full rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${bg} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}
