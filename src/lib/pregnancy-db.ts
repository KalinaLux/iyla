import Dexie, { type Table } from 'dexie';

export interface PregnancyRecord {
  id?: number;
  /** Last menstrual period — the clinical anchor for dating a pregnancy. */
  lmpDate: string;
  /** Estimated date of conception (LMP + 14 typically). */
  conceptionDate?: string;
  /** When the user got the positive test. */
  positiveTestDate: string;
  /** LMP + 280 days. */
  estimatedDueDate: string;
  status: 'active' | 'completed' | 'loss';
  /** Birth date (for completed) or loss date (for loss). */
  outcomeDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PregnancySymptomLog {
  id?: number;
  pregnancyId: number;
  date: string;
  week: number;
  day: number;
  symptoms: string[];
  mood?: number;
  nausea?: number;
  energy?: number;
  notes?: string;
  createdAt: string;
}

export interface PregnancyAppointment {
  id?: number;
  pregnancyId: number;
  date: string;
  time?: string;
  type: 'ultrasound' | 'blood_draw' | 'ob_visit' | 'nst' | 'glucose' | 'other';
  provider?: string;
  location?: string;
  notes?: string;
  completed: boolean;
  /** e.g., "Heartbeat 142 bpm" */
  outcome?: string;
}

export class IylaPregnancyDB extends Dexie {
  pregnancies!: Table<PregnancyRecord, number>;
  symptoms!: Table<PregnancySymptomLog, number>;
  appointments!: Table<PregnancyAppointment, number>;

  constructor() {
    super('IylaPregnancyDB');
    this.version(1).stores({
      pregnancies: '++id, status, lmpDate',
      symptoms: '++id, pregnancyId, date, week',
      appointments: '++id, pregnancyId, date, type, completed',
    });
  }
}

export const pregnancyDb = new IylaPregnancyDB();
