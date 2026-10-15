import { t, localize, hasSourceMessage } from '../i18n';
import { metrics } from '../../shared/metrics';

type Issue = {
  code: string;
  path?: PropertyKey[];
  message?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
  expected?: string;
  origin?: string;
  keys?: string[];
};
export function fieldName(path: string): string {
  if (!path || path === 'entry') return t('validation:field');
  const normalized = path.replace(/^entry\./, '');
  const key = normalized
    .split('.')
    .filter((part) => !/^\d+$/.test(part))
    .join('.');
  if (Object.hasOwn(metrics, key)) return localize(metrics[key as keyof typeof metrics].label);
  const lookup: Record<string, string> = {
    'sleep.durationMinutes': 'sleepMinutes',
    'sleep.bedtime': 'bedtime',
    'sleep.wakeTime': 'wakeTime',
    'sleep.latencyMinutes': 'sleepLatency',
    'sleep.awakenings': 'awakenings',
    'sleep.score': 'sleepScore',
    'sleep.quality': 'sleepQuality',
    'physiology.hrv': 'hrv',
    'physiology.hrvMethod': 'hrvMethod',
    'physiology.source': 'source',
    'physiology.restingHeartRate': 'restingHeartRate',
    'physiology.respiratoryRate': 'respiratoryRate',
    'physiology.temperatureC': 'temperature',
    'physiology.weightKg': 'weight',
  };
  return t('fields:' + (lookup[key] || key), { defaultValue: normalized });
}
export function issueMessage(issue: Issue): string {
  if (issue.message && hasSourceMessage(issue.message)) return localize(issue.message);
  if (issue.code === 'too_small' && issue.origin === 'number' && issue.inclusive === false)
    return t('validation:greaterThan', { limit: String(issue.minimum) });
  if (issue.code === 'custom') return localize(issue.message || '');
  if (issue.code === 'too_small')
    return t('validation:minimum', {
      limit: String(issue.minimum),
      unit: t('validation:unit_' + (issue.origin || 'number')),
    });
  if (issue.code === 'too_big')
    return t('validation:maximum', {
      limit: String(issue.maximum),
      unit: t('validation:unit_' + (issue.origin || 'number')),
    });
  if (issue.code === 'invalid_type')
    return t('validation:type', {
      type: t('validation:type_' + issue.expected, { defaultValue: issue.expected }),
    });
  if (issue.code === 'unrecognized_keys')
    return t('validation:unknownFields', { fields: issue.keys?.join(', ') });
  return t('validation:invalid');
}
export function formatIssues(issues: Issue[]): string {
  return issues
    .map((issue) => `${fieldName(issue.path?.join('.') || '')}: ${issueMessage(issue)}`)
    .join('; ');
}
export function errorText(message: string | null | undefined): string {
  if (!message) return '';
  if (/^[a-zA-Z]+:[a-zA-Z_]+$/.test(message)) return t(message);
  try {
    const issues = JSON.parse(message);
    if (Array.isArray(issues) && issues.every((issue) => issue && typeof issue.code === 'string'))
      return formatIssues(issues);
  } catch {
    /* Most application messages are plain text. */
  }
  const observation = message.match(/^Observation (\d+): ([\s\S]*)$/);
  if (observation)
    return t('errors:observation', { value0: observation[1], value1: errorText(observation[2]) });
  const localized = localize(message);
  if (localized !== message) return localized;
  return message;
}
