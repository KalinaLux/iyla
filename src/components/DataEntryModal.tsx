import { useState } from 'react';
import { Thermometer, Zap, Droplets, Eye, Heart } from 'lucide-react';
import Modal from './Modal';
import { db } from '../lib/db';
import type { DailyReading, MucusType, MoodType } from '../lib/types';
import { SYMPTOM_OPTIONS } from '../lib/types';
import { assessFertility } from '../lib/fertility-engine';
import { getCachedBaselines } from '../lib/baselines';

interface Props {
  open: boolean;
  onClose: () => void;
  cycleId: number;
  cycleDay: number;
  date: string;
  existingReading?: DailyReading;
}

type Tab = 'tempdrop' | 'inito' | 'kegg' | 'symptoms' | 'intercourse';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'tempdrop', label: 'TempDrop', icon: <Thermometer size={14} strokeWidth={1.5} /> },
  { key: 'inito', label: 'Inito', icon: <Zap size={14} strokeWidth={1.5} /> },
  { key: 'kegg', label: 'Kegg', icon: <Droplets size={14} strokeWidth={1.5} /> },
  { key: 'symptoms', label: 'Symptoms', icon: <Eye size={14} strokeWidth={1.5} /> },
  { key: 'intercourse', label: 'Intimacy', icon: <Heart size={14} strokeWidth={1.5} /> },
];

