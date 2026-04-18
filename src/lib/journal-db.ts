import Dexie, { type Table } from 'dexie';

export type EntryKind = 'morning' | 'evening' | 'freeform';

export type EmotionalTone =
  | 'radiant'
  | 'calm'
  | 'neutral'
  | 'heavy'
  | 'anxious'
  | 'grieving';

export interface JournalEntry {
  id?: number;
  /** ISO yyyy-mm-dd — the day the entry belongs to (not the write time). */
  date: string;
  kind: EntryKind;
  title?: string;
  body: string;
  /** Structured prompt/response pairs for morning/evening entries. */
  prompts: Array<{ prompt: string; response: string }>;
  emotionalTone?: EmotionalTone;
  mood?: number; // 1–10
  stress?: number; // 1–10
  gratitude?: string[]; // up to 3
  intention?: string; // morning only
  tags: string[];
  cyclePhase?: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
  cycleDay?: number;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export class IylaJournalDB extends Dexie {
  entries!: Table<JournalEntry, number>;

  constructor() {
    super('IylaJournalDB');
    this.version(1).stores({
      entries: '++id, date, kind, cyclePhase, emotionalTone',
    });
  }
}

export const journalDb = new IylaJournalDB();
