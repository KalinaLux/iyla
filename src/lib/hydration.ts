// ──────────────────────────────────────────────────────────────────────────
// iyla — Hydration Tracking
// ──────────────────────────────────────────────────────────────────────────
// Addresses the #1 cause of bad Inito readings: dilute urine samples.
//
// Two features:
//   1. Evening taper reminder (7pm on fertile days)
//   2. Morning test-quality check ("did you taper?") that feeds into the
//      signal concordance engine's dilute-sample detector
//
// Stored in localStorage (NOT Dexie — this is simple per-day metadata and
// doesn't need to be queryable by cycle).
// ──────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'iyla_hydration_log';
const REMINDER_KEY = 'iyla_hydration_reminder_enabled';

export interface HydrationEntry {
  date: string;              // ISO yyyy-MM-dd
  eveningTaperStart?: string; // HH:mm (when she stopped drinking big volumes)
  taperedWater: boolean;     // did she stop fluids after ~7pm last night?
  cupsToday?: number;        // cups consumed today (8oz)
  morningFirstPee: boolean;  // used first-morning urine for Inito?
  waterHoldHoursBeforeTest?: number; // hours since last fluids before a non-morning test
  notes?: string;
}

// ── Storage ────────────────────────────────────────────────────────────

function load(): Record<string, HydrationEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function save(data: Record<string, HydrationEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getHydration(date: string): HydrationEntry | null {
  const data = load();
  return data[date] ?? null;
}

export function saveHydration(entry: HydrationEntry): void {
  const data = load();
  data[entry.date] = entry;
  save(data);
}

export function getRecentHydration(days = 14): HydrationEntry[] {
  const data = load();
  return Object.values(data).sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
}

// ── Reminder prefs ─────────────────────────────────────────────────────

export function isReminderEnabled(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setReminderEnabled(v: boolean): void {
  try {
    localStorage.setItem(REMINDER_KEY, v ? 'true' : 'false');
  } catch { /* ignore */ }
}

// ── Quality scoring ────────────────────────────────────────────────────

export type SampleQualityRating = 'excellent' | 'good' | 'fair' | 'compromised';

export function rateMorningTestConditions(entry: HydrationEntry | null): {
  rating: SampleQualityRating;
  message: string;
} {
  if (!entry) {
    return {
      rating: 'fair',
      message: 'No hydration data logged — test results are interpretable but unverified.',
    };
  }
  if (entry.taperedWater && entry.morningFirstPee) {
    return {
      rating: 'excellent',
      message: 'Tapered water after 7pm + first-morning urine. This is the highest-accuracy window — trust these values.',
    };
  }
  if (entry.taperedWater || entry.morningFirstPee) {
    return {
      rating: 'good',
      message: entry.taperedWater
        ? 'Tapered water but not first-morning. Readings are usable; expect mild dilution possible.'
        : 'First-morning urine but no evening taper. Readings are usable; LH/E3G may be slightly diluted.',
    };
  }
  if (entry.waterHoldHoursBeforeTest && entry.waterHoldHoursBeforeTest >= 2) {
    return {
      rating: 'good',
      message: `${entry.waterHoldHoursBeforeTest}-hour urine hold. Acceptable accuracy; slight dilution possible.`,
    };
  }
  return {
    rating: 'compromised',
    message: 'No taper, no first-morning urine. Today\'s readings are likely dilute — iyla will downweight them.',
  };
}

// ── Reminder scheduling (browser Notifications API) ────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Fire a one-shot evening reminder if we're in the 7-10pm window on a fertile-window day. */
export function maybeShowEveningReminder(inFertileWindow: boolean): void {
  if (!isReminderEnabled()) return;
  if (!inFertileWindow) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const h = new Date().getHours();
  if (h < 19 || h >= 22) return;

  // Don't show more than once per calendar day
  const todayIso = new Date().toISOString().substring(0, 10);
  const shownKey = `iyla_hydration_reminder_shown_${todayIso}`;
  try {
    if (localStorage.getItem(shownKey)) return;
    localStorage.setItem(shownKey, '1');
  } catch { /* ignore */ }

  try {
    new Notification('iyla · Taper water now', {
      body: 'Stop big fluid intake for the night so tomorrow\'s Inito gives you a concentrated, accurate reading.',
      icon: '/icon-192.png',
      tag: 'iyla-hydration-evening',
    });
  } catch { /* ignore */ }
}
