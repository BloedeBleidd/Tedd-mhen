/** Accent-insensitive matching without altering stored user text or activity identifiers. */
export function searchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('ł', 'l')
    .replaceAll('ß', 'ss')
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll('_', ' ')
    .trim();
}
