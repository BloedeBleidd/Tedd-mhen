import type { To } from 'react-router-dom';

export function workspaceDestination(to: To, demo: boolean): To {
  const prefix = (path: string) =>
    demo &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/^\/(demo|sign-in|register|recover)(\/|\?|#|$)/.test(path)
      ? `/demo${path === '/' ? '' : path}`
      : path;
  return typeof to === 'string'
    ? prefix(to)
    : { ...to, pathname: to.pathname && prefix(to.pathname) };
}
