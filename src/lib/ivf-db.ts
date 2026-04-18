import Dexie, { type EntityTable } from 'dexie';
import type {
  IVFCycle,
  IVFCycleStatus,
  StimDay,
  StimMedication,
  EggRetrievalOutcome,
  EmbryoGrade,
  BetaHCG,
} from './ivf-types';

// Stored medication wraps a StimMedication with a DB primary key and
// a reference to the owning cycle so we can persist the schedule list.
export interface StoredIVFMedication extends StimMedication {
  id?: number;
  cycleId: string;
}

export interface StoredCheckedMed {
  id?: number;
  cycleId: string;
  medKey: string;
}

export const ivfDb = new Dexie('IylaIVFDB') as Dexie & {
  cycles: EntityTable<IVFCycle, 'id'>;
  medications: EntityTable<StoredIVFMedication, 'id'>;
  checkedMeds: EntityTable<StoredCheckedMed, 'id'>;
  stimDays: EntityTable<StimDay, 'id'>;
  retrievals: EntityTable<EggRetrievalOutcome, 'id'>;
  embryos: EntityTable<EmbryoGrade, 'id'>;
  betas: EntityTable<BetaHCG, 'id'>;
};

ivfDb.version(1).stores({
  cycles: 'id, startDate, status, protocol',
  medications: '++id, cycleId',
  checkedMeds: '++id, cycleId, medKey',
  stimDays: 'id, ivfCycleId, dayNumber, date',
  retrievals: 'id, ivfCycleId, date',
  embryos: 'id, ivfCycleId, embryoNumber',
  betas: 'id, ivfCycleId, date, dpt',
});

export async function getActiveIVFCycle(): Promise<IVFCycle | null> {
  const all = await ivfDb.cycles.toArray();
  return all[0] ?? null;
}

export async function updateIVFCycleStatus(
  cycleId: string,
  status: IVFCycleStatus,
): Promise<void> {
  await ivfDb.cycles.update(cycleId, { status });
}

export async function addIVFMedication(
  cycleId: string,
  med: StimMedication,
): Promise<void> {
  await ivfDb.medications.add({ ...med, cycleId });
}

export async function removeIVFMedication(id: number): Promise<void> {
  await ivfDb.medications.delete(id);
  await ivfDb.checkedMeds.where('medKey').equals(String(id)).delete();
}

export async function toggleCheckedMed(
  cycleId: string,
  medKey: string,
): Promise<void> {
  const existing = await ivfDb.checkedMeds
    .where({ cycleId, medKey })
    .first();
  if (existing?.id != null) {
    await ivfDb.checkedMeds.delete(existing.id);
  } else {
    await ivfDb.checkedMeds.add({ cycleId, medKey });
  }
}
