import { useState } from 'react';
import { Camera } from 'lucide-react';
import OcrModal from './OcrModal';
import { db } from '../lib/db';
import { LAB_DEFINITIONS } from '../lib/types';

interface Props {
  date: string;
  cycleId?: number;
  variant?: 'inline' | 'fab';
}

/**
 * Small reusable launcher button that opens the OCR flow. Persists parsed
 * values directly to Dexie: `db.readings` for daily Inito values, `db.labs`
 * for everything else.
 *
 * If `cycleId` is not supplied, the "Save to Daily Reading" branch is
 * disabled and the user can only save to Labs.
 */
export default function OcrButton({ date, cycleId, variant = 'inline' }: Props) {
  const [open, setOpen] = useState(false);

  async function saveToDailyReading(
    targetDate: string,
    updates: { lh?: number; e3g?: number; pdg?: number; fsh?: number },
  ) {
    if (cycleId == null) return;
    const existing = await db.readings
      .where('cycleId').equals(cycleId)
      .and(r => r.date === targetDate)
      .first();

    if (existing?.id) {
      await db.readings.update(existing.id, updates);
      return;
    }

    // Match existing DailyReading shape; compute cycleDay relative to cycle start.
    const cycle = await db.cycles.get(cycleId);
    const cycleDay = cycle
      ? Math.max(1, Math.floor(
          (new Date(targetDate).getTime() - new Date(cycle.startDate).getTime())
            / 86_400_000,
        ) + 1)
      : 1;
    await db.readings.add({
      date: targetDate,
      cycleId,
      cycleDay,
      ...updates,
    });
  }

  async function saveToLabs(
    entries: Array<{ testName: string; value: number; unit: string; date: string }>,
  ) {
    for (const e of entries) {
      const def = LAB_DEFINITIONS[e.testName];
      await db.labs.add({
        date: e.date,
        testName: e.testName,
        category: def?.category ?? 'Other',
        value: e.value,
        unit: e.unit || def?.unit || '',
        referenceRangeLow: def?.refLow,
        referenceRangeHigh: def?.refHigh,
        optimalRangeLow: def?.optimalLow,
        optimalRangeHigh: def?.optimalHigh,
        source: 'OCR scan',
      });
    }
  }

  const baseClasses =
    variant === 'fab'
      ? 'fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-warm-800 text-white px-5 py-3.5 rounded-full shadow-lg shadow-warm-300/40 hover:bg-warm-900 transition-all'
      : 'inline-flex items-center gap-2 bg-white border border-warm-200 text-warm-700 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-50 transition-all shadow-sm';

  return (
    <>
      <button onClick={() => setOpen(true)} className={baseClasses}>
        <Camera size={16} strokeWidth={1.5} />
        <span>Scan lab</span>
      </button>
      <OcrModal
        open={open}
        onClose={() => setOpen(false)}
        defaultDate={date}
        onSaveToDailyReading={cycleId != null ? saveToDailyReading : undefined}
        onSaveToLabs={saveToLabs}
      />
    </>
  );
}
