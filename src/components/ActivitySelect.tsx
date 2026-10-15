import { usePreferences } from '../lib/preferences-context';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activityGroups, workoutTypes, type Activity } from '../../shared/activities';
import { t as tr } from '../i18n';
import { searchText } from '../lib/search-text';
export function ActivitySelect({
  value,
  onChange,
  includeAll = false,
}: {
  value: string;
  onChange: (value: Activity | 'all') => void;
  includeAll?: boolean;
}) {
  useTranslation();
  const { preferences, rank, remember } = usePreferences();
  const [search, setSearch] = useState('');
  const id = useId();
  const normalized = searchText(search);
  const matches = workoutTypes.filter(
    (activity) =>
      searchText(tr(`activities:${activity}`)).includes(normalized) ||
      searchText(activity).includes(normalized),
  );
  const visible = workoutTypes.filter(
    (activity) => activity === value || matches.includes(activity),
  );
  const recent = rank(
    visible.filter((activity) =>
      preferences.usage.some((u) => u.list === 'activity' && u.value === activity),
    ),
    'activity',
    (value) => value,
  ).slice(0, 8);
  return (
    <div className="activity-select">
      <input
        id={`${id}-search`}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={tr('activityPicker:search')}
        placeholder={tr('activityPicker:search')}
      />
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value !== 'all') remember('activity', e.target.value);
          onChange(e.target.value as Activity | 'all');
        }}
        aria-label={tr('activityPicker:activity')}
      >
        {includeAll && <option value="all">{tr('activityPicker:all')}</option>}
        {!!recent.length && (
          <optgroup label={tr('personalization:recent')}>
            {recent.map((activity) => (
              <option key={activity} value={activity}>
                {tr(`activities:${activity}`)}
              </option>
            ))}
          </optgroup>
        )}
        {[...new Set(workoutTypes.map((activity) => activityGroups[activity]))].map((group) => {
          const activities = visible.filter(
            (activity) => activityGroups[activity] === group && !recent.includes(activity),
          );
          return activities.length ? (
            <optgroup key={group} label={tr(`activityPicker:${group}`)}>
              {activities.map((activity) => (
                <option key={activity} value={activity}>
                  {tr(`activities:${activity}`)}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {search && (
        <small role="status">
          {tr(matches.length ? 'activityPicker:matches' : 'activityPicker:none', {
            count: matches.length,
          })}
        </small>
      )}
    </div>
  );
}
