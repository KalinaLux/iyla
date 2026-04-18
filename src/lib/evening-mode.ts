// ──────────────────────────────────────────────────────────────────────────
// Evening mode — a warm, dimmed filter over the whole app for bedside use
// (BBT logging, journaling, reminders at night). Not a true dark theme —
// just a gentle amber veil that reduces blue light and eye strain.
// ──────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'iyla-evening-mode';
const AUTO_KEY = 'iyla-evening-auto';

export function isEveningModeActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains('evening-mode');
}

export function setEveningMode(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('evening-mode', on);
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  window.dispatchEvent(new Event('iyla-evening-mode-changed'));
}

export function toggleEveningMode(): void {
  setEveningMode(!isEveningModeActive());
}

export function getAutoEvening(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(AUTO_KEY) === '1';
}

export function setAutoEvening(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (on) applyAutoIfNeeded();
}

/** If auto is on and current hour is >= 20 or <= 6, enable; else disable. */
export function applyAutoIfNeeded(): void {
  if (!getAutoEvening()) return;
  const h = new Date().getHours();
  const shouldBeOn = h >= 20 || h <= 6;
  if (shouldBeOn !== isEveningModeActive()) {
    setEveningMode(shouldBeOn);
  }
}

/** Called once at app boot to restore user's preference. */
export function initEveningMode(): void {
  if (typeof window === 'undefined') return;
  if (getAutoEvening()) {
    applyAutoIfNeeded();
    // Check every 5 min in case they leave the app open
    setInterval(applyAutoIfNeeded, 5 * 60 * 1000);
  } else {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') setEveningMode(true);
  }
}
