import { describe, expect, it } from 'vitest';
import { authorUrl, resolveAuthorUrl } from '../src/lib/author';

const poland = { latitude: 52.23, longitude: 21.01, capturedAt: '2026-10-19T12:00:00Z' };

describe('author portfolio destination', () => {
  it.each(['en', 'pl', 'es', 'de', 'fr', 'pt'] as const)(
    'uses Polish only for the Polish interface (%s)',
    (language) => {
      expect(authorUrl(language)).toBe(
        language === 'pl'
          ? 'https://piotrzmudadev.com/o-mnie/'
          : 'https://piotrzmudadev.com/en/about/',
      );
    },
  );

  it('honors a manual choice before translations load and regardless of saved location', async () => {
    expect(await resolveAuthorUrl('pl', null)).toBe('https://piotrzmudadev.com/o-mnie/');
    expect(await resolveAuthorUrl('en', poland)).toBe('https://piotrzmudadev.com/en/about/');
  });

  it('resolves automatic mode from saved location with an English fallback', async () => {
    expect(await resolveAuthorUrl('auto', poland)).toBe('https://piotrzmudadev.com/o-mnie/');
    expect(await resolveAuthorUrl('auto', null)).toBe('https://piotrzmudadev.com/en/about/');
    expect(await resolveAuthorUrl('auto', { ...poland, latitude: 0, longitude: 0 })).toBe(
      'https://piotrzmudadev.com/en/about/',
    );
  });
});
