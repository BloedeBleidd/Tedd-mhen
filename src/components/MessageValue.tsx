import type { ReactNode } from 'react';

// Trans can replace falsy component children. Keep values (including zero) in a dedicated prop.
export function MessageValue({ value }: { value: ReactNode }) {
  return <>{value}</>;
}
