import { describe, expect, it } from 'vitest';
import { workspaceDestination } from '../src/lib/workspace-path';

describe('Demo navigation', () => {
  it('preserves workspace routes, query parameters and fragments under the demo prefix', () => {
    expect(workspaceDestination('/', true)).toBe('/demo');
    expect(workspaceDestination('/check-in?date=2026-10-01#sleep', true)).toBe(
      '/demo/check-in?date=2026-10-01#sleep',
    );
    expect(workspaceDestination('/analysis/relationships', true)).toBe(
      '/demo/analysis/relationships',
    );
    expect(
      workspaceDestination({ pathname: '/journal', search: '?q=travel', hash: '#entries' }, true),
    ).toEqual({ pathname: '/demo/journal', search: '?q=travel', hash: '#entries' });
    expect(workspaceDestination({ search: '?q=travel' }, true)).toEqual({ search: '?q=travel' });
  });
  it('leaves account access, explicit demo paths, relative links and external URLs intact', () => {
    for (const path of [
      '/sign-in',
      '/register',
      '/recover',
      '/register?source=demo',
      '/demo',
      '/demo/analysis',
      'relationships',
      '#main',
      '?q=run',
      'https://example.test',
      '//example.test',
    ])
      expect(workspaceDestination(path, true)).toBe(path);
    expect(workspaceDestination('/demography', true)).toBe('/demo/demography');
    expect(workspaceDestination('/journal?from=2026-10-01', false)).toBe(
      '/journal?from=2026-10-01',
    );
  });
});
