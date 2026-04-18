import { db } from './db';
import type { Cycle, DailyReading, LabResult, Supplement, SupplementProtocol } from './types';
import { setSelectedTheme } from './signal-themes';
import { savePairCode } from './sync';

const DEMO_PAIR_CODE = 'DEMO-PAIR';

// ─── DEMO CYCLES ──────────────────────────────────────────
// Sample data for demonstration purposes.
// Replace with your real data in a local-only copy.

const DEMO_CYCLE_1: Omit<Cycle, 'id'> = {
  startDate: '2026-03-11',
  endDate: '2026-04-05',
  outcome: 'negative',
  ovulationDay: 13,
  follicularPhaseDays: 12,
  lutealPhaseDays: 14,
  notes: 'Demo cycle 1 — sample data',
};

const DEMO_CYCLE_2: Omit<Cycle, 'id'> = {
  startDate: '2026-04-06',
  outcome: 'ongoing',
  notes: 'Demo cycle 2 — in progress',
};

function demoCycle1Readings(cycleId: number): Omit<DailyReading, 'id'>[] {
  return [
    { date: '2026-03-17', cycleId, cycleDay: 7, fertilityStatus: 'low' },
    { date: '2026-03-18', cycleId, cycleDay: 8, fertilityStatus: 'low' },
    { date: '2026-03-19', cycleId, cycleDay: 9, fertilityStatus: 'rising' },
    { date: '2026-03-20', cycleId, cycleDay: 10, fertilityStatus: 'high' },
    { date: '2026-03-21', cycleId, cycleDay: 11, fertilityStatus: 'high', e3g: 96.0, pdg: 1.3, lh: 0.1 },
    { date: '2026-03-22', cycleId, cycleDay: 12, fertilityStatus: 'peak', e3g: 127.0, lh: 2.4 },
    { date: '2026-03-23', cycleId, cycleDay: 13, fertilityStatus: 'peak', e3g: 141.0, lh: 18.0, notes: 'LH peak — ovulation day' },
    { date: '2026-03-24', cycleId, cycleDay: 14, fertilityStatus: 'confirmed_ovulation', lh: 3.1 },
    { date: '2026-03-25', cycleId, cycleDay: 15, fertilityStatus: 'luteal', pdg: 3.9, bbt: 97.78 },
    { date: '2026-03-26', cycleId, cycleDay: 16, fertilityStatus: 'luteal', pdg: 4.4, bbt: 97.88 },
    { date: '2026-03-27', cycleId, cycleDay: 17, fertilityStatus: 'luteal', pdg: 5.4, bbt: 98.11 },
    { date: '2026-03-28', cycleId, cycleDay: 18, fertilityStatus: 'luteal', pdg: 7.7, bbt: 98.26 },
    { date: '2026-03-29', cycleId, cycleDay: 19, fertilityStatus: 'luteal', pdg: 5.0, bbt: 98.35 },
    { date: '2026-03-30', cycleId, cycleDay: 20, fertilityStatus: 'luteal', pdg: 5.5, bbt: 98.40, sleepScore: 85 },
    { date: '2026-03-31', cycleId, cycleDay: 21, fertilityStatus: 'luteal', pdg: 5.0, bbt: 98.48, sleepScore: 92 },
    { date: '2026-04-01', cycleId, cycleDay: 22, fertilityStatus: 'luteal', pdg: 6.1, bbt: 98.56, sleepScore: 76 },
    { date: '2026-04-02', cycleId, cycleDay: 23, fertilityStatus: 'luteal', pdg: 3.8, bbt: 98.49, sleepScore: 63 },
    { date: '2026-04-03', cycleId, cycleDay: 24, fertilityStatus: 'luteal', pdg: 5.1, bbt: 98.49, sleepScore: 84 },
    { date: '2026-04-04', cycleId, cycleDay: 25, fertilityStatus: 'luteal', bbt: 98.60, sleepScore: 97 },
    { date: '2026-04-05', cycleId, cycleDay: 26, fertilityStatus: 'luteal', bbt: 98.38 },
  ];
}

function demoCycle2Readings(cycleId: number): Omit<DailyReading, 'id'>[] {
  return [
    { date: '2026-04-06', cycleId, cycleDay: 1, fertilityStatus: 'menstrual' },
    { date: '2026-04-07', cycleId, cycleDay: 2, bbt: 98.15, sleepScore: 89, fertilityStatus: 'menstrual' },
    { date: '2026-04-08', cycleId, cycleDay: 3, bbt: 97.86, fertilityStatus: 'menstrual' },
    { date: '2026-04-09', cycleId, cycleDay: 4, bbt: 97.76, sleepScore: 77, fertilityStatus: 'low' },
    { date: '2026-04-10', cycleId, cycleDay: 5, bbt: 97.67, sleepScore: 86, keggScore: 5, keggImpedance: 42, fertilityStatus: 'low' },
    { date: '2026-04-11', cycleId, cycleDay: 6, bbt: 97.51, sleepScore: 72, keggScore: 9, keggImpedance: 65, fertilityStatus: 'low' },
    { date: '2026-04-12', cycleId, cycleDay: 7, bbt: 97.54, sleepScore: 81, keggScore: 21, keggImpedance: 80, fertilityStatus: 'low' },
    { date: '2026-04-13', cycleId, cycleDay: 8, bbt: 97.60, sleepScore: 86, keggScore: 33, keggImpedance: 57, fertilityStatus: 'low' },
    { date: '2026-04-14', cycleId, cycleDay: 9, bbt: 97.57, sleepScore: 78, keggScore: 45, keggImpedance: 23, fertilityStatus: 'rising' },
  ];
}

