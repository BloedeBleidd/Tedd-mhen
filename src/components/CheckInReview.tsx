import { useTranslation } from 'react-i18next';
import { localize, t } from '../i18n';
import type { reviewCheckIn } from '../../shared/checkin-review';
import { number, numberRange } from './ui';

export function CheckInReview({
  result,
  loading,
  unavailable,
  open,
  setOpen,
  confirmed,
  onConfirm,
}: {
  result: ReturnType<typeof reviewCheckIn>;
  loading: boolean;
  unavailable: boolean;
  open: boolean;
  setOpen: (value: boolean) => void;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  useTranslation();
  return (
    <div id="checkin-review" className="checkin-review" tabIndex={-1}>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          {loading
            ? t('checkinReview:loading')
            : unavailable
              ? t('checkinReview:unavailable')
              : t('checkinReview:heading', { count: result.warnings.length })}
        </summary>
        <p>{t('checkinReview:purpose')}</p>
        {loading ? (
          <p role="status">{t('checkinReview:loading')}</p>
        ) : unavailable ? (
          <p role="status">{t('checkinReview:unavailable')}</p>
        ) : (
          <p>{t('checkinReview:history', { count: result.historyDays })}</p>
        )}
        {result.historyDays < 30 && !loading && !unavailable && (
          <p>{t('checkinReview:insufficient')}</p>
        )}
        <ul>
          {result.warnings.map((warning, i) => (
            <li key={i}>
              <strong>
                {localize(warning.label)}: {number(warning.value, 2)}
              </strong>
              <p>
                {warning.kind === 'value'
                  ? t('checkinReview:valueWarning', {
                      range: numberRange([warning.lower, warning.upper]),
                      count: warning.n,
                    })
                  : t('checkinReview:relationshipWarning', {
                      predictor: localize(warning.predictor),
                      value: number(warning.predictorValue, 2),
                      range: numberRange([warning.lower, warning.upper]),
                      count: warning.n,
                      correlation: number(warning.correlation, 2),
                      timing: warning.lag
                        ? t('checkinReview:previousDay')
                        : t('checkinReview:sameDay'),
                    })}
              </p>
            </li>
          ))}
        </ul>
        <p className="small muted">{t('checkinReview:method')}</p>
        <a
          className="text-link"
          href="https://itl.nist.gov/div898/handbook/eda/section3/eda35h.htm"
          target="_blank"
          rel="noreferrer"
        >
          {t('checkinReview:source')}
        </a>
      </details>
      {result.warnings.length > 0 && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirm(e.target.checked)}
          />
          {t('checkinReview:confirm')}
        </label>
      )}
    </div>
  );
}
