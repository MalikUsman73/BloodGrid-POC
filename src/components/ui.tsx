/**
 * BloodGrid interface primitives.
 *
 * The application sits on a tinted ground with white surfaces on top, which is
 * what lets dense information read as structured rather than as a wall. Colour
 * is reserved for meaning: one brand hue for primary actions and blood-group
 * tags, and a small set of status tones chosen from what a value means.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { Tone } from '../lib/status';

/* ------------------------------------------------------------- Page frame */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1320px] mx-auto px-5 sm:px-7 py-6">{children}</div>;
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
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 mb-2"
        >
          <span aria-hidden="true">&larr;</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em] text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-slate-600 max-w-[76ch]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Surface */

/**
 * A white content surface on the tinted ground. Most things on a screen belong
 * inside one of these; it is the unit that makes the layout read as a product.
 */
export function Surface({
  children, className = '', padded = false,
}: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`border border-slate-200 rounded-lg shadow-surface ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function SurfaceHeader({
  title, description, actions, className = '',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 py-3.5 border-b border-slate-200 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-slate-600 max-w-[78ch]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** A small uppercase label, for panel sections and column groupings. */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 ${className}`}>
      {children}
    </p>
  );
}

/** A titled region of a page, used between surfaces. */
export function Section({
  title, description, actions, children, className = '',
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className || 'mb-6'}>
      {(title || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 mb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-1 text-[13px] leading-[1.55] text-slate-600 max-w-[78ch]">
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

/* ---------------------------------------------------------------- Buttons */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'sm' | 'md';
  to?: string;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const BUTTON_VARIANTS = {
  primary: 'bg-crimson-700 text-white border border-crimson-700 hover:bg-crimson-800 hover:border-crimson-800 shadow-surface',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-surface',
  quiet: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900',
};

export function Button({
  variant = 'secondary', size = 'md', to, block, className = '', children, ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap',
    'transition-colors disabled:opacity-45 disabled:pointer-events-none',
    size === 'sm' ? 'text-[13px] px-2.5 py-1.5' : 'text-[13.5px] px-3.5 py-2',
    BUTTON_VARIANTS[variant],
    block ? 'w-full' : '',
    className,
  ].join(' ');

  if (to) return <Link to={to} className={classes}>{children}</Link>;
  return <button className={classes} {...rest}>{children}</button>;
}

/* ----------------------------------------------------------------- Status */

const TONE_STYLES: Record<Tone, string> = {
  neutral:   'bg-slate-100 text-slate-700 ring-slate-200',
  info:      'bg-sky-50 text-sky-800 ring-sky-200',
  good:      'bg-emerald-50 text-emerald-800 ring-emerald-200',
  attention: 'bg-amber-50 text-amber-900 ring-amber-200',
  urgent:    'bg-red-50 text-red-800 ring-red-200',
};

const DOT_STYLES: Record<Tone, string> = {
  neutral: 'bg-slate-400', info: 'bg-sky-500', good: 'bg-emerald-500',
  attention: 'bg-amber-500', urgent: 'bg-red-500',
};

export function Status({
  tone = 'neutral', children, className = '',
}: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${TONE_STYLES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** A labelled dot. Lighter than a filled chip where a list already has weight. */
export function StatusDot({
  tone = 'neutral', children,
}: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${DOT_STYLES[tone]}`} />
      {children}
    </span>
  );
}

export function BloodGroup({
  group, size = 'md',
}: { group: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-[12px] px-1.5 py-0.5 min-w-[32px]',
    md: 'text-[13.5px] px-2 py-1 min-w-[40px]',
    lg: 'text-[18px] px-3 py-2 min-w-[54px]',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-md font-semibold tabular-nums bg-crimson-50 text-crimson-800 ring-1 ring-inset ring-crimson-200 ${sizes[size]}`}>
      {group}
    </span>
  );
}

/* ------------------------------------------------------------------- Data */

/** A row of figures inside a surface, divided by rules. */
export function FigureRow({ children, columns = 4 }: { children: React.ReactNode; columns?: number }) {
  return (
    <dl
      className="grid divide-x divide-slate-200"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
    >
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
    <div className="px-5 py-4 min-w-0">
      <dt className="text-[12.5px] text-slate-500">{label}</dt>
      <dd className={`mt-1.5 text-[25px] font-semibold tabular-nums leading-none ${valueColour}`}>
        {value}
        {unit && <span className="ml-1 text-[13px] font-normal text-slate-500">{unit}</span>}
      </dd>
      {note && <p className="mt-2 text-[12.5px] leading-snug text-slate-500">{note}</p>}
    </div>
  );
}

export function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-slate-100">{children}</dl>;
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13.5px]">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-900 text-right min-w-0">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ Table */

/** Tables live inside a Surface, so they carry no border of their own. */
export function Table({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-medium text-[12px] uppercase tracking-[0.04em] text-slate-500 whitespace-nowrap border-b border-slate-200 bg-slate-50/70 ${
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
    <td className={`px-4 py-3 align-middle ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------- Bars */

const BAR_COLOURS: Record<Tone, string> = {
  neutral: 'bg-slate-400', info: 'bg-sky-500', good: 'bg-emerald-500',
  attention: 'bg-amber-500', urgent: 'bg-red-500',
};

export function Bar({
  value, tone = 'neutral', className = '',
}: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${BAR_COLOURS[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */

export const inputStyles =
  'w-full text-[13.5px] px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-crimson-600 focus:ring-1 focus:ring-crimson-600 outline-none';

export function Field({
  label, hint, children, htmlFor,
}: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] leading-snug text-slate-500">{hint}</p>}
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
            className={`rounded-md border py-2 text-[13.5px] font-medium transition-colors ${
              selected
                ? 'border-crimson-700 bg-crimson-50 text-crimson-800'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
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
    <div className="px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-slate-800">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 max-w-[48ch] mx-auto">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = 'neutral', title, children,
}: { tone?: Tone; title?: string; children?: React.ReactNode }) {
  const surfaces: Record<Tone, string> = {
    neutral:   'border-slate-200 bg-white',
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
    <div className={`border rounded-lg px-4 py-3 ${surfaces[tone]}`}>
      {title && <p className={`text-[13.5px] font-semibold ${headings[tone]}`}>{title}</p>}
      {children && (
        <div className={`text-[13px] leading-[1.6] text-slate-700 ${title ? 'mt-1' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}
