import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { t } from '../i18n';

export function ChartFrame({ children }: { children: ReactNode }) {
  useTranslation();
  const [size, setSize] = useState('auto');
  const id = useId();
  return (
    <div className={`chart-frame chart-size-${size}`}>
      <div className="chart-controls">
        <label htmlFor={id}>{t('analysisTools:chartSize')}</label>
        <select id={id} value={size} onChange={(event) => setSize(event.target.value)}>
          <option value="auto">{t('analysisTools:automatic')}</option>
          <option value="compact">{t('analysisTools:compact')}</option>
          <option value="large">{t('analysisTools:large')}</option>
        </select>
      </div>
      {children}
    </div>
  );
}
