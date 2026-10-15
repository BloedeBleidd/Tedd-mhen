import { t } from '../i18n';
export function invalidField(form: HTMLFormElement) {
  for (const element of Array.from(form.elements) as unknown[]) {
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ))
      continue;
    const control = element;
    if (!control.willValidate || control.validity.valid) continue;
    const label =
      control.getAttribute('aria-label') ||
      control.labels?.[0]?.querySelector('span')?.textContent ||
      t('validation:field');
    const validity = control.validity;
    const detail = validity.valueMissing
      ? t('validation:required')
      : validity.rangeUnderflow && control instanceof HTMLInputElement
        ? t('validation:minNumber', { limit: control.min })
        : validity.rangeOverflow && control instanceof HTMLInputElement
          ? t('validation:maxNumber', { limit: control.max })
          : validity.stepMismatch
            ? t('validation:step')
            : validity.tooShort && 'minLength' in control
              ? t('validation:minLength', { limit: control.minLength })
              : validity.tooLong && 'maxLength' in control
                ? t('validation:maxLength', { limit: control.maxLength })
                : validity.badInput
                  ? t('validation:number')
                  : t('validation:invalid');
    const message = `${label}: ${detail}`;
    control.setAttribute('aria-invalid', 'true');
    control.addEventListener('input', () => control.removeAttribute('aria-invalid'), {
      once: true,
    });
    control.closest('details')?.setAttribute('open', '');
    control.focus();
    control.scrollIntoView({ block: 'center', behavior: 'instant' });
    return message;
  }
  return null;
}
