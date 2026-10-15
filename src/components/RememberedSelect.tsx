import { Children, isValidElement, type SelectHTMLAttributes } from 'react';
import type { ChoiceList } from '../../shared/preferences';
import { usePreferences } from '../lib/preferences-context';

/** Sort semantic options; sentinel choices stay first. Numeric ranges keep their natural order. */
export function RememberedSelect({
  list,
  children,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { list: ChoiceList }) {
  const { rank, remember } = usePreferences();
  const options = Children.toArray(children);
  const value = (node: (typeof options)[number]) =>
    isValidElement<{ value?: string }>(node) ? String(node.props.value ?? '') : '';
  const sentinel = (node: (typeof options)[number]) => ['', 'all'].includes(value(node));
  return (
    <select
      {...props}
      onChange={(event) => {
        if (!['', 'all'].includes(event.target.value)) remember(list, event.target.value);
        onChange?.(event);
      }}
    >
      {options.filter(sentinel)}
      {rank(
        options.filter((node) => !sentinel(node)),
        list,
        value,
      )}
    </select>
  );
}
