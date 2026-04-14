import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus, FlaskConical } from 'lucide-react';
import { useLabs } from '../lib/hooks';
import { db } from '../lib/db';
import Modal from '../components/Modal';
import { LAB_DEFINITIONS } from '../lib/types';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { LabResult } from '../lib/types';

const labCategories = [...new Set(Object.values(LAB_DEFINITIONS).map(d => d.category))];

export default function Labs() {
  const labs = useLabs();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const [testName, setTestName] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('');

  const testDef = testName ? LAB_DEFINITIONS[testName] : null;

  async function handleSave() {
    if (!testName || !value || !testDef) return;
    await db.labs.add({
      date, testName,
      category: testDef.category,
      value: parseFloat(value),
      unit: testDef.unit,
      referenceRangeLow: testDef.refLow,
      referenceRangeHigh: testDef.refHigh,
      optimalRangeLow: testDef.optimalLow,
      optimalRangeHigh: testDef.optimalHigh,
      notes: notes || undefined,
      source: source || undefined,
    });
    setTestName(''); setValue(''); setNotes(''); setSource('');
    setShowAddModal(false);
  }

  const uniqueTests = [...new Set(labs.map(l => l.testName))];
  const testForTrend = selectedTest ?? (uniqueTests.length > 0 ? uniqueTests[0] : null);
  const trendData = testForTrend
    ? labs.filter(l => l.testName === testForTrend).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Lab Tracking</h1>
          <p className="text-sm text-warm-400 mt-0.5">Fertility-optimized reference ranges</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-warm-800 text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
        >
          <Plus size={16} />
          Add Result
        </button>
      </div>

      {trendData.length > 0 && testForTrend && (
        <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm shadow-warm-100/50">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-warm-700">{testForTrend} Trend</h2>
            <select
              value={testForTrend}
              onChange={e => setSelectedTest(e.target.value)}
              className="text-sm border border-warm-200 rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-warm-300 text-warm-600 bg-warm-50/30"
            >
              {uniqueTests.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <LabTrendChart data={trendData} />
        </div>
      )}

      {labs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-14 text-center shadow-sm shadow-warm-100/50">
          <div className="w-16 h-16 rounded-full bg-lavender-50 flex items-center justify-center mx-auto mb-5">
            <FlaskConical size={28} className="text-lavender-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-warm-600 mb-2">No lab results yet</h3>
          <p className="text-sm text-warm-400 max-w-md mx-auto leading-relaxed">
            Track your fertility hormones, thyroid, metabolic, and nutritional markers
            with ranges optimized for conception.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50">
          <div className="px-6 py-4 border-b border-warm-100">
            <h2 className="text-sm font-semibold text-warm-500">Recent Results</h2>
          </div>
          <div className="divide-y divide-warm-100">
            {labs.slice(0, 20).map(lab => (
              <LabRow key={lab.id} lab={lab} />
            ))}
          </div>
        </div>
      )}

      {/* Add Lab Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Lab Result">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Test *</label>
            <select
              value={testName}
              onChange={e => setTestName(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 text-warm-600"
            >
              <option value="">Select a test...</option>
              {labCategories.map(cat => (
                <optgroup key={cat} label={cat}>
                  {Object.entries(LAB_DEFINITIONS)
                    .filter(([, def]) => def.category === cat)
                    .map(([name]) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {testDef && (
            <div className="bg-warm-50 rounded-2xl p-4 text-xs text-warm-500 space-y-1">
              <p>Reference range: {testDef.refLow} – {testDef.refHigh} {testDef.unit}</p>
              <p className="text-warm-600 font-medium">Fertility optimal: {testDef.optimalLow} – {testDef.optimalHigh} {testDef.unit}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-1.5">Value *</label>
              <input
                type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)}
                className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
                placeholder={testDef ? testDef.unit : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-1.5">Date *</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Source</label>
            <input
              value={source} onChange={e => setSource(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
              placeholder="Quest Diagnostics, LabCorp, VA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent resize-none bg-warm-50/30 placeholder:text-warm-300"
              placeholder="Fasting, time of day, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm text-warm-400 rounded-2xl">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!testName || !value}
              className="px-7 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all disabled:opacity-50 shadow-sm"
            >
              Save Result
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LabRow({ lab }: { lab: LabResult }) {
  const isOptimal = lab.optimalRangeLow != null && lab.optimalRangeHigh != null &&
    lab.value >= lab.optimalRangeLow && lab.value <= lab.optimalRangeHigh;
  const isInRef = lab.referenceRangeLow != null && lab.referenceRangeHigh != null &&
    lab.value >= lab.referenceRangeLow && lab.value <= lab.referenceRangeHigh;
  const isLow = lab.referenceRangeLow != null && lab.value < lab.referenceRangeLow;

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        isOptimal ? 'bg-teal-400' : isInRef ? 'bg-honey-400' : 'bg-rose-400'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-warm-700">{lab.testName}</span>
          <span className="text-xs text-warm-300">{format(new Date(lab.date + 'T00:00:00'), 'MMM d, yyyy')}</span>
        </div>
        <span className="text-xs text-warm-400">{lab.category}</span>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${isOptimal ? 'text-warm-600' : isInRef ? 'text-honey-600' : 'text-rose-500'}`}>
            {lab.value}
          </span>
          <span className="text-xs text-warm-400">{lab.unit}</span>
          {isLow ? <TrendingDown size={14} className="text-rose-400" strokeWidth={1.5} /> :
           !isInRef ? <TrendingUp size={14} className="text-rose-400" strokeWidth={1.5} /> :
           <Minus size={14} className="text-warm-200" strokeWidth={1.5} />}
        </div>
        <span className="text-xs text-warm-300">
          Optimal: {lab.optimalRangeLow}–{lab.optimalRangeHigh}
        </span>
      </div>
    </div>
  );
}

function LabTrendChart({ data }: { data: LabResult[] }) {
  if (data.length === 0) return null;

  const chartData = data.map(d => ({
    date: format(new Date(d.date + 'T00:00:00'), 'MMM d'),
    value: d.value,
  }));

  const first = data[0];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#ede9e7" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a69e9b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#a69e9b' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'white', border: '1px solid #ede9e7', borderRadius: '16px', fontSize: '11px', boxShadow: '0 8px 24px rgba(44,38,36,0.06)' }}
        />

        {first.optimalRangeLow != null && first.optimalRangeHigh != null && (
          <ReferenceArea
            y1={first.optimalRangeLow}
            y2={first.optimalRangeHigh}
            fill="#0d9488"
            fillOpacity={0.08}
            label={{ value: 'Optimal', position: 'insideTopRight', fontSize: 10, fill: '#0d9488' }}
          />
        )}

        {first.referenceRangeLow != null && (
          <ReferenceLine y={first.referenceRangeLow} stroke="#c4bebb" strokeDasharray="4 4" />
        )}
        {first.referenceRangeHigh != null && (
          <ReferenceLine y={first.referenceRangeHigh} stroke="#c4bebb" strokeDasharray="4 4" />
        )}

        <Line
          type="natural"
          dataKey="value"
          stroke="#0d9488"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#0d9488', stroke: 'white', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
