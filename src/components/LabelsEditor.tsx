import { useState } from 'react';
export function LabelsEditor({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const label = draft.trim().toLowerCase().replace(/\s+/g, ' ');
    if (
      label &&
      label.length <= 40 &&
      !(value || []).includes(label) &&
      (value || []).length < 12
    ) {
      onChange([...(value || []), label]);
      setDraft('');
    }
  };
  return (
    <div className="labels-editor">
      <label className="check-label">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => onChange(e.target.checked ? [] : null)}
        />
        Record context labels
      </label>
      <p className="small muted">
        Examples: travel, late meal, evening session. Checked with no labels means explicitly none;
        unchecked means unknown. Use consistent labels for analysis.
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
                aria-label={`Remove label ${label}`}
              >
                {label} ×
              </button>
            ))}
          </div>
          <div className="label-add">
            <input
              aria-label="New context label"
              value={draft}
              maxLength={40}
              placeholder="Add a reusable label"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button
              type="button"
              className="button secondary"
              onClick={add}
              disabled={!draft.trim() || value.length >= 12}
            >
              Add label
            </button>
          </div>
          <p className="small muted">
            {value.length} / 12 labels. Labels describe context; optional notes are not model
            inputs.
          </p>
        </>
      )}
    </div>
  );
}
