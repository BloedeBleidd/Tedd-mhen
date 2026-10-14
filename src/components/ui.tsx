import { ArrowUpRight, CircleHelp, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useReveal } from '../lib/motion';
export const prettyDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(
    'en-GB',
    options || { day: 'numeric', month: 'short' },
  );
export const number = (value: number | null | undefined, digits = 1) =>
  value == null ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: digits });
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your journal…
    </div>
  );
}
export function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <div className="notice error" role="alert">
      {message}
    </div>
  ) : null;
}
export function EmptyState({
  title = 'A little data. A clearer picture.',
  description = 'Start with one check-in. Your personal patterns will take shape over time.',
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">↗</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button primary" to="/check-in">
          Record your first day <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        placeholder="Not recorded"
      />
    </Field>
  );
}
export function Scale({
  label,
  value,
  min = 0,
  max = 10,
  low,
  high,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  low: string;
  high: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className={`scale ${value === null ? 'unrecorded' : ''}`}>
      <div className="scale-top">
        <label>
          <input
            type="checkbox"
            checked={value !== null}
            onChange={(e) => onChange(e.target.checked ? Math.round((min + max) / 2) : null)}
          />
          {label}
        </label>
        <span className="scale-value">
          {value === null ? (
            'Not recorded'
          ) : (
            <>
              {value}
              <small> / {max}</small>
            </>
          )}
        </span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value ?? Math.round((min + max) / 2)}
        disabled={value === null}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="scale-anchors">
        <span>
          {min} · {low}
        </span>
        <span>
          {max} · {high}
        </span>
      </div>
    </div>
  );
}
export function HelpLink() {
  return (
    <Link className="text-link" to="/help">
      <CircleHelp size={15} /> How to read this
    </Link>
  );
}
