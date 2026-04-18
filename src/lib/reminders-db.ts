import Dexie, { type Table } from 'dexie';

export type ReminderCategory =
  | 'supplement'
  | 'testing'         // LH strips, BBT, lab draw
  | 'hydration'
  | 'intimacy'        // "tonight is peak — remember!"
  | 'breathwork'
  | 'medication'
  | 'appointment'
  | 'custom';

export type ReminderRepeat =
  | 'once'
  | 'daily'
  | 'weekdays'
  | 'specific-days'    // use daysOfWeek
  | 'weekly'           // same weekday each week, use daysOfWeek [single]
  | 'cycle-day';       // fires on a specific cycleDay every cycle (use cycleDay)

export interface Reminder {
  id?: number;
  title: string;
  body?: string;             // optional note shown in the card / notification
  category: ReminderCategory;
  emoji?: string;            // picked by user or default per category
  time: string;              // "HH:MM" 24h
  repeat: ReminderRepeat;
  /** For 'specific-days' and 'weekly': 0 (Sun) - 6 (Sat) */
  daysOfWeek?: number[];
  /** For 'cycle-day': 1-40 */
  cycleDay?: number;
  /** For 'once' only */
  oneTimeDate?: string;      // yyyy-mm-dd
  enabled: boolean;
  notifyBrowser: boolean;    // schedule a browser notification
  createdAt: string;
  /** ISO timestamps of completions (for streak tracking) */
  completions: string[];
}

export class IylaRemindersDB extends Dexie {
  reminders!: Table<Reminder, number>;
  constructor() {
    super('IylaRemindersDB');
    this.version(1).stores({
      reminders: '++id, category, enabled, repeat',
    });
  }
}

export const remindersDb = new IylaRemindersDB();
