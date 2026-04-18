import { useState } from 'react';
import { Beaker, Moon, Dumbbell, Check } from 'lucide-react';
import Modal from './Modal';
import { maleDb, type SemenAnalysis, type MaleDailyLog } from '../lib/male-factor-db';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  existingDailyLog?: MaleDailyLog | null;
}

type Tab = 'daily' | 'analysis';

export default function MaleFactorEntryModal({ open, onClose, date, existingDailyLog }: Props) {
  const [tab, setTab] = useState<Tab>('daily');

  // Daily log state
  const [daily, setDaily] = useState<Partial<MaleDailyLog>>(existingDailyLog ?? { date });

  // Semen analysis state
  const [sa, setSa] = useState<Partial<SemenAnalysis>>({ date });

  async function saveDaily() {
    const entry: MaleDailyLog = { ...daily, date };
    if (existingDailyLog?.id) {
      await maleDb.dailyLogs.update(existingDailyLog.id, entry);
    } else {
      await maleDb.dailyLogs.add(entry);
    }
    onClose();
  }

  async function saveAnalysis() {
    const entry: SemenAnalysis = { date, ...sa };
    await maleDb.semenAnalyses.add(entry);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Log" maxWidth="max-w-xl">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-warm-50 rounded-2xl mb-5">
        <TabButton active={tab === 'daily'} onClick={() => setTab('daily')} icon={<Moon size={13} />} label="Daily lifestyle" />
        <TabButton active={tab === 'analysis'} onClick={() => setTab('analysis')} icon={<Beaker size={13} />} label="Semen analysis" />
      </div>

      {tab === 'daily' && (
        <div className="space-y-4">
          <SectionLabel icon={<Moon size={14} className="text-indigo-500" />} label="Sleep" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Hours slept" value={daily.sleepHours} onChange={v => setDaily(d => ({ ...d, sleepHours: v }))} step={0.25} />
            <Scale1to5 label="Sleep quality" value={daily.sleepQuality} onChange={v => setDaily(d => ({ ...d, sleepQuality: v }))} />
          </div>

          <SectionLabel icon={<Dumbbell size={14} className="text-emerald-500" />} label="Activity" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Exercise (min)" value={daily.exerciseMinutes} onChange={v => setDaily(d => ({ ...d, exerciseMinutes: v }))} step={5} />
            <SelectField
              label="Intensity"
              value={daily.exerciseIntensity ?? ''}
              onChange={v => setDaily(d => ({ ...d, exerciseIntensity: (v || undefined) as MaleDailyLog['exerciseIntensity'] }))}
              options={[{ value: '', label: '—' }, { value: 'rest', label: 'Rest' }, { value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'intense', label: 'Intense' }]}
            />
          </div>

          <SectionLabel label="Lifestyle" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Heat (min)" value={daily.heatExposureMinutes} onChange={v => setDaily(d => ({ ...d, heatExposureMinutes: v }))} step={5} />
            <NumberField label="Alcohol drinks" value={daily.alcoholDrinks} onChange={v => setDaily(d => ({ ...d, alcoholDrinks: v }))} step={1} />
            <NumberField label="Caffeine cups" value={daily.caffeineCups} onChange={v => setDaily(d => ({ ...d, caffeineCups: v }))} step={1} />
            <Scale1to5 label="Stress" value={daily.stressLevel} onChange={v => setDaily(d => ({ ...d, stressLevel: v }))} />
          </div>

          <SectionLabel label="How you feel" />
          <div className="grid grid-cols-3 gap-3">
            <Scale1to5 label="Mood" value={daily.mood} onChange={v => setDaily(d => ({ ...d, mood: v }))} />
            <Scale1to5 label="Energy" value={daily.energy} onChange={v => setDaily(d => ({ ...d, energy: v }))} />
            <Scale1to5 label="Libido" value={daily.libido} onChange={v => setDaily(d => ({ ...d, libido: v }))} />
          </div>

          <SectionLabel label="Supplements" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Taken" value={daily.supplementsTakenCount} onChange={v => setDaily(d => ({ ...d, supplementsTakenCount: v }))} step={1} />
            <NumberField label="Planned" value={daily.supplementsPlannedCount} onChange={v => setDaily(d => ({ ...d, supplementsPlannedCount: v }))} step={1} />
          </div>

          <button onClick={saveDaily} className="w-full mt-4 px-4 py-3 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            <Check size={14} strokeWidth={2.5} />
            Save today&apos;s log
          </button>
        </div>
      )}

      {tab === 'analysis' && (
        <div className="space-y-4">
          <p className="text-xs text-warm-400 leading-relaxed">Enter results from your latest semen analysis. Only fill in the numbers you have — iyla uses whatever is present.</p>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Volume (mL)" value={sa.volumeMl} onChange={v => setSa(s => ({ ...s, volumeMl: v }))} step={0.1} />
            <TextField label="Clinic" value={sa.clinic ?? ''} onChange={v => setSa(s => ({ ...s, clinic: v }))} />
            <NumberField label="Concentration (M/mL)" value={sa.concentrationMillionsPerMl} onChange={v => setSa(s => ({ ...s, concentrationMillionsPerMl: v }))} step={1} />
            <NumberField label="Total motility (%)" value={sa.totalMotilePct} onChange={v => setSa(s => ({ ...s, totalMotilePct: v }))} step={1} />
            <NumberField label="Progressive motility (%)" value={sa.progressiveMotilityPct} onChange={v => setSa(s => ({ ...s, progressiveMotilityPct: v }))} step={1} />
            <NumberField label="Morphology (%)" value={sa.morphologyPct} onChange={v => setSa(s => ({ ...s, morphologyPct: v }))} step={0.5} />
            <NumberField label="DNA fragmentation (%)" value={sa.dnaFragmentationPct} onChange={v => setSa(s => ({ ...s, dnaFragmentationPct: v }))} step={1} />
            <NumberField label="pH" value={sa.phAbove} onChange={v => setSa(s => ({ ...s, phAbove: v }))} step={0.1} />
            <NumberField label="Vitality (%)" value={sa.vitalityPct} onChange={v => setSa(s => ({ ...s, vitalityPct: v }))} step={1} />
          </div>

          <TextField label="Notes" value={sa.notes ?? ''} onChange={v => setSa(s => ({ ...s, notes: v }))} />

          <button onClick={saveAnalysis} className="w-full mt-4 px-4 py-3 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            <Check size={14} strokeWidth={2.5} />
            Save analysis
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Mini components ────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        active ? 'bg-white text-warm-800 shadow-sm' : 'text-warm-400 hover:text-warm-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-warm-400 pt-1">
      {icon}
      {label}
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-warm-600 mb-1.5">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
        className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-warm-800 focus:outline-none focus:border-warm-400"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-warm-600 mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-warm-800 focus:outline-none focus:border-warm-400"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-warm-600 mb-1.5">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-warm-800 focus:outline-none focus:border-warm-400"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Scale1to5({ label, value, onChange }: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <span className="block text-xs text-warm-600 mb-1.5">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(value === n ? undefined : n)}
            className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all ${
              value === n ? 'bg-warm-800 text-white' : 'bg-warm-50 text-warm-400 hover:bg-warm-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
