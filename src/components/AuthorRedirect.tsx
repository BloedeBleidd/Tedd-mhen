import { useEffect } from 'react';
import { useAppearance } from '../lib/appearance-context';
import { useLanguage } from '../lib/language-context';
import { resolveAuthorUrl } from '../lib/author';

export function AuthorRedirect() {
  const { mode } = useLanguage();
  const { settings } = useAppearance();
  useEffect(() => {
    let active = true;
    void resolveAuthorUrl(mode, settings.location).then((url) => {
      if (active) window.location.replace(url);
    });
    return () => {
      active = false;
    };
  }, [mode, settings.location]);
  return null;
}
