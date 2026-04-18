import Dexie, { type Table } from 'dexie';

export type MedicationFormulation =
  | 'pill'
  | 'capsule'
  | 'tablet'
  | 'injection'
  | 'vaginal_suppository'
  | 'cream'
  | 'patch'
  | 'liquid'
  | 'other';

export type PregnancyCategory = 'A' | 'B' | 'C' | 'D' | 'X' | 'unknown';

export interface Medication {
  id?: number;
  name: string;
  genericName?: string;
  dose: string;
  formulation: MedicationFormulation;
  frequency: string;
  reason: string;
  prescribedBy?: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  sideEffects?: string[];
  pregnancyCategory?: PregnancyCategory;
  notes?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLog {
  id?: number;
  medicationId: number;
  date: string;
  time?: string;
  taken: boolean;
  skipReason?: string;
  sideEffectsNoted?: string[];
  notes?: string;
  createdAt: string;
}

export class IylaMedicationsDB extends Dexie {
  medications!: Table<Medication, number>;
  logs!: Table<MedicationLog, number>;

  constructor() {
    super('IylaMedicationsDB');
    this.version(1).stores({
      medications: '++id, active, startDate',
      logs: '++id, medicationId, date',
    });
  }
}

export const medicationsDb = new IylaMedicationsDB();
