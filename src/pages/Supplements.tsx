import { useState } from 'react';
import { Plus, Trash2, GripVertical, Package, Leaf } from 'lucide-react';
import { useSupplements } from '../lib/hooks';
import { db } from '../lib/db';
import Modal from '../components/Modal';
import type { SupplementTiming } from '../lib/types';
import { PRESET_PROTOCOLS, PRESET_SUPPLEMENTS } from '../lib/types';

const timingOptions: { value: SupplementTiming; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'bedtime', label: 'Bedtime' },
  { value: 'with_food', label: 'With Food' },
  { value: 'empty_stomach', label: 'Empty Stomach' },
];

export default function Supplements() {
  const supplements = useSupplements();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [dose, setDose] = useState('');
  const [timing, setTiming] = useState<SupplementTiming[]>([]);
  const [mechanism, setMechanism] = useState('');
  const [cyclePhaseRules, setCyclePhaseRules] = useState('');

  async function handleAddSupplement() {
    if (!name || !dose || timing.length === 0) return;
    await db.supplements.add({
      name, brand, dose, timing, mechanism, cyclePhaseRules,
      isActive: true,
      sortOrder: supplements.length,
    });
    resetForm();
    setShowAddModal(false);
  }

  async function handleDelete(id: number) {
    await db.supplements.delete(id);
  }

  async function handleLoadPreset(presetName: string) {
    const presetSupps = PRESET_SUPPLEMENTS[presetName];
    if (!presetSupps) return;

    const protocol = await db.protocols.add({
      name: presetName,
      description: PRESET_PROTOCOLS.find(p => p.name === presetName)?.description,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    for (let i = 0; i < presetSupps.length; i++) {
      const s = presetSupps[i];
      await db.supplements.add({
        ...s,
        isActive: true,
        protocolId: protocol as number,
        sortOrder: supplements.length + i,
      });
    }
    setShowPresetModal(false);
  }

  function resetForm() {
    setName(''); setBrand(''); setDose(''); setTiming([]);
    setMechanism(''); setCyclePhaseRules('');
  }

  function toggleTiming(t: SupplementTiming) {
    setTiming(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">The Stack</h1>
          <p className="text-sm text-warm-400 mt-0.5">Your supplement protocol</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresetModal(true)}
            className="flex items-center gap-2 border border-warm-200 text-warm-600 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-50 transition-all"
          >
            <Package size={16} strokeWidth={1.5} />
            Load Protocol
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-warm-800 text-white px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {supplements.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-14 text-center shadow-sm shadow-warm-100/50">
          <div className="w-16 h-16 rounded-full bg-warm-50 flex items-center justify-center mx-auto mb-5">
            <Leaf size={28} className="text-warm-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-warm-600 mb-2">No supplements yet</h3>
          <p className="text-sm text-warm-400 max-w-md mx-auto leading-relaxed">
            Add supplements individually or load an evidence-based protocol
            tailored to your fertility profile.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-warm-100 divide-y divide-warm-100 shadow-sm shadow-warm-100/50">
          {supplements.map(sup => (
            <div key={sup.id} className="flex items-center gap-4 px-6 py-4">
              <GripVertical size={16} className="text-warm-200 shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-warm-700">{sup.name}</span>
                  {sup.brand && <span className="text-xs text-warm-400">({sup.brand})</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-warm-500 font-medium">{sup.dose}</span>
                  <span className="text-xs text-warm-300">
                    {sup.timing.map(t => timingOptions.find(o => o.value === t)?.label).join(', ')}
                  </span>
                </div>
                {sup.mechanism && (
                  <p className="text-xs text-warm-400 mt-1">{sup.mechanism}</p>
                )}
                {sup.cyclePhaseRules && (
                  <p className="text-xs text-honey-600 mt-1">{sup.cyclePhaseRules}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(sup.id!)}
                className="p-2 text-warm-300 hover:text-rose-500 rounded-xl transition-all"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplement Modal */}
      <Modal open={showAddModal} onClose={() => { resetForm(); setShowAddModal(false); }} title="Add Supplement">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Name *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
              placeholder="CoQ10 (Ubiquinol)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-1.5">Dose *</label>
              <input
                value={dose} onChange={e => setDose(e.target.value)}
                className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
                placeholder="600mg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-1.5">Brand</label>
              <input
                value={brand} onChange={e => setBrand(e.target.value)}
                className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
                placeholder="Jarrow"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-2.5">Timing *</label>
            <div className="flex flex-wrap gap-2">
              {timingOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleTiming(value)}
                  className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all duration-200 ${
                    timing.includes(value)
                      ? 'bg-warm-50 border-warm-300 text-warm-800'
                      : 'border-warm-200 text-warm-400 hover:bg-warm-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Mechanism</label>
            <input
              value={mechanism} onChange={e => setMechanism(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
              placeholder="Mitochondrial energy production, egg quality"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Cycle Phase Rules</label>
            <input
              value={cyclePhaseRules} onChange={e => setCyclePhaseRules(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
              placeholder="Pause during TWW"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { resetForm(); setShowAddModal(false); }} className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl">
              Cancel
            </button>
            <button onClick={handleAddSupplement} className="px-7 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all disabled:opacity-50 shadow-sm" disabled={!name || !dose || timing.length === 0}>
              Add Supplement
            </button>
          </div>
        </div>
      </Modal>

      {/* Preset Protocol Modal */}
      <Modal open={showPresetModal} onClose={() => setShowPresetModal(false)} title="Evidence-Based Protocols">
        <div className="space-y-3">
          <p className="text-sm text-warm-400 mb-5 leading-relaxed">
            Select a protocol to load. You can customize individual supplements afterward.
          </p>
          {PRESET_PROTOCOLS.map(p => {
            const hasSupps = !!PRESET_SUPPLEMENTS[p.name];
            return (
              <button
                key={p.name}
                onClick={() => hasSupps && handleLoadPreset(p.name)}
                disabled={!hasSupps}
                className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 ${
                  hasSupps
                    ? 'border-warm-100 hover:bg-warm-50 hover:border-warm-200'
                    : 'border-warm-100 opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="text-sm font-semibold text-warm-700">{p.name}</span>
                <p className="text-xs text-warm-400 mt-1">{p.description}</p>
                {!hasSupps && <p className="text-xs text-warm-300 italic mt-1">Coming soon</p>}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
