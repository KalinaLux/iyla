// ──────────────────────────────────────────────────────────────────────────
// iyla — Custom Reminders (pure logic)
// ──────────────────────────────────────────────────────────────────────────
// No React, no DB writes. Given an array of Reminder objects and the current
// date/cycle-day, decide what's due and schedule browser notifications for
// the rest of today.
//
// "Last fired today" tracking is persisted in localStorage so that if the
// user reloads the tab we don't re-fire reminders that already fired.
// ──────────────────────────────────────────────────────────────────────────

import { format, setHours, setMinutes, setSeconds, setMilliseconds, addDays, isSameDay, subDays } from 'date-fns';
import type { Reminder, ReminderCategory } from './reminders-db';

const LAST_FIRED_KEY = 'iyla-reminders-lastFired';

// ── Helpers ───────────────────────────────────────────────────────────

function todayStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function parseHHMM(time: string): { h: number; m: number } {
  const [hs, ms] = time.split(':');
  const h = Number.parseInt(hs ?? '0', 10);
  const m = Number.parseInt(ms ?? '0', 10);
  return {
    h: Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0,
    m: Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0,
  };
}

function atTimeOnDate(date: Date, time: string): Date {
  const { h, m } = parseHHMM(time);
  return setMilliseconds(setSeconds(setMinutes(setHours(date, h), m), 0), 0);
}

