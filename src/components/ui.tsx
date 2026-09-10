/**
 * BloodGrid interface primitives.
 *
 * The visual language is deliberately plain: white ground, hairline borders,
 * almost no shadow, and colour reserved for meaning. Content is organised into
 * sections separated by rules rather than floating cards, which keeps dense
 * clinical information readable.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { Tone } from '../lib/status';

/* ------------------------------------------------------------- Page frame */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-7">{children}</div>;
}

export function PageTitle({
  title, description, actions, back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-7">
      {back && (
        <Link
          to={back.to}
          className="inline-block text-[12px] text-slate-500 hover:text-slate-800 mb-2.5"
        >
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold tracking-[-0.011em] text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-[13px] leading-[1.55] text-slate-600 max-w-[62ch]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * A titled region of a page. Sections are separated by a rule, not by a card,
 * so a screen reads as one document rather than a scatter of tiles.
 */
export function Section({
  title, description, actions, children, divide = true,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  divide?: boolean;
}) {
  return (
    <section className={divide ? 'border-t border-slate-200 pt-6 mt-7 first:border-0 first:pt-0 first:mt-0' : ''}>
      {(title || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5 mb-4">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-slate-600 max-w-[68ch]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A quiet bordered container, for things that genuinely are discrete objects. */
export function Panel({
  children, className = '', ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`border border-slate-200 rounded-md bg-white ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Buttons */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'sm' | 'md';
  to?: string;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const BUTTON_VARIANTS = {
  primary: 'bg-crimson-700 text-white border border-crimson-700 hover:bg-crimson-800 hover:border-crimson-800',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
  quiet: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900',
};

export function Button({
  variant = 'secondary', size = 'md', to, block, className = '', children, ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap',
    'transition-colors disabled:opacity-45 disabled:pointer-events-none',
    size === 'sm' ? 'text-[12.5px] px-2.5 py-1.5' : 'text-[13px] px-3.5 py-2',
    BUTTON_VARIANTS[variant],
    block ? 'w-full' : '',
    className,
  ].join(' ');

  if (to) return <Link to={to} className={classes}>{children}</Link>;
  return <button className={classes} {...rest}>{children}</button>;
}

/* ----------------------------------------------------------------- Status */

const TONE_STYLES: Record<Tone, string> = {
  neutral:   'bg-slate-100 text-slate-700',
  info:      'bg-sky-50 text-sky-800',
  good:      'bg-emerald-50 text-emerald-800',
  attention: 'bg-amber-50 text-amber-900',
  urgent:    'bg-red-50 text-red-800',
};

const DOT_STYLES: Record<Tone, string> = {
  neutral:   'bg-slate-400',
  info:      'bg-sky-500',
  good:      'bg-emerald-500',
  attention: 'bg-amber-500',
  urgent:    'bg-red-500',
};

export function Status({
  tone = 'neutral', children, className = '',
}: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11.5px] font-medium ${TONE_STYLES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Status shown as a labelled dot. Lighter than a filled chip in dense lists. */
export function StatusDot({
  tone = 'neutral', children,
}: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[tone]}`} />
      {children}
    </span>
  );
}

/** Blood group, set in a monospaced-feeling tag so groups line up in lists. */
export function BloodGroup({
  group, size = 'md',
}: { group: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-[11.5px] px-1.5 py-0.5 min-w-[30px]',
    md: 'text-[13px] px-2 py-1 min-w-[38px]',
    lg: 'text-[15px] px-2.5 py-1.5 min-w-[46px]',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded font-semibold tabular-nums bg-crimson-50 text-crimson-800 ${sizes[size]}`}>
      {group}
    </span>
  );
}

/* ------------------------------------------------------------------- Data */

/**
 * A row of figures separated by rules. Replaces the grid of stat cards: the
 * same numbers, far less furniture.
 */
export function FigureRow({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 border border-slate-200 rounded-md px-5 py-4 bg-white">
      {children}
    </dl>
  );
}

export function Figure({
  label, value, unit, note, tone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  tone?: Tone;
}) {
  const valueColour =
    tone === 'urgent' ? 'text-red-700'
    : tone === 'attention' ? 'text-amber-800'
    : tone === 'good' ? 'text-emerald-800'
    : 'text-slate-900';
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className={`mt-1 text-[21px] font-semibold tabular-nums leading-none ${valueColour}`}>
        {value}
        {unit && <span className="ml-1 text-[12.5px] font-normal text-slate-500">{unit}</span>}
      </dd>
      {note && <p className="mt-1.5 text-[12px] leading-snug text-slate-500">{note}</p>}
    </div>
  );
}

/** Label/value pairs, for summaries and detail panels. */
export function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-slate-100">{children}</dl>;
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-900 text-right min-w-0">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ Table */

export function Table({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-md">
      <table className="w-full text-[13px]" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-3.5 py-2.5 font-medium text-[12px] text-slate-500 whitespace-nowrap border-b border-slate-200 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children, align = 'left', className = '',
}: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td className={`px-3.5 py-2.5 align-middle ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------- Bars */

const BAR_COLOURS: Record<Tone, string> = {
  neutral:   'bg-slate-400',
  info:      'bg-sky-500',
  good:      'bg-emerald-500',
  attention: 'bg-amber-500',
  urgent:    'bg-red-500',
};

export function Bar({
  value, tone = 'neutral', className = '',
}: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1 w-full rounded-full bg-slate-150 bg-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${BAR_COLOURS[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */

export const inputStyles =
  'w-full text-[13px] px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-crimson-600 focus:ring-1 focus:ring-crimson-600 outline-none';

export function Field({
  label, hint, children, htmlFor,
}: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  options, value, onChange, columns = 4, ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: NoInfer<T>;
  onChange: (next: NoInfer<T>) => void;
  columns?: number;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup" aria-label={ariaLabel}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md border py-1.5 text-[13px] font-medium transition-colors ${
              selected
                ? 'border-crimson-700 bg-crimson-50 text-crimson-800'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- States */

export function EmptyState({
  title, message, action,
}: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-slate-300 rounded-md px-6 py-10 text-center">
      <p className="text-[13.5px] font-medium text-slate-800">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500 max-w-[46ch] mx-auto">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A short, bordered message. Used for confirmations and warnings alike. */
export function Notice({
  tone = 'neutral', title, children,
}: { tone?: Tone; title?: string; children?: React.ReactNode }) {
  const borders: Record<Tone, string> = {
    neutral:   'border-slate-200 bg-slate-50',
    info:      'border-sky-200 bg-sky-50',
    good:      'border-emerald-200 bg-emerald-50',
    attention: 'border-amber-200 bg-amber-50',
    urgent:    'border-red-200 bg-red-50',
  };
  const headings: Record<Tone, string> = {
    neutral: 'text-slate-900', info: 'text-sky-900', good: 'text-emerald-900',
    attention: 'text-amber-900', urgent: 'text-red-900',
  };
  return (
    <div className={`border rounded-md px-4 py-3 ${borders[tone]}`}>
      {title && <p className={`text-[13px] font-semibold ${headings[tone]}`}>{title}</p>}
      {children && (
        <div className={`text-[12.5px] leading-[1.6] text-slate-700 ${title ? 'mt-1' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}
