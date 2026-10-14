import { emptyEntry, localDate, shiftDate, type StoredEntry } from '../../shared/schema';
export function makeDemo(): StoredEntry[] {
  return Array.from({ length: 90 }, (_, i) => {
    const date = shiftDate(localDate(), i - 89),
      entry = emptyEntry(date);
    const wave = Math.sin(i * 1.7) * 0.8 + Math.cos(i * 0.4) * 0.5;
    entry.wellbeing = Math.max(1, Math.min(10, Math.round(6.1 + i * 0.02 + wave)));
    entry.energy = Math.round(6.5 + Math.sin(i) * 1.5);
    entry.motivation = 7;
    entry.fatigue = Math.round(3.5 + Math.cos(i) * 1.5);
    entry.stress = Math.round(3 + Math.sin(i * 0.5));
    entry.soreness = i % 3 === 0 ? 5 : 2;
    entry.illnessSeverity = i === 29 || i === 30 ? 3 : 0;
    if (entry.illnessSeverity) entry.symptoms = [{ name: 'sore_throat', severity: 3 }];
    entry.sleep = {
      durationMinutes: Math.round(414 + i * 0.55 + wave * 22),
      bedtime: '23:00',
      wakeTime: '07:00',
      latencyMinutes: 15,
      awakenings: 1,
      score: Math.round(73 + i * 0.1 + wave * 5),
      quality: 7,
    };
    entry.physiology = {
      hrv: Math.round(48 + i * 0.13 + wave * 8),
      hrvMethod: 'rmssd',
      restingHeartRate: Math.round(57 - i * 0.03 + wave * 2),
      respiratoryRate: 14.5,
      temperatureC: null,
      weightKg: null,
      source: 'manual',
    };
    entry.trainingStatus = i % 3 === 1 ? 'rest' : 'trained';
    if (entry.trainingStatus === 'trained')
      entry.workouts = [
        {
          id: crypto.randomUUID(),
          type: i % 3 === 0 ? 'running' : 'strength',
          title: i % 3 === 0 ? 'Easy morning run' : 'Full-body strength',
          durationMinutes: i % 3 === 0 ? 45 : 60,
          distanceKm: i % 3 === 0 ? 7.2 : null,
          effort: i % 3 === 0 ? 4 : 6,
          pain: 0,
          averageHeartRate: i % 3 === 0 ? 138 : null,
          sets: [],
          notes: '',
        },
      ];
    entry.labels = i % 5 === 0 ? ['late meal'] : i % 7 === 0 ? ['travel'] : [];
    entry.notes = 'Synthetic demonstration record. Not a real health observation.';
    // Deliberate missing observations demonstrate missingness handling.
    if (i % 17 === 0) entry.physiology.hrv = null;
    return {
      ...entry,
      revision: 1,
      createdAt: `${date}T18:00:00.000Z`,
      updatedAt: `${date}T18:00:00.000Z`,
    };
  });
}
