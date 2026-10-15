import type { Feature } from '../../shared/features';
import { scaleDefinitions } from '../../shared/schema';
import { localize, t } from '../i18n';

export function featureDescription(feature: Feature): string {
  const scale = scaleDefinitions[feature.id as keyof typeof scaleDefinitions];
  return scale
    ? t('measurements:scaleDescription', {
        min: scale.min,
        low: localize(scale.low),
        high: localize(scale.high),
      })
    : localize(feature.description);
}
