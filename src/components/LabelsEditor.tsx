import { usePreferences } from '../lib/preferences-context';
import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from '../i18n';
import { useId, useState } from 'react';
export function LabelsEditor({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  useTranslation();
  const { preferences, rank, remember } = usePreferences();
  const suggestionsId = useId();
  const suggestions = rank(
    preferences.usage
      .filter((u) => u.list === 'label' && !value?.includes(u.value))
      .map((u) => u.value),
    'label',
    (label) => label,
  );
  const [draft, setDraft] = useState('');
  const add = () => {
    const label = draft.trim();
    if (
      label &&
      label.length <= 40 &&
      !(value || []).includes(label) &&
      (value || []).length < 12
    ) {
      remember('label', label);
      onChange([...(value || []), label]);
      setDraft('');
    }
  };
  return (
    <div className="labels-editor">
      <label className="check-label">
        <Trans
          i18nKey="labelsEditor:recordContextLabels"
          components={{
            slot0: (
              <input
                type="checkbox"
                checked={value !== null}
                onChange={(e) => onChange(e.target.checked ? [] : null)}
              />
            ),
          }}
        />
      </label>
      <p className="small muted">
        {tr('labelsEditor:examplesTravelLateMealEveningSessionCheckedWithNo')}
      </p>
      {value !== null && (
        <>
          <div className="label-chips">
            {value.map((label) => (
              <button
                type="button"
                className="tag"
                key={label}
                onClick={() => onChange(value.filter((v) => v !== label))}
                aria-label={tr('labelsEditor:removeLabel', { value0: label })}
              >
                {label} ×
              </button>
            ))}
          </div>
          <div className="label-add">
            <input
              aria-label={tr('labelsEditor:newContextLabel')}
              value={draft}
              maxLength={40}
              list={suggestionsId}
              placeholder={tr('labelsEditor:addAReusableLabel')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <datalist id={suggestionsId}>
              {suggestions.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
            <button
              type="button"
              className="button secondary"
              onClick={add}
              disabled={!draft.trim() || value.length >= 12}
            >
              {tr('labelsEditor:addLabel')}
            </button>
          </div>
          <p className="small muted">
            <Trans
              i18nKey="labelsEditor:12LabelsLabelsDescribeContextOptionalNotesAreNot"
              components={{ slot0: <MessageValue value={value.length} /> }}
            />
          </p>
        </>
      )}
    </div>
  );
}
