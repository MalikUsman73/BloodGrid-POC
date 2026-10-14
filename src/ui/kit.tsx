import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { IconAlert, IconCheck, IconInfo } from './icons';

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, block, className = '', children, disabled, ...rest }: ButtonProps) {
  const cls = ['btn', variant === 'secondary' ? '' : variant, size === 'md' ? '' : size, block ? 'block' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" {...rest} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, optional, children }: FieldProps) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="opt">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="error-text" id={`${htmlFor}-err`} role="alert">{error}</p>
      ) : hint ? (
        <p className="hint" id={`${htmlFor}-hint`}>{hint}</p>
      ) : null}
    </div>
  );
}

/** ARIA wiring shared by every control inside a Field. */
export const describe = (id: string, error?: string, hint?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`input ${className}`} {...rest} />;
});

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input {...props} className="input" type={show ? 'text' : 'password'} />
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...rest}>{children}</select>;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
  render?: (v: T) => ReactNode;
  idPrefix?: string;
  invalid?: boolean;
}

/** A row of toggle buttons for a small closed set, such as blood group or urgency. */
export function Segmented<T extends string>({ label, value, options, onChange, columns = 4, render, idPrefix, invalid }: SegmentedProps<T>) {
  return (
    <div className={`segmented cols-${columns}`} role="group" aria-label={label} aria-invalid={invalid || undefined} id={idPrefix}>
      {options.map((o) => (
        <button key={o} type="button" className="seg" aria-pressed={value === o} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

/* ---------- Display ---------- */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'brand' | 'neutral';

export function Badge({ tone = 'neutral', plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) {
  return <span className={['badge', tone === 'neutral' ? '' : tone, plain ? 'plain' : ''].filter(Boolean).join(' ')}>{children}</span>;
}

export function GroupChip({ group }: { group: string }) {
  return <span className="group-chip">{group}</span>;
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; title?: string; children?: ReactNode }) {
  const Icon = tone === 'ok' ? IconCheck : tone === 'info' ? IconInfo : IconAlert;
  return (
    <div className={`alert ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon />
      <div className="body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: string; icon?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="k">{icon}{label}</div>
      <div className="v num">{value}</div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
