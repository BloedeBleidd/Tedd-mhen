import { errorText } from '../lib/validation-messages';
import { useTranslation, Trans } from 'react-i18next';
import { localize, t as tr, locale } from '../i18n';
import { ArrowUpRight, CircleHelp, LoaderCircle } from 'lucide-react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import type { ReactNode } from 'react';
import { useReveal } from '../lib/motion';
export const prettyDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(
    locale(),
    options || { day: 'numeric', month: 'short' },
  );
export const number = (value: number | null | undefined, digits = 1) =>
  value == null ? '—' : value.toLocaleString(locale(), { maximumFractionDigits: digits });
export const numberRange = (values: readonly [number, number], digits = 2) =>
  `${number(values[0], digits)} – ${number(values[1], digits)}`;
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
  useTranslation();
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
  id,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  useTranslation();
  const reveal = useReveal<HTMLElement>();
  return (
    <section id={id} ref={reveal} className={`panel ${className}`}>
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
  useTranslation();
  return (
    <div className="loading" role="status">
      <Trans
        i18nKey="ui:loadingYourJournal"
        components={{ slot0: <LoaderCircle className="spin" size={22} /> }}
      />
    </div>
  );
}
export function ErrorBox({ message }: { message: string | null }) {
  useTranslation();
  return message ? (
    <div className="notice error" role="alert">
      {errorText(message)}
    </div>
  ) : null;
}
export function EmptyState({
  title = localize('A little data. A clearer picture.'),
  description = localize(
    'Start with one check-in. Your personal patterns will take shape over time.',
  ),
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  useTranslation();
  return (
    <div className="empty-state">
      <div className="empty-symbol">↗</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button primary" to="/check-in">
          <Trans
            i18nKey="ui:recordYourFirstDay"
            components={{ slot0: <ArrowUpRight size={17} /> }}
          />
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
  useTranslation();
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
  useTranslation();
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        placeholder={tr('ui:notRecorded')}
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
  useTranslation();
  return (
    <div className={`scale ${value === null ? 'unrecorded' : ''}`}>
      <div className="scale-top">
        <label>
          <input
            type="checkbox"
            checked={value !== null}
            onChange={(e) => onChange(e.target.checked ? Math.round((min + max) / 2) : null)}
          />
          {localize(label)}
        </label>
        <span className="scale-value">
          {value === null ? (
            localize('Not recorded')
          ) : (
            <>
              {value}
              <small> / {max}</small>
            </>
          )}
        </span>
      </div>
      <input
        aria-label={localize(label)}
        type="range"
        min={min}
        max={max}
        value={value ?? Math.round((min + max) / 2)}
        disabled={value === null}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="scale-anchors">
        <span>
          {min} · {localize(low)}
        </span>
        <span>
          {max} · {localize(high)}
        </span>
      </div>
    </div>
  );
}
export function HelpLink() {
  useTranslation();
  return (
    <Link className="text-link" to="/help">
      <Trans i18nKey="ui:howToReadThis" components={{ slot0: <CircleHelp size={15} /> }} />
    </Link>
  );
}
