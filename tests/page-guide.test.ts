import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  guideFor,
  guideIds,
  guideTipCount,
  parseHiddenGuides,
  setGuideHidden,
} from '../src/lib/page-guide';

describe('page guide routing', () => {
  it('maps workspace paths to their guide', () => {
    expect(guideFor('/')).toBe('overview');
    expect(guideFor('')).toBe('overview');
    expect(guideFor('/check-in')).toBe('checkIn');
    expect(guideFor('/check-in/')).toBe('checkIn');
    expect(guideFor('/journal')).toBe('journal');
    expect(guideFor('/analysis')).toBe('analysis');
    expect(guideFor('/analysis/relationships')).toBe('analysis');
    expect(guideFor('/export')).toBe('data');
    expect(guideFor('/import')).toBe('data');
  });
  it('has no guide for unrelated or look-alike paths', () => {
    for (const path of ['/account', '/privacy', '/help', '/admin', '/analysisx', '/exports'])
      expect(guideFor(path), path).toBeNull();
  });
});

describe('stored guide dismissal', () => {
  it('accepts only known guide identifiers, once, in canonical order', () => {
    expect(parseHiddenGuides(JSON.stringify(['data', 'checkIn', 'data', 'unknown', 3]))).toEqual([
      'checkIn',
      'data',
    ]);
  });
  it('falls back to an empty list for missing or malformed storage', () => {
    for (const raw of [null, '', 'not json', '{"checkIn":true}', '"checkIn"', 'null'])
      expect(parseHiddenGuides(raw), String(raw)).toEqual([]);
  });
  it('hides and restores a single guide without affecting others', () => {
    const hidden = setGuideHidden(['journal'], 'checkIn', true);
    expect(hidden).toEqual(['checkIn', 'journal']);
    expect(setGuideHidden(hidden, 'checkIn', true)).toEqual(['checkIn', 'journal']);
    expect(setGuideHidden(hidden, 'checkIn', false)).toEqual(['journal']);
    expect(setGuideHidden([], 'data', false)).toEqual([]);
  });
});

it('every guide has a title and each numbered tip in the English catalog, and no extras', () => {
  const messages = JSON.parse(
    fs.readFileSync(path.resolve('src/locales/en/guide.json'), 'utf8'),
  ) as Record<string, string>;
  const expected = new Set(['eyebrow', 'show', 'hide', 'demoNote']);
  for (const id of guideIds) {
    expected.add(`${id}_title`);
    for (let i = 1; i <= guideTipCount[id]; i++) expected.add(`${id}_${i}`);
  }
  expect(Object.keys(messages).sort()).toEqual([...expected].sort());
  for (const value of Object.values(messages)) expect(value.trim()).not.toBe('');
});
