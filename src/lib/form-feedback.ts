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
      'This field';
    const message = `${label}: ${control.validationMessage}`;
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
