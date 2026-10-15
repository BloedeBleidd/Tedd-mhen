import { demoFixture, makeDemoFixture } from './demo-fixture.mjs';

export function withDemoHabits(rows = makeDemoFixture()) {
  return rows.map((row, i) => {
    const habit = (id, count, times = [], durationMinutes = null) => ({
      key: `preset:${id}`,
      name: null,
      count,
      times,
      durationMinutes,
      notes: '',
    });
    const reading = i % 4 !== 0 && !row.labels?.includes('travel');
    const bites = Math.max(0, Math.round((row.stress ?? 0) * 1.4 + (i % 3) - 3));
    const habits =
      i % 19 === 0
        ? []
        : [
            habit(
              'reading_before_bed',
              reading ? 1 : 0,
              reading ? ['21:30'] : [],
              reading ? 15 + (i % 4) * 5 : 0,
            ),
            habit('screen_free_before_bed', reading ? 1 : 0, [], reading ? 45 : 0),
            habit(
              'morning_daylight',
              i % 5 === 0 ? 0 : 1,
              i % 5 === 0 ? [] : ['07:20'],
              i % 5 === 0 ? 0 : 10 + (i % 4) * 5,
            ),
            habit('caffeine', 1 + (i % 3), ['08:00', '11:30', '14:00'].slice(0, 1 + (i % 3))),
            habit('nail_biting', i % 17 === 0 ? null : bites, bites ? ['10:15'] : []),
            habit(
              'cold_shower_morning',
              i % 3 === 0 ? 1 : 0,
              i % 3 === 0 ? ['07:00'] : [],
              i % 3 === 0 ? 2 : 0,
            ),
            {
              key: 'custom:00000000-0000-4000-8000-000000000001',
              name: 'Phone-free dinner',
              count: i % 4 === 0 ? 0 : 1,
              times: i % 4 === 0 ? [] : ['19:00'],
              durationMinutes: i % 4 === 0 ? 0 : 30,
              notes:
                'Synthetic custom activity: this original name and note stay unchanged when the interface language changes.',
            },
          ];
    return { ...row, habits };
  });
}

export function demoHabitsMigration() {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  return (
    '-- Extend only the synthetic demo journal; retain its immutable baseline guards.\nDROP TRIGGER protect_demo_update;\n' +
    withDemoHabits()
      .map(
        (row) =>
          `UPDATE entries SET data=json_set(data,'$.habits',json(${quote(JSON.stringify(row.habits))})) WHERE owner_id=${quote(demoFixture.owner)} AND date=${quote(row.date)};`,
      )
      .join('\n') +
    "\nCREATE TRIGGER protect_demo_update BEFORE UPDATE ON entries WHEN OLD.owner_id IN (SELECT owner_id FROM demo_datasets) OR NEW.owner_id IN (SELECT owner_id FROM demo_datasets) BEGIN SELECT RAISE(ABORT, 'Shared demo records are immutable'); END;\n"
  );
}
