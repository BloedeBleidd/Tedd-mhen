import type { HabitRecord } from '../../shared/habits';
export const customHabit: HabitRecord = {
  key: 'custom:00000000-0000-4000-8000-000000000042',
  name: 'Mój rytuał {{count}} <test>',
  count: 2,
  times: ['23:50', '00:10'],
  durationMinutes: 15,
  notes: 'Oryginalny tekst\nbez tłumaczenia "é"',
};
