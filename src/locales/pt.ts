const files = import.meta.glob('./pt/*.json', { eager: true, import: 'default' });
export default Object.fromEntries(
  Object.entries(files).map(([path, messages]) => [path.split('/').at(-1)!.slice(0, -5), messages]),
) as Record<string, Record<string, string>>;
