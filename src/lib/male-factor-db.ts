import Dexie, { type Table } from 'dexie';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * A semen analysis record. Reference ranges follow WHO 6th edition (2021)
 * lower-reference-limits; optimal ranges used by the Dad Score are stricter.
 */
export interface SemenAnalysis {
  id?: number;
  date: string;                         // ISO (YYYY-MM-DD)
  clinic?: string;
  volumeMl?: number;                    // ref 1.5-5.0
  concentrationMillionsPerMl?: number;  // ref >=16
  totalMotilePct?: number;              // ref >=42
  progressiveMotilityPct?: number;      // ref >=30
  morphologyPct?: number;               // ref >=4 (Kruger)
  dnaFragmentationPct?: number;         // optional; optimal <15
  phAbove?: number;                     // ref >=7.2
  vitalityPct?: number;                 // ref >=58
  notes?: string;
}

/**
 * A daily male-partner log — lifestyle signals the Dad Score reads from.
 */
export interface MaleDailyLog {
  id?: number;
  date: string;                         // ISO (YYYY-MM-DD)
  sleepHours?: number;
  sleepQuality?: number;                // 1-5
  exerciseMinutes?: number;
  exerciseIntensity?: 'rest' | 'light' | 'moderate' | 'intense';
  heatExposureMinutes?: number;         // hot tubs / sauna / laptop on lap
  alcoholDrinks?: number;
  caffeineCups?: number;
  stressLevel?: number;                 // 1-5
  mood?: number;                        // 1-5
  energy?: number;                      // 1-5
  libido?: number;                      // 1-5
  supplementsTakenCount?: number;
  supplementsPlannedCount?: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Dexie database
// ─────────────────────────────────────────────────────────────────────────

export class IylaMaleDB extends Dexie {
  semenAnalyses!: Table<SemenAnalysis, number>;
  dailyLogs!: Table<MaleDailyLog, number>;

  constructor() {
    super('IylaMaleDB');
    this.version(1).stores({
      semenAnalyses: '++id, date',
      dailyLogs: '++id, date',
    });
  }
}

export const maleDb = new IylaMaleDB();
