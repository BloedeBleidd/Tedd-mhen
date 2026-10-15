import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { workoutTypes, supportsSets } from '../shared/activities';
import { emptyEntry, entrySchema } from '../shared/schema';
const root = path.resolve('src/locales');
const languages = ['en', 'pl', 'es', 'de', 'fr', 'pt'];
const files = fs.readdirSync(path.join(root, 'en')).filter((file) => file.endsWith('.json'));
const read = (language: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(root, language, file), 'utf8')) as Record<string, string>;
const tokens = (value: string) =>
  [...value.matchAll(/\{\{\w+\}\}|<\/?slot\d+\s*\/?>/g)].map((match) => match[0]).sort();

describe('Source-controlled translations', () => {
  for (const language of languages.slice(1))
    it(`${language} has every namespace, key and interpolation slot`, () => {
      for (const file of files) {
        const source = read('en', file),
          translated = read(language, file);
        expect(Object.keys(translated).sort(), `${language}/${file}`).toEqual(
          Object.keys(source).sort(),
        );
        for (const [key, value] of Object.entries(source)) {
          expect(typeof translated[key], `${language}/${file}:${key}`).toBe('string');
          expect(tokens(translated[key]), `${language}/${file}:${key}`).toEqual(tokens(value));
        }
      }
    });
  it('every activity has six labels and a stable machine identifier', () => {
    expect(workoutTypes.length).toBeGreaterThan(100);
    expect(new Set(workoutTypes).size).toBe(workoutTypes.length);
    for (const language of languages)
      expect(Object.keys(read(language, 'activities.json')).sort()).toEqual(
        [...workoutTypes].sort(),
      );
    for (const type of workoutTypes) {
      const entry = emptyEntry('2026-01-01');
      entry.trainingStatus = 'trained';
      entry.workouts = [
        {
          id: crypto.randomUUID(),
          type,
          title: 'Swimming / Pływanie',
          notes: 'Żółć — natação — Schwimmen 🌊',
          durationMinutes: 30,
          distanceKm: null,
          effort: 5,
          pain: null,
          averageHeartRate: null,
          sets: [],
        },
      ];
      const parsed = entrySchema.parse(entry);
      expect(parsed.workouts[0]).toEqual(entry.workouts[0]);
      expect(type).toMatch(/^[a-z_]+$/);
    }
    expect(supportsSets('powerlifting')).toBe(true);
    expect(supportsSets('swimming')).toBe(false);
  });
});

it('UI calls reference real keys, rich messages use Trans, and JSX copy cannot bypass the catalogs', async () => {
  const ts = await import('typescript');
  const source = Object.fromEntries(
    files.map((file) => [file.replace('.json', ''), read('en', file)]),
  );
  const sourceFiles = fs
    .readdirSync('src', { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !file.startsWith('locales/'));
  for (const file of sourceFiles) {
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(path.join('src', file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const exists = (key: string) => {
      const [namespace, id] = key.split(':');
      return source[namespace]?.[id] ?? source[namespace]?.[id + '_other'];
    };
    function visit(node: import('typescript').Node) {
      if (
        ts.isCallExpression(node) &&
        ['t', 'tr'].includes(node.expression.getText(ast)) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        expect(exists(key), `${file}: ${key}`).toBeDefined();
        expect(exists(key), `${file}: render rich copy with Trans: ${key}`).not.toContain('<slot');
      }
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(ast) === 'i18nKey' &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      )
        expect(exists(node.initializer.text), `${file}: ${node.initializer.text}`).toBeDefined();
      if (ts.isJsxText(node) && /[a-zA-Z]{2}/.test(node.text)) {
        expect(['UTC', 'teddmhen.language.v1'], `${file}: uncatalogued copy`).toContain(
          node.text.trim(),
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