const DEMO_LABS: Omit<LabResult, 'id'>[] = [
  { date: '2026-01-15', testName: 'AMH', category: 'Fertility Hormones', value: 1.5, unit: 'ng/mL', referenceRangeLow: 0.7, referenceRangeHigh: 3.5, optimalRangeLow: 1.0, optimalRangeHigh: 3.5, notes: 'Sample data' },
  { date: '2026-01-15', testName: 'FSH (Baseline)', category: 'Fertility Hormones', value: 8.9, unit: 'mIU/mL', referenceRangeLow: 3.5, referenceRangeHigh: 12.5, optimalRangeLow: 3.5, optimalRangeHigh: 8.0, notes: 'Sample data' },
  { date: '2026-01-15', testName: 'TSH', category: 'Thyroid', value: 2.1, unit: 'mIU/L', referenceRangeLow: 0.45, referenceRangeHigh: 4.5, optimalRangeLow: 1.0, optimalRangeHigh: 2.5, notes: 'Sample data' },
];

const DEMO_PROTOCOL: Omit<SupplementProtocol, 'id'> = {
  name: 'Sample — Egg Quality Protocol',
  description: 'Demo supplement protocol for testing.',
  isActive: true,
  createdAt: '2026-04-14',
};

function demoSupplements(protocolId: number): Omit<Supplement, 'id'>[] {
  return [
    { name: 'Ubiquinol (CoQ10)', dose: '400mg', timing: ['morning'], mechanism: 'Mitochondrial energy, egg quality', isActive: true, protocolId, sortOrder: 1 },
    { name: 'Prenatal Multi', dose: '1 serving', timing: ['morning'], mechanism: 'Baseline micronutrient coverage', isActive: true, protocolId, sortOrder: 2 },
    { name: 'Omega-3 DHA', dose: '500mg', timing: ['morning'], mechanism: 'Anti-inflammatory, neural development', isActive: true, protocolId, sortOrder: 3 },
    { name: 'Methylfolate', dose: '1000mcg', timing: ['morning'], mechanism: 'Neural tube prevention, methylation', isActive: true, protocolId, sortOrder: 4 },
    { name: 'Magnesium', dose: '300mg', timing: ['bedtime'], mechanism: 'Sleep, progesterone support', isActive: true, protocolId, sortOrder: 5 },
  ];
}

// ─── LOCAL OVERRIDE ───────────────────────────────────────
// If seed-data.local.ts exists (gitignored), use real data.
// Otherwise fall back to the demo data above.

const localModules = import.meta.glob('./seed-data.local.ts', { eager: false });
const hasLocalOverride = Object.keys(localModules).length > 0;

async function getLocalSeed(): Promise<{ seedKalinaProfile: () => Promise<void>; seedDominickProfile: () => Promise<void> } | null> {
  if (!hasLocalOverride) return null;
  try {
    const mod = await localModules['./seed-data.local.ts']() as any;
    return mod;
  } catch {
    return null;
  }
}

// ─── SEED FUNCTIONS ───────────────────────────────────────

async function seedDemoKalina(): Promise<void> {
  await db.transaction('rw', [db.cycles, db.readings, db.labs, db.supplements, db.protocols, db.supplementLogs], async () => {
    await db.cycles.clear();
    await db.readings.clear();
    await db.labs.clear();
    await db.supplements.clear();
    await db.protocols.clear();
    await db.supplementLogs.clear();

    const c1Id = await db.cycles.add(DEMO_CYCLE_1 as any);
    const c2Id = await db.cycles.add(DEMO_CYCLE_2 as any);

    await db.readings.bulkAdd(demoCycle1Readings(c1Id as number) as any[]);
    await db.readings.bulkAdd(demoCycle2Readings(c2Id as number) as any[]);

    await db.labs.bulkAdd(DEMO_LABS as any[]);

    const protocolId = await db.protocols.add(DEMO_PROTOCOL as any);
    await db.supplements.bulkAdd(demoSupplements(protocolId as number) as any[]);
  });

  localStorage.setItem('iyla-user-role', 'her');
  localStorage.setItem('iyla-onboarded', 'true');
  savePairCode(DEMO_PAIR_CODE);
}

async function seedDemoDominick(): Promise<void> {
  localStorage.setItem('iyla-user-role', 'partner');
  localStorage.setItem('iyla-onboarded', 'true');
  setSelectedTheme('topgun');
  savePairCode(DEMO_PAIR_CODE);
}

export async function seedKalinaProfile(): Promise<void> {
  const local = await getLocalSeed();
  if (local) {
    await local.seedKalinaProfile();
  } else {
    await seedDemoKalina();
  }
}

export async function seedDominickProfile(): Promise<void> {
  const local = await getLocalSeed();
  if (local) {
    await local.seedDominickProfile();
  } else {
    await seedDemoDominick();
  }
}

export async function isSeeded(): Promise<boolean> {
  const count = await db.cycles.count();
  return count > 0;
}

export async function clearAllData(): Promise<void> {
  await db.cycles.clear();
  await db.readings.clear();
  await db.labs.clear();
  await db.supplements.clear();
  await db.protocols.clear();
  await db.supplementLogs.clear();
  localStorage.removeItem('iyla-user-role');
  localStorage.removeItem('iyla-onboarded');
  localStorage.removeItem('iyla_signal_theme');
  localStorage.removeItem('iyla_pair_code');
}
