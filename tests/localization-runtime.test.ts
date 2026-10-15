import { customHabit } from './fixtures/habits';
import { habitPresets, habitFeatureLabel } from '../shared/habits';
import { numberRange } from '../src/components/ui';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import i18n, { languages, loadLanguage, localize, locale, t, hasSourceMessage } from '../src/i18n';
import { featureCatalog, references } from '../shared/features';
import { featureDescription } from '../src/lib/feature-labels';
import { errorText, fieldName } from '../src/lib/validation-messages';
import { emptyEntry, entrySchema, summarize } from '../shared/schema';
import { mergeImported, parseImport } from '../shared/import';
import { searchText } from '../src/lib/search-text';
import { parseLanguage } from '../src/lib/language-context';

beforeAll(async () => {
  for (const language of languages) await loadLanguage(language);
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Localized presentation and canonical records', () => {
  it('covers every habit preset and feature in all languages without translating custom names or notes', async () => {
    const entry = {
      ...emptyEntry('2026-01-01'),
      habits: [customHabit],
      revision: 1,
      createdAt: '',
      updatedAt: '',
    };
    for (const language of languages) {
      await i18n.changeLanguage(language);
      for (const preset of habitPresets)
        expect(i18n.exists(`habitCatalog:${preset}`, { lng: language })).toBe(true);
      expect(localize(habitFeatureLabel(customHabit, 'count'))).toContain(customHabit.name);
      for (const feature of featureCatalog([summarize(entry)]).filter((f) =>
        f.id.startsWith('habit:'),
      )) {
        expect(hasSourceMessage(feature.group), feature.group).toBe(true);
        expect(hasSourceMessage(feature.description), feature.description).toBe(true);
        expect(localize(feature.label)).not.toContain('Habit: {');
        expect(localize(feature.label)).toContain(customHabit.name);
      }
      expect(mergeImported(parseImport(JSON.stringify([entry]), 'json')[0]).habits).toEqual([
        customHabit,
      ]);
    }
    await i18n.changeLanguage('pl');
    expect(
      localize(habitFeatureLabel({ key: 'preset:reading_before_bed', name: null }, 'count')),
    ).toContain('Czytanie przed snem');
  });
  it('searches accented activity names without mutating their labels', () => {
    expect(searchText('Pływanie')).toBe('plywanie');
    expect(searchText('Fußball')).toBe('fussball');
    expect(searchText(' Natación ')).toBe('natacion');
    expect(searchText('Aérobie')).toBe('aerobie');
    expect(searchText('open_water_swimming')).toBe('open water swimming');
  });
  it('every built-in metadata label and description has a catalog source or explicit adapter', async () => {
    const technical = new Set([
      '1–10',
      '0–10',
      '0–100',
      '/ 10',
      '/ 100',
      '0 / 1',
      'ms',
      'kg',
      '°C',
      'h',
      'min',
      '/ min',
    ]);
    for (const f of featureCatalog()) {
      if (
        !f.label.startsWith('Activity: ') &&
        !f.label.startsWith('Symptom: ') &&
        !f.label.startsWith('Source: ') &&
        !f.label.startsWith('HRV method: ')
      )
        expect(hasSourceMessage(f.label), f.label).toBe(true);
      expect(hasSourceMessage(f.group), f.group).toBe(true);
      expect(technical.has(f.unit) || hasSourceMessage(f.unit), f.unit).toBe(true);
      expect(hasSourceMessage(f.description) || /^\d–10:/.test(f.description), f.description).toBe(
        true,
      );
    }
    for (const reference of Object.values(references))
      expect(hasSourceMessage(reference.title), reference.title).toBe(true);
    await i18n.changeLanguage('pl');
    expect(featureDescription(featureCatalog().find((f) => f.id === 'wellbeing')!)).toContain(
      'Bardzo',
    );
  });
  it('translates enum labels without translating arbitrary user text, including template-like notes', async () => {
    const entry = emptyEntry('2026-01-01');
    entry.notes = 'Swimming / Pływanie / {{count}} / <slot0/> — Żółć 🌊';
    entry.labels = ['Travel', 'Pływanie'];
    entry.trainingStatus = 'trained';
    entry.workouts = [
      {
        id: crypto.randomUUID(),
        type: 'underwater_hockey',
        title: 'Swimming',
        durationMinutes: 45,
        distanceKm: null,
        effort: 6,
        pain: null,
        averageHeartRate: null,
        sets: [],
        notes: 'Schwimmen: moja notatka',
      },
    ];
    const original = entrySchema.parse(entry);
    for (const language of languages) {
      await i18n.changeLanguage(language);
      const restored = mergeImported(
        parseImport(JSON.stringify({ entries: [original] }), 'json')[0],
      );
      expect(restored).toEqual(original);
      expect(localize('Context: Swimming')).toContain('Swimming');
      expect(localize('Activity: swimming')).not.toContain('activities:');
      expect(localize('Symptom: sore throat')).not.toContain('enums:');
    }
    await i18n.changeLanguage('pl');
    expect(localize('Activity: swimming')).toBe('Aktywność: Pływanie');
    expect(
      summarize({
        ...original,
        revision: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }).workoutTypes,
    ).toEqual(['underwater_hockey']);
  });
  it('uses plural categories instead of English suffixes and formats numeric values by language', async () => {
    await i18n.changeLanguage('pl');
    expect(t('relationships:calendarDayLater', { count: 1 })).toBe('1 dzień kalendarzowy później');
    expect(t('relationships:calendarDayLater', { count: 3 })).toBe('3 dni kalendarzowe później');
    expect(t('relationships:calendarDayLater', { count: 7 })).toBe('7 dni kalendarzowych później');
    expect(new Intl.NumberFormat(locale()).format(1.5)).toBe('1,5');
    expect(parseLanguage('browser')).toBe('auto');
    expect(parseLanguage('de')).toBe('de');
  });
  it('localizes API, model and nested validation errors with their limits and field names', async () => {
    await i18n.changeLanguage('pl');
    expect(errorText('Sign in to access your journal.')).toBe(
      'Zaloguj się, aby otworzyć dziennik.',
    );
    expect(
      localize(
        '12 complete observations; at least 30 required for 4 coefficients. This is a display threshold, not a guarantee of reliability.',
      ),
    ).toContain('wymagane co najmniej 30');
    expect(
      localize(
        'Temporal validation needs 30 complete training rows and 7 later rows, with a 3-day separation. Current: 15 training / 2 later rows.',
      ),
    ).not.toContain('Temporal validation');
    expect(fieldName('entry.workouts.0.type')).toBe('Aktywność');
    const invalid = entrySchema.safeParse({ ...emptyEntry('2026-01-01'), wellbeing: 22 });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const message = errorText('Observation 1: ' + JSON.stringify(invalid.error.issues));
      expect(message).toContain('Samopoczucie');
      expect(message).toContain('10');
      expect(message).not.toContain('too_big');
    }
    expect(errorText('checkIn:chooseAValidJournalDate')).not.toContain('checkIn:');
    expect(() => parseImport('{bad}', 'json')).toThrow('Invalid JSON.');
  });
});

it('formats numeric intervals with explicit spacing in every supported language', async () => {
  for (const language of languages) {
    await i18n.changeLanguage(language);
    const range = numberRange([0.46, 0.7]);
    expect(range).toContain(' – ');
    expect(range).not.toMatch(/\d(?:to|do|bis|a|à)\d/);
    expect(numberRange([-0.4, 0])).toContain(' – 0');
  }
  await i18n.changeLanguage('pl');
  expect(numberRange([0.46, 0.7])).toBe('0,46 – 0,7');
});