export default function DataEntryModal({ open, onClose, cycleId, cycleDay, date, existingReading }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tempdrop');
  const [saving, setSaving] = useState(false);

  const [bbt, setBbt] = useState(existingReading?.bbt?.toString() ?? '');
  const [sleepScore, setSleepScore] = useState(existingReading?.sleepScore?.toString() ?? '');
  const [deepSleep, setDeepSleep] = useState(existingReading?.deepSleepMin?.toString() ?? '');
  const [interruptions, setInterruptions] = useState(existingReading?.sleepInterruptions?.toString() ?? '');

  const [e3g, setE3g] = useState(existingReading?.e3g?.toString() ?? '');
  const [lh, setLh] = useState(existingReading?.lh?.toString() ?? '');
  const [pdg, setPdg] = useState(existingReading?.pdg?.toString() ?? '');
  const [fsh, setFsh] = useState(existingReading?.fsh?.toString() ?? '');

  const [keggImpedance, setKeggImpedance] = useState(existingReading?.keggImpedance?.toString() ?? '');
  const [keggScore, setKeggScore] = useState(existingReading?.keggScore?.toString() ?? '');

  const [mucus, setMucus] = useState<MucusType>(existingReading?.cervicalMucus ?? 'not_checked');
  const [mood, setMood] = useState<MoodType | ''>(existingReading?.mood ?? '');
  const [energy, setEnergy] = useState(existingReading?.energy?.toString() ?? '');
  const [symptoms, setSymptoms] = useState<string[]>(existingReading?.symptoms ?? []);
  const [notes, setNotes] = useState(existingReading?.notes ?? '');

  const [intercourse, setIntercourse] = useState(existingReading?.intercourse ?? false);
  const [intercourseTime, setIntercourseTime] = useState(existingReading?.intercourseTime ?? '');
  const [intercourseNotes, setIntercourseNotes] = useState(existingReading?.intercourseNotes ?? '');

  async function handleSave() {
    setSaving(true);
    const reading: DailyReading = {
      date, cycleId, cycleDay,
      bbt: bbt ? parseFloat(bbt) : undefined,
      sleepScore: sleepScore ? parseInt(sleepScore) : undefined,
      deepSleepMin: deepSleep ? parseInt(deepSleep) : undefined,
      sleepInterruptions: interruptions ? parseInt(interruptions) : undefined,
      e3g: e3g ? parseFloat(e3g) : undefined,
      lh: lh ? parseFloat(lh) : undefined,
      pdg: pdg ? parseFloat(pdg) : undefined,
      fsh: fsh ? parseFloat(fsh) : undefined,
      keggImpedance: keggImpedance ? parseFloat(keggImpedance) : undefined,
      keggScore: keggScore ? parseFloat(keggScore) : undefined,
      cervicalMucus: mucus,
      mood: mood || undefined,
      energy: energy ? parseInt(energy) : undefined,
      symptoms: symptoms.length > 0 ? symptoms : undefined,
      notes: notes || undefined,
      intercourse,
      intercourseTime: intercourseTime || undefined,
      intercourseNotes: intercourseNotes || undefined,
    };

    // Auto-compute fertilityStatus using recent readings + full concordance
    // guard so a dilute sample can never mis-tag today's status.
    try {
      const recentReadings = await db.readings
        .where('cycleId').equals(cycleId)
        .and(r => r.date < date)
        .sortBy('date');
      const last7 = recentReadings.slice(-7);
      const yesterday = recentReadings.length > 0 ? recentReadings[recentReadings.length - 1] : null;
      // Prior cycles' peak LH days for historical surge matching
      const allReadings = await db.readings.toArray();
      const otherCycleIds = Array.from(new Set(allReadings.map(r => r.cycleId))).filter(id => id !== cycleId);
      const cycleHistory = otherCycleIds.map(id => {
        const cr = allReadings.filter(r => r.cycleId === id && r.lh != null);
        if (cr.length === 0) return { peakLhDay: null, peakLhValue: null };
        let peak = cr[0];
        for (const r of cr) if ((r.lh ?? 0) > (peak.lh ?? 0)) peak = r;
        return { peakLhDay: peak.cycleDay, peakLhValue: peak.lh ?? null };
      });
      const priorStatus = yesterday?.fertilityStatus ?? null;
      // Load cached personalized baselines (populated by the intelligence orchestrator).
      const baselines = getCachedBaselines();
      const assessment = assessFertility(reading, last7, cycleDay, {
        yesterdayReading: yesterday,
        cycleHistory,
        priorStatus,
        baselines,
      });
      reading.fertilityStatus = assessment.status;
    } catch {
      // If assessment fails, save without it; it can still be computed on read
    }

    if (existingReading?.id) {
      await db.readings.update(existingReading.id, { ...reading } as any);
    } else {
      await db.readings.add(reading);
    }
    setSaving(false);
    onClose();
  }

  function toggleSymptom(s: string) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log Data — Cycle Day ${cycleDay}`} maxWidth="max-w-2xl">
      {/* Tab Bar */}
      <div className="flex gap-1 mb-7 bg-warm-50 rounded-2xl p-1.5">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 flex-1 justify-center ${
              activeTab === key
                ? 'bg-white text-warm-800 shadow-sm shadow-warm-100'
                : 'text-warm-400 hover:text-warm-600'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'tempdrop' && (
        <div className="space-y-5">
          <InputField label="BBT Temperature (°F)" value={bbt} onChange={setBbt} placeholder="97.42" type="number" step="0.01" />
          <InputField label="Sleep Score" value={sleepScore} onChange={setSleepScore} placeholder="85" type="number" />
          <InputField label="Deep Sleep (minutes)" value={deepSleep} onChange={setDeepSleep} placeholder="72" type="number" />
          <InputField label="Sleep Interruptions" value={interruptions} onChange={setInterruptions} placeholder="2" type="number" />
        </div>
      )}

      {activeTab === 'inito' && (
        <div className="space-y-5">
          <InputField label="E3G / Estrogen (pg/mL)" value={e3g} onChange={setE3g} placeholder="48.3" type="number" step="0.1" />
          <InputField label="LH (mIU/mL)" value={lh} onChange={setLh} placeholder="17.97" type="number" step="0.01" />
          <InputField label="PdG / Progesterone (µg/mL)" value={pdg} onChange={setPdg} placeholder="7.7" type="number" step="0.1" />
          <InputField label="FSH (mIU/mL)" value={fsh} onChange={setFsh} placeholder="6.2" type="number" step="0.1" />
        </div>
      )}

      {activeTab === 'kegg' && (
        <div className="space-y-5">
          <InputField label="Impedance Value" value={keggImpedance} onChange={setKeggImpedance} placeholder="1200" type="number" />
          <InputField label="Fertility Score" value={keggScore} onChange={setKeggScore} placeholder="7.5" type="number" step="0.1" />
        </div>
      )}

      {activeTab === 'symptoms' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-2.5">Cervical Mucus</label>
            <div className="grid grid-cols-3 gap-2">
              {(['not_checked', 'dry', 'sticky', 'creamy', 'watery', 'egg_white'] as MucusType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setMucus(type)}
                  className={`px-3 py-2.5 rounded-2xl text-xs font-medium border transition-all duration-200 ${
                    mucus === type
                      ? 'bg-warm-50 border-warm-300 text-warm-800'
                      : 'border-warm-200 text-warm-500 hover:bg-warm-50'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-2.5">Mood</label>
            <div className="flex flex-wrap gap-2">
              {(['great', 'good', 'okay', 'low', 'anxious', 'stressed', 'emotional'] as MoodType[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all duration-200 ${
                    mood === m
                      ? 'bg-lavender-50 border-lavender-300 text-lavender-600'
                      : 'border-warm-200 text-warm-500 hover:bg-warm-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-2.5">Energy</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setEnergy(n.toString())}
                  className={`w-11 h-11 rounded-2xl text-sm font-medium border transition-all duration-200 ${
                    energy === n.toString()
                      ? 'bg-honey-50 border-honey-300 text-honey-600'
                      : 'border-warm-200 text-warm-400 hover:bg-warm-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-2.5">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all duration-200 ${
                    symptoms.includes(s)
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'border-warm-200 text-warm-400 hover:bg-warm-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-600 focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent resize-none bg-warm-50/30"
              placeholder="Anything else to note today..."
            />
          </div>
        </div>
      )}

      {activeTab === 'intercourse' && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIntercourse(!intercourse)}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                intercourse ? 'bg-warm-400' : 'bg-warm-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm ${
                intercourse ? 'translate-x-7' : ''
              }`} />
            </button>
            <span className="text-sm text-warm-600">
              {intercourse ? 'Yes' : 'No'}
            </span>
          </div>

          {intercourse && (
            <>
              <InputField
                label="Time (approximate)"
                value={intercourseTime}
                onChange={setIntercourseTime}
                placeholder="10:30 PM"
              />
              <div>
                <label className="block text-sm font-medium text-warm-600 mb-1.5">Notes</label>
                <textarea
                  value={intercourseNotes}
                  onChange={e => setIntercourseNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-600 focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent resize-none bg-warm-50/30"
                  placeholder="Any notes..."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-7 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-7 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all duration-200 disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Saving...' : existingReading ? 'Update' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text', step }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-warm-600 mb-1.5">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
      />
    </div>
  );
}
