export const demoFixture = {
  id: 'training-recovery-v1',
  owner: 'system-demo-v1',
  email: 'demo@teddmhen.invalid',
  title: 'A season of training and recovery',
  anchorDate: '2026-10-01',
  calendarDays: 240,
};

export function makeDemoFixture() {
  let state = 20261015;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const noise = (range) => (random() - 0.5) * range;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const rating = (value, low = 1) => Math.round(clamp(value, low, 10));
  const decimal = (value) => Math.round(value * 10) / 10;
  const clock = (minutes) => {
    const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const rows = [];
  let previousLoad = 0;
  for (let i = 0; i < demoFixture.calendarDays; i++) {
    const date = new Date(`${demoFixture.anchorDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i - demoFixture.calendarDays + 1);
    const day = date.toISOString().slice(0, 10);
    const travel = i % 31 >= 27;
    const lateMeal = i % 9 === 2 || i % 13 === 4;
    const outdoor = i % 7 === 0 || i % 7 === 5;
    const workDeadline = i % 23 >= 19;
    const illness = (i >= 64 && i <= 69) || (i >= 151 && i <= 155) || (i >= 216 && i <= 220);
    const deload = Math.floor(i / 21) % 4 === 3;
    const stress = rating(2.6 + (workDeadline ? 3 : 0) + (travel ? 1.5 : 0) + noise(2.5), 0);
    const illnessSeverity = illness ? 3 + (i % 2) : 0;
    const latency = Math.round(clamp(11 + stress * 2 + (lateMeal ? 10 : 0) + noise(10), 4, 80));
    const awakenings = Math.max(0, Math.round(0.6 + (illness ? 1.5 : 0) + noise(1.8)));
    const sleepMinutes = Math.round(
      clamp(
        470 -
          stress * 8 -
          (lateMeal ? 30 : 0) -
          (travel ? 35 : 0) -
          (illness ? 25 : 0) +
          i * 0.09 +
          noise(55),
        270,
        550,
      ),
    );
    const bedtime = 22 * 60 + 35 + stress * 5 + (lateMeal ? 40 : 0) + (travel ? 30 : 0) + noise(30);
    const hrv = decimal(
      clamp(
        48 +
          (sleepMinutes - 420) * 0.12 -
          previousLoad * 0.012 -
          illnessSeverity * 3 +
          i * 0.045 +
          noise(12),
        20,
        100,
      ),
    );
    const wellbeing = rating(
      6.5 +
        (sleepMinutes - 420) / 90 -
        stress * 0.16 -
        illnessSeverity * 0.65 -
        previousLoad / 1500 +
        (outdoor ? 0.6 : 0) +
        i * 0.003 +
        noise(1.8),
    );
    const workouts = [];
    function addWorkout(type, title, minutes, effort, distance = null, sets = []) {
      workouts.push({
        id: `00000000-0000-4000-8000-${String(i * 10 + workouts.length + 1).padStart(12, '0')}`,
        type,
        title,
        durationMinutes: minutes,
        distanceKm: distance,
        effort,
        pain: i % 19 === 0 ? 2 : 0,
        averageHeartRate: type === 'running' ? 124 + effort * 5 : type === 'cycling' ? 125 : null,
        sets,
        notes: `Synthetic example: ${title.toLowerCase()}. Use this session to explore the training fields.`,
      });
    }
    if (!illness && i % 7 !== 3) {
      const factor = deload ? 0.7 : 1;
      if (i % 7 === 0)
        addWorkout(
          'running',
          'Long easy run',
          Math.round((70 + i * 0.12) * factor),
          4,
          decimal((11 + i * 0.019) * factor),
        );
      else if (i % 7 === 1 || i % 7 === 4) {
        const load = Math.round(((70 + i / 18) * factor) / 2.5) * 2.5;
        addWorkout(
          'strength',
          i % 7 === 1 ? 'Squat and press' : 'Deadlift and upper body',
          deload ? 40 : 60,
          deload ? 4 : 7,
          null,
          [
            {
              exercise: i % 7 === 1 ? 'Back squat' : 'Deadlift',
              sets: deload ? 2 : 4,
              reps: 5,
              weightKg: load + (i % 7 === 4 ? 30 : 0),
            },
            { exercise: 'Bench press', sets: 3, reps: 6, weightKg: load - 20 },
            { exercise: 'Dumbbell row', sets: 3, reps: 10, weightKg: 24 },
          ],
        );
      } else if (i % 7 === 2) addWorkout('running', 'Easy recovery run', 35, 3, 5.6);
      else if (i % 7 === 5)
        addWorkout(
          'running',
          deload ? 'Steady easy run' : 'Controlled intervals',
          deload ? 35 : 50,
          deload ? 4 : 8,
          deload ? 5.8 : 8.2,
        );
      else addWorkout('cycling', 'Easy cycling', 45, 3, 17);
      if (i % 11 === 0) addWorkout('mobility', 'Evening mobility', 15, 2);
      if (i % 29 === 8) addWorkout('walking', 'Lunch walk', 25, 2, 2);
      if (i % 47 === 9) addWorkout('swimming', 'Relaxed pool session', 25, 3, 0.8);
    }
    const labels = [
      ...(lateMeal ? ['late meal'] : []),
      ...(travel ? ['travel'] : []),
      ...(workDeadline ? ['work deadline'] : []),
      ...(outdoor ? ['outdoor time'] : []),
      ...(deload ? ['deload'] : []),
      ...(i % 4 === 0 ? ['evening screen time'] : []),
    ];
    const row = {
      schemaVersion: 1,
      date: day,
      timezone: 'UTC',
      wellbeing,
      energy: rating(6.5 + (sleepMinutes - 420) / 65 - illnessSeverity * 0.6 + noise(2)),
      motivation: rating(7.5 - stress * 0.2 - illnessSeverity * 0.4 + noise(2)),
      fatigue: rating(
        3 + previousLoad / 150 - (sleepMinutes - 420) / 70 + illnessSeverity * 0.5 + noise(1.8),
        0,
      ),
      stress,
      soreness: rating(1.5 + previousLoad / 160 + noise(1.5), 0),
      illnessSeverity,
      labels: i % 41 === 6 ? null : labels,
      symptoms: illness
        ? [
            { name: 'sore_throat', severity: illnessSeverity },
            { name: 'congestion', severity: 2 },
          ]
        : [],
      sleep: {
        durationMinutes: sleepMinutes,
        bedtime: clock(bedtime),
        wakeTime: clock(bedtime + sleepMinutes + latency + awakenings * 8),
        latencyMinutes: latency,
        awakenings,
        score: Math.round(
          clamp(
            80 + (sleepMinutes - 420) * 0.16 - latency * 0.2 - illnessSeverity * 2 + noise(9),
            20,
            99,
          ),
        ),
        quality: rating(7 + (sleepMinutes - 420) / 70 - illnessSeverity * 0.4 + noise(1.5)),
      },
      physiology: {
        hrv: i % 29 === 5 ? null : hrv,
        hrvMethod: 'rmssd',
        restingHeartRate: Math.round(
          58 - i * 0.018 - (sleepMinutes - 420) * 0.025 + illnessSeverity * 1.8 + noise(4),
        ),
        respiratoryRate: decimal(14.1 + illnessSeverity * 0.5 + noise(1.2)),
        temperatureC: decimal(36.5 + illnessSeverity * 0.18 + noise(0.3)),
        weightKg: i % 17 === 7 ? null : decimal(82 - i * 0.009 + noise(1)),
        source: i % 11 === 6 ? 'manual' : 'garmin',
      },
      trainingStatus: workouts.length ? 'trained' : 'rest',
      workouts,
      notes: `Synthetic demonstration only. ${illness ? 'Recovery week with lighter activity.' : deload ? 'Planned deload: reduced training volume.' : outdoor ? 'Outdoor session and a quieter evening.' : 'Regular training and recovery check-in.'} These patterns were constructed to demonstrate the interface, not to represent a real person or evidence of health effects.`,
      sleepNotes: lateMeal
        ? 'Example context: a later meal and later bedtime.'
        : travel
          ? 'Example context: an unfamiliar sleeping environment.'
          : '',
      illnessNotes: illness
        ? 'Synthetic symptoms for exploring illness filters and recovery patterns.'
        : '',
    };
    previousLoad = workouts.reduce((sum, w) => sum + w.durationMinutes * w.effort, 0);
    if (i === 110 || i === 181) {
      row.trainingStatus = 'unrecorded';
      row.workouts = [];
    }
    if (i === 42 || i === 162) row.sleep.durationMinutes = null;
    if (![37, 91, 134, 177].includes(i)) rows.push(row);
  }
  return rows;
}

export function demoMigration() {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const rows = makeDemoFixture();
  return (
    `-- Synthetic shared example journal. No credentials or real observations.\nCREATE TABLE demo_datasets (\n  id TEXT PRIMARY KEY,\n  owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),\n  title TEXT NOT NULL,\n  anchor_date TEXT NOT NULL,\n  record_count INTEGER NOT NULL CHECK(record_count > 0)\n);\nINSERT INTO users(id,email) VALUES (${quote(demoFixture.owner)},${quote(demoFixture.email)});\n` +
    rows
      .map(
        (row) =>
          `INSERT INTO entries(owner_id,date,data,created_at,updated_at) VALUES (${quote(demoFixture.owner)},${quote(row.date)},${quote(JSON.stringify(row))},${quote(row.date + 'T18:00:00.000Z')},${quote(row.date + 'T18:00:00.000Z')});`,
      )
      .join('\n') +
    `\nINSERT INTO demo_datasets VALUES (${quote(demoFixture.id)},${quote(demoFixture.owner)},${quote(demoFixture.title)},${quote(demoFixture.anchorDate)},${rows.length});\n` +
    [
      ['INSERT', 'NEW.owner_id'],
      ['UPDATE', 'OLD.owner_id'],
      ['DELETE', 'OLD.owner_id'],
    ]
      .map(
        ([operation, owner]) =>
          `CREATE TRIGGER protect_demo_${operation.toLowerCase()} BEFORE ${operation} ON entries WHEN ${owner} IN (SELECT owner_id FROM demo_datasets)${operation === 'UPDATE' ? ' OR NEW.owner_id IN (SELECT owner_id FROM demo_datasets)' : ''} BEGIN SELECT RAISE(ABORT, 'Shared demo records are immutable'); END;`,
      )
      .join('\n') +
    `\nCREATE TRIGGER prevent_demo_login BEFORE INSERT ON auth_accounts WHEN NEW.user_id IN (SELECT owner_id FROM demo_datasets) BEGIN SELECT RAISE(ABORT, 'Demo owners cannot sign in'); END;\nCREATE TRIGGER prevent_demo_login_update BEFORE UPDATE OF user_id ON auth_accounts WHEN NEW.user_id IN (SELECT owner_id FROM demo_datasets) BEGIN SELECT RAISE(ABORT, 'Demo owners cannot sign in'); END;\n`
  );
}
