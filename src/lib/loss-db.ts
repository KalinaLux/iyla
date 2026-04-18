import Dexie, { type EntityTable } from 'dexie';

export type LossType =
  | 'chemical'
  | 'early_miscarriage'
  | 'late_miscarriage'
  | 'ectopic'
  | 'molar'
  | 'stillbirth'
  | 'other';

export type Intervention = 'natural' | 'dnc' | 'medication' | 'surgical' | 'other';

export type BleedingLevel = 'none' | 'light' | 'moderate' | 'heavy';

export type EmotionWord =
  | 'numb'
  | 'sad'
  | 'angry'
  | 'hopeful'
  | 'scared'
  | 'relieved'
  | 'confused'
  | 'exhausted'
  | 'okay';

export interface StoredLossEvent {
  id?: number;
  date: string;
  type: LossType;
  gestationalWeeks: number;
  gestationalDays: number;
  intervention: Intervention;
  provider: string;
  notes: string;
}

export interface StoredDailyLog {
  id?: number;
  date: string;
  bleeding: BleedingLevel;
  pain: number;
  temperature: string;
  emotions: EmotionWord[];
}

export interface StoredHCGReading {
  id?: number;
  date: string;
  value: number;
}

export interface StoredPeriodInfo {
  id?: number;
  returned: boolean;
  date: string;
}

export const lossDb = new Dexie('IylaLossDB') as Dexie & {
  events: EntityTable<StoredLossEvent, 'id'>;
  dailyLogs: EntityTable<StoredDailyLog, 'id'>;
  hcgReadings: EntityTable<StoredHCGReading, 'id'>;
  periodInfo: EntityTable<StoredPeriodInfo, 'id'>;
};

lossDb.version(1).stores({
  events: '++id, date, type',
  dailyLogs: '++id, &date',
  hcgReadings: '++id, date',
  periodInfo: '++id',
});

export async function getLossEvent(): Promise<StoredLossEvent | null> {
  const all = await lossDb.events.toArray();
  return all[0] ?? null;
}

export async function saveLossEvent(
  event: Omit<StoredLossEvent, 'id'>,
): Promise<void> {
  const existing = await lossDb.events.toArray();
  if (existing[0]?.id != null) {
    await lossDb.events.update(existing[0].id, event);
  } else {
    await lossDb.events.add(event);
  }
}

export async function upsertDailyLog(
  log: Omit<StoredDailyLog, 'id'>,
): Promise<void> {
  await lossDb.dailyLogs.where('date').equals(log.date).delete();
  await lossDb.dailyLogs.add(log);
}

export async function addHCGReading(
  reading: Omit<StoredHCGReading, 'id'>,
): Promise<void> {
  await lossDb.hcgReadings.add(reading);
}

export async function savePeriodInfo(
  info: Omit<StoredPeriodInfo, 'id'>,
): Promise<void> {
  const existing = await lossDb.periodInfo.toArray();
  if (existing[0]?.id != null) {
    await lossDb.periodInfo.update(existing[0].id, info);
  } else {
    await lossDb.periodInfo.add(info);
  }
}