function loadLastFired(): Record<number, string> {
  try {
    const raw = localStorage.getItem(LAST_FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveLastFired(data: Record<number, string>): void {
  try {
    localStorage.setItem(LAST_FIRED_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function markFiredToday(reminderId: number, today: Date): void {
  const data = loadLastFired();
  data[reminderId] = todayStr(today);
  saveLastFired(data);
}

function hasFiredToday(reminderId: number, today: Date): boolean {
  const data = loadLastFired();
  return data[reminderId] === todayStr(today);
}

// ── Category defaults ─────────────────────────────────────────────────

export function defaultEmoji(c: ReminderCategory): string {
  switch (c) {
    case 'supplement':  return '💊';
    case 'testing':     return '🧪';
    case 'hydration':   return '💧';
    case 'intimacy':    return '💕';
    case 'breathwork':  return '🌬';
    case 'medication':  return '💊';
    case 'appointment': return '📅';
    case 'custom':
    default:            return '✨';
  }
}

// ── Scheduling logic ──────────────────────────────────────────────────

/** Decide whether a reminder should fire today. */
export function isDueToday(r: Reminder, today: Date, cycleDay: number | null): boolean {
  if (!r.enabled) return false;
  const dow = today.getDay();
  switch (r.repeat) {
    case 'once':
      return !!r.oneTimeDate && r.oneTimeDate === todayStr(today);
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'specific-days':
      return Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(dow);
    case 'weekly':
      return Array.isArray(r.daysOfWeek) && r.daysOfWeek.length > 0 && r.daysOfWeek.includes(dow);
    case 'cycle-day':
      return cycleDay != null && typeof r.cycleDay === 'number' && r.cycleDay === cycleDay;
    default:
      return false;
  }
}

/** Next Date when this reminder will fire next, after `now`. Null if it won't fire. */
export function nextFireTime(r: Reminder, now: Date, cycleDay: number | null): Date | null {
  if (!r.enabled) return null;

  // One-time: only if the date is today and time still in future, or a future date.
  if (r.repeat === 'once') {
    if (!r.oneTimeDate) return null;
    const target = atTimeOnDate(new Date(r.oneTimeDate + 'T00:00:00'), r.time);
    return target.getTime() > now.getTime() ? target : null;
  }

  // Cycle-day: if today matches and time is still ahead, fire today; otherwise
  // we can't predict the next cycle without cycle context. Return today if applicable.
  if (r.repeat === 'cycle-day') {
    if (cycleDay != null && typeof r.cycleDay === 'number' && r.cycleDay === cycleDay) {
      const todayFire = atTimeOnDate(now, r.time);
      if (todayFire.getTime() > now.getTime()) return todayFire;
    }
    return null;
  }

  // Repeating patterns: walk forward up to 14 days to find the next match.
  for (let i = 0; i < 14; i++) {
    const candidate = addDays(now, i);
    const dow = candidate.getDay();
    let matches = false;
    if (r.repeat === 'daily') matches = true;
    else if (r.repeat === 'weekdays') matches = dow >= 1 && dow <= 5;
    else if (r.repeat === 'specific-days' || r.repeat === 'weekly') {
      matches = Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(dow);
    }
    if (!matches) continue;
    const fireAt = atTimeOnDate(candidate, r.time);
    if (fireAt.getTime() > now.getTime()) return fireAt;
  }
  return null;
}

/** Returns reminders due today, sorted by time asc. Already filters enabled + today matches. */
export function remindersDueToday(
  reminders: Reminder[],
  today: Date,
  cycleDay: number | null,
): Reminder[] {
  return reminders
    .filter(r => isDueToday(r, today, cycleDay))
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Returns reminders due in the next `hours` hours (and not already completed today). */
export function upcomingWithinHours(
  reminders: Reminder[],
  now: Date,
  hours: number,
  cycleDay: number | null,
): Reminder[] {
  const horizon = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const todayKey = todayStr(now);
  return reminders
    .filter(r => {
      if (!isDueToday(r, now, cycleDay)) return false;
      if (r.completions.includes(todayKey)) return false;
      const fireAt = atTimeOnDate(now, r.time);
      return fireAt.getTime() >= now.getTime() && fireAt.getTime() <= horizon.getTime();
    })
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ── Completions + streak ──────────────────────────────────────────────

/** Mark a reminder completed for a specific date string. Returns new completions array. */
export function markCompleted(r: Reminder, dateStr: string): string[] {
  if (r.completions.includes(dateStr)) return r.completions.slice();
  return [...r.completions, dateStr].sort();
}

/** Compute current streak for a daily-ish reminder.
 *  - daily: consecutive days back from today
 *  - weekdays: consecutive weekdays back from today (skipping Sat/Sun)
 *  - specific-days / weekly: consecutive matching-weekday instances back from today
 *  - once / cycle-day / other: count of unique completions (reasonable fallback)
 */
export function computeStreak(r: Reminder): number {
  const completed = new Set(r.completions.map(c => c.substring(0, 10)));
  if (completed.size === 0) return 0;

  const today = new Date();

  if (r.repeat === 'daily') {
    let streak = 0;
    let cursor = today;
    // If today hasn't been completed but yesterday was, streak continues.
    // Start by checking today; if missing, start from yesterday so an active
    // streak isn't zeroed before the user has checked in today.
    if (!completed.has(todayStr(cursor))) {
      cursor = subDays(cursor, 1);
    }
    while (completed.has(todayStr(cursor))) {
      streak++;
      cursor = subDays(cursor, 1);
    }
    return streak;
  }

  if (r.repeat === 'weekdays') {
    let streak = 0;
    let cursor = today;
    if (!completed.has(todayStr(cursor))) cursor = subDays(cursor, 1);
    while (true) {
      const dow = cursor.getDay();
      if (dow === 0 || dow === 6) { cursor = subDays(cursor, 1); continue; }
      if (!completed.has(todayStr(cursor))) break;
      streak++;
      cursor = subDays(cursor, 1);
    }
    return streak;
  }

  if (r.repeat === 'specific-days' || r.repeat === 'weekly') {
    const days = r.daysOfWeek ?? [];
    if (days.length === 0) return completed.size;
    let streak = 0;
    let cursor = today;
    if (!completed.has(todayStr(cursor))) cursor = subDays(cursor, 1);
    // Walk back checking only the days the reminder was scheduled for.
    // Bound to 365 to avoid pathological loops.
    for (let i = 0; i < 365; i++) {
      const dow = cursor.getDay();
      if (!days.includes(dow)) { cursor = subDays(cursor, 1); continue; }
      if (!completed.has(todayStr(cursor))) break;
      streak++;
      cursor = subDays(cursor, 1);
    }
    return streak;
  }

  return completed.size;
}

// ── Browser notifications ─────────────────────────────────────────────

/** Request browser notification permission (returns granted boolean) */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Fire a browser notification NOW for a given reminder */
export function fireNotification(r: Reminder): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const emoji = r.emoji || defaultEmoji(r.category);
  try {
    new Notification(`iyla · ${emoji} ${r.title}`, {
      body: r.body || `Reminder at ${r.time}`,
      icon: '/icon-192.png',
      tag: `iyla-reminder-${r.id ?? r.title}`,
    });
  } catch {
    /* ignore */
  }
}

/** Schedule all applicable reminders that haven't fired yet today via setTimeout.
 *  Returns a cleanup function that cancels all timeouts.
 *
 *  Behavior:
 *    - Only reminders due today (isDueToday) and with a `time` strictly in the
 *      future are scheduled. Past-due reminders are NOT fired retroactively.
 *    - Per-reminder "fired today" is tracked in localStorage so a tab reload
 *      before the scheduled time will re-arm the timeout, and after it will
 *      skip re-firing.
 *    - Browser notification is only sent if r.notifyBrowser is true AND
 *      Notification permission is granted. `onFire` is always invoked so the
 *      UI can still surface in-app cards regardless.
 */
export function scheduleTodaysReminders(
  reminders: Reminder[],
  cycleDay: number | null,
  onFire?: (r: Reminder) => void,
): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const now = new Date();

  for (const r of reminders) {
    if (!r.enabled) continue;
    if (r.id == null) continue;
    if (!isDueToday(r, now, cycleDay)) continue;
    if (hasFiredToday(r.id, now)) continue;

    const fireAt = atTimeOnDate(now, r.time);
    const delay = fireAt.getTime() - now.getTime();
    if (delay <= 0) continue; // past-due, skip (don't annoy retroactively)
    // Cap at 24 hours just to be safe — we only schedule today.
    if (delay > 24 * 60 * 60 * 1000) continue;

    const reminderRef = r;
    const reminderId = r.id;
    const handle = setTimeout(() => {
      // Re-check we haven't already fired (in case another tab fired first).
      if (hasFiredToday(reminderId, new Date())) return;
      markFiredToday(reminderId, new Date());
      if (reminderRef.notifyBrowser) fireNotification(reminderRef);
      onFire?.(reminderRef);
    }, delay);
    timeouts.push(handle);
  }

  return () => {
    for (const h of timeouts) clearTimeout(h);
  };
}

// ── Utility: "last fired" inspection (not strictly in spec, but useful) ──

/** Whether this reminder has a recorded firing for `day`. */
export function didFireOn(reminderId: number, day: Date): boolean {
  const data = loadLastFired();
  return !!data[reminderId] && data[reminderId] === todayStr(day);
}

/** Convenience: was this reminder completed on the given date? */
export function isCompletedOn(r: Reminder, day: Date): boolean {
  const key = todayStr(day);
  return r.completions.some(c => c.substring(0, 10) === key || isSameDay(new Date(c), day));
}
