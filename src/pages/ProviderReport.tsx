import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, subMonths, differenceInDays } from 'date-fns';
import { Printer, FileText, Sparkles, Check, Calendar, User, Download } from 'lucide-react';
import type { Cycle, DailyReading, LabResult } from '../lib/types';
import { generateProviderPdf, providerPdfFilename } from '../lib/provider-pdf';

type DateRangeOption = '1cycle' | '3cycles' | '6months' | 'custom';

interface IncludeOptions {
  cycleSummary: boolean;
  hormoneData: boolean;
  bbtData: boolean;
  labResults: boolean;
  supplementProtocol: boolean;
  symptomsLog: boolean;
}

const TIMING_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  bedtime: 'Bedtime',
  with_food: 'With Food',
  empty_stomach: 'Empty Stomach',
};

function getLabStatus(lab: LabResult): 'optimal' | 'in-range' | 'out-of-range' {
  if (
    lab.optimalRangeLow != null &&
    lab.optimalRangeHigh != null &&
    lab.value >= lab.optimalRangeLow &&
    lab.value <= lab.optimalRangeHigh
  ) {
    return 'optimal';
  }
  if (
    lab.referenceRangeLow != null &&
    lab.referenceRangeHigh != null &&
    lab.value >= lab.referenceRangeLow &&
    lab.value <= lab.referenceRangeHigh
  ) {
    return 'in-range';
  }
  return 'out-of-range';
}

const statusColors = {
  'optimal': { bg: '#ecfdf5', text: '#065f46', dot: '#10b981' },
  'in-range': { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  'out-of-range': { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
} as const;

const statusLabels = {
  'optimal': 'Optimal',
  'in-range': 'In Range',
  'out-of-range': 'Out of Range',
} as const;

export default function ProviderReport() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('3cycles');
  const [customStart, setCustomStart] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [include, setInclude] = useState<IncludeOptions>({
    cycleSummary: true,
    hormoneData: true,
    bbtData: true,
    labResults: true,
    supplementProtocol: true,
    symptomsLog: true,
  });
  const [providerName, setProviderName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const allCycles = useLiveQuery(() =>
    db.cycles.orderBy('startDate').reverse().toArray()
  ) ?? [];

  const allLabs = useLiveQuery(() =>
    db.labs.orderBy('date').reverse().toArray()
  ) ?? [];

  const activeSupplements = useLiveQuery(() =>
    db.supplements.where('isActive').equals(1).toArray()
  ) ?? [];

  const filteredCycles = useMemo(() => {
    if (dateRange === '1cycle') return allCycles.slice(0, 1);
    if (dateRange === '3cycles') return allCycles.slice(0, 3);
    if (dateRange === '6months') {
      const cutoff = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
      return allCycles.filter(c => c.startDate >= cutoff);
    }
    return allCycles.filter(
      c => c.startDate >= customStart && c.startDate <= customEnd
    );
  }, [allCycles, dateRange, customStart, customEnd]);

  const cycleIds = filteredCycles.map(c => c.id).filter((id): id is number => id != null);

  const allReadings = (useLiveQuery(
    () =>
      cycleIds.length > 0
        ? db.readings
            .where('cycleId')
            .anyOf(cycleIds)
            .toArray()
        : Promise.resolve([] as DailyReading[]),
    [cycleIds.join(',')]
  ) ?? []) as DailyReading[];

  const readingsByCycle = useMemo(() => {
    const map = new Map<number, DailyReading[]>();
    for (const r of allReadings) {
      const arr = map.get(r.cycleId) ?? [];
      arr.push(r);
      map.set(r.cycleId, arr);
    }
    for (const [key, arr] of map) {
      map.set(key, arr.sort((a, b) => a.cycleDay - b.cycleDay));
    }
    return map;
  }, [allReadings]);

  const latestLabs = useMemo(() => {
    const map = new Map<string, LabResult>();
    for (const lab of allLabs) {
      if (!map.has(lab.testName)) {
        map.set(lab.testName, lab);
      }
    }
    return Array.from(map.values());
  }, [allLabs]);

  function toggleInclude(key: keyof IncludeOptions) {
    setInclude(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    const ongoing = allCycles.find(c => c.outcome === 'ongoing') ?? null;
    let currentCycleDay: number | null = null;
    if (ongoing) {
      const start = new Date(ongoing.startDate + 'T00:00:00').getTime();
      const today = new Date().getTime();
      currentCycleDay = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    const completed = allCycles.filter(c => c.outcome !== 'ongoing');
    const lengths = completed
      .map(c => (c.endDate ? (differenceInDays(new Date(c.endDate + 'T00:00:00'), new Date(c.startDate + 'T00:00:00')) + 1) : null))
      .filter((n): n is number => n != null);
    const avg = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
    const lutealLens = completed.map(c => c.lutealPhaseDays).filter((n): n is number => n != null);
    const avgLuteal = lutealLens.length > 0 ? lutealLens.reduce((a, b) => a + b, 0) / lutealLens.length : null;
    const follicularLens = completed.map(c => c.follicularPhaseDays).filter((n): n is number => n != null);
    const avgFollicular = follicularLens.length > 0 ? follicularLens.reduce((a, b) => a + b, 0) / follicularLens.length : null;

    const name = 'Patient'; // iyla-local; no real PII stored centrally
    generateProviderPdf({
      userName: name,
      generatedOn: format(new Date(), 'yyyy-MM-dd'),
      cycles: filteredCycles,
      readings: allReadings,
      labs: allLabs,
      supplements: activeSupplements,
      summary: {
        currentCycleDay,
        currentCycleStart: ongoing?.startDate ?? null,
        avgCycleLength: avg,
        avgLutealPhase: avgLuteal,
        avgFollicularPhase: avgFollicular,
        totalCyclesTracked: allCycles.length,
      },
    });
    // Trigger filename prompt (best-effort — jsPDF already sets the filename)
    providerPdfFilename(name);
  }

  function getCycleLength(cycle: Cycle): number {
    const start = new Date(cycle.startDate + 'T00:00:00');
    const end = cycle.endDate ? new Date(cycle.endDate + 'T00:00:00') : new Date();
    return differenceInDays(end, start) + 1;
  }

  function getOutcomeLabel(outcome: string): string {
    const labels: Record<string, string> = {
      ongoing: 'Ongoing',
      negative: 'Not Pregnant',
      positive: 'Positive',
      chemical: 'Chemical Pregnancy',
      miscarriage: 'Loss',
    };
    return labels[outcome] ?? outcome;
  }

  function computeHormoneData(cycle: Cycle) {
    const readings = readingsByCycle.get(cycle.id!) ?? [];
    const lhReadings = readings.filter(r => r.lh != null);
    const e3gReadings = readings.filter(r => r.e3g != null);
    const pdgReadings = readings.filter(r => r.pdg != null);

    const peakLH = lhReadings.length > 0
      ? lhReadings.reduce((max, r) => (r.lh! > max.lh! ? r : max), lhReadings[0])
      : null;
    const peakE3G = e3gReadings.length > 0
      ? e3gReadings.reduce((max, r) => (r.e3g! > max.e3g! ? r : max), e3gReadings[0])
      : null;
    const peakPdG = pdgReadings.length > 0
      ? pdgReadings.reduce((max, r) => (r.pdg! > max.pdg! ? r : max), pdgReadings[0])
      : null;

    const concordant =
      peakLH && peakE3G && cycle.ovulationDay
        ? Math.abs(peakLH.cycleDay - cycle.ovulationDay) <= 2 &&
          peakE3G.cycleDay <= cycle.ovulationDay
        : null;

    return { peakLH, peakE3G, peakPdG, concordant };
  }

  function computeBBTData() {
    let follicularTemps: number[] = [];
    let lutealTemps: number[] = [];

    for (const cycle of filteredCycles) {
      const readings = readingsByCycle.get(cycle.id!) ?? [];
      const ovDay = cycle.ovulationDay;
      for (const r of readings) {
        if (r.bbt == null) continue;
        if (ovDay && r.cycleDay <= ovDay) follicularTemps.push(r.bbt);
        else if (ovDay && r.cycleDay > ovDay) lutealTemps.push(r.bbt);
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    const avgFollicular = avg(follicularTemps);
    const avgLuteal = avg(lutealTemps);
    const thermalShift =
      avgFollicular != null && avgLuteal != null ? avgLuteal - avgFollicular : null;

    return { avgFollicular, avgLuteal, thermalShift, follicularCount: follicularTemps.length, lutealCount: lutealTemps.length };
  }

  function computeSymptoms() {
    const symptomCounts = new Map<string, number>();
    for (const cycle of filteredCycles) {
      const readings = readingsByCycle.get(cycle.id!) ?? [];
      for (const r of readings) {
        if (r.symptoms) {
          for (const s of r.symptoms) {
            symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(symptomCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }

  const includeOptions: { key: keyof IncludeOptions; label: string }[] = [
    { key: 'cycleSummary', label: 'Cycle summary' },
    { key: 'hormoneData', label: 'Hormone data' },
    { key: 'bbtData', label: 'BBT data' },
    { key: 'labResults', label: 'Lab results' },
    { key: 'supplementProtocol', label: 'Supplement protocol' },
    { key: 'symptomsLog', label: 'Symptoms log' },
  ];

  const bbtData = computeBBTData();
  const symptoms = computeSymptoms();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .provider-report-preview,
          .provider-report-preview * { visibility: visible; }
          .provider-report-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print { display: none !important; }
          nav, aside, header,
          [class*="sidebar"], [class*="mobile"] { display: none !important; }
        }
      `}</style>

      <div className="space-y-7">
        {/* Page Header */}
        <div className="no-print">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-warm-800">Provider Report</h1>
              <p className="text-sm text-warm-400 mt-0.5">
                Generate a printable summary for your appointment
              </p>
            </div>
            {showPreview && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 bg-warm-100 text-warm-700 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-200 transition-all"
                >
                  <Download size={16} strokeWidth={1.5} />
                  Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-warm-800 text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
                >
                  <Printer size={16} strokeWidth={1.5} />
                  Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 no-print">
          <div className="px-6 py-5 border-b border-warm-100">
            <h2 className="text-base font-semibold text-warm-700 flex items-center gap-2">
              <FileText size={18} strokeWidth={1.5} className="text-warm-400" />
              Report Configuration
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-2.5">
                Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['1cycle', 'Last 1 Cycle'],
                  ['3cycles', 'Last 3 Cycles'],
                  ['6months', 'Last 6 Months'],
                  ['custom', 'Custom Range'],
                ] as [DateRangeOption, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setDateRange(value)}
                    className={`px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 ${
                      dateRange === value
                        ? 'bg-warm-50 border-warm-300 text-warm-800'
                        : 'border-warm-200 text-warm-400 hover:bg-warm-50 hover:text-warm-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-warm-500 mb-1">Start</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-500 mb-1">End</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Include Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-warm-600 mb-2.5">
                Include in Report
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {includeOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleInclude(key)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm border transition-all duration-200 ${
                      include[key]
                        ? 'bg-warm-50 border-warm-300 text-warm-700 font-medium'
                        : 'border-warm-200 text-warm-400 hover:bg-warm-50'
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                        include[key]
                          ? 'bg-warm-700 text-white'
                          : 'border border-warm-300 bg-white'
                      }`}
                      style={{ width: 18, height: 18 }}
                    >
                      {include[key] && <Check size={12} strokeWidth={2.5} />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider & Appointment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-warm-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User size={14} strokeWidth={1.5} />
                    Provider Name
                  </span>
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={e => setProviderName(e.target.value)}
                  placeholder="Dr. Smith"
                  className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30 placeholder:text-warm-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} strokeWidth={1.5} />
                    Appointment Date
                  </span>
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30"
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 bg-warm-800 text-white px-7 py-3 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
              >
                <FileText size={16} strokeWidth={1.5} />
                Generate Report Preview
              </button>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        {showPreview && (
          <div className="provider-report-preview bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 overflow-hidden">
            <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: '#1a1a1a', fontSize: 13, lineHeight: 1.6 }}>
              {/* Report Header */}
              <div style={{ borderBottom: '2px solid #e5e5e5', padding: '32px 36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #2dd4bf, #22d3ee)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={16} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a1a', letterSpacing: '-0.02em' }}>
                      iyla Fertility Report
                    </h1>
                    <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.04em' }}>
                      Solairen Health
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>
                  {providerName && appointmentDate && (
                    <p style={{ margin: 0 }}>
                      Prepared for appointment with <strong style={{ color: '#333' }}>{providerName}</strong> on{' '}
                      <strong style={{ color: '#333' }}>
                        {format(new Date(appointmentDate + 'T00:00:00'), 'MMMM d, yyyy')}
                      </strong>
                    </p>
                  )}
                  {providerName && !appointmentDate && (
                    <p style={{ margin: 0 }}>
                      Prepared for <strong style={{ color: '#333' }}>{providerName}</strong>
                    </p>
                  )}
                  <p style={{ margin: 0, color: '#999', fontSize: 11 }}>
                    Report generated {format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}
                    {' '}&middot;{' '}
                    {filteredCycles.length} cycle{filteredCycles.length !== 1 ? 's' : ''} included
                  </p>
                </div>
              </div>

              <div style={{ padding: '28px 36px 36px' }}>
                {/* Cycle Summary */}
                {include.cycleSummary && filteredCycles.length > 0 && (
                  <ReportSection title="Cycle Summary">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                          {['Start Date', 'Length', 'Ovulation Day', 'Luteal Phase', 'Outcome'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCycles.map(cycle => (
                          <tr key={cycle.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '10px 12px 10px 0', fontWeight: 500 }}>
                              {format(new Date(cycle.startDate + 'T00:00:00'), 'MMM d, yyyy')}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                              {getCycleLength(cycle)} days
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                              {cycle.ovulationDay ? `CD ${cycle.ovulationDay}` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                              {cycle.lutealPhaseDays ? `${cycle.lutealPhaseDays} days` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                              {getOutcomeLabel(cycle.outcome)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {/* Hormone Data */}
                {include.hormoneData && filteredCycles.length > 0 && (
                  <ReportSection title="Hormone Data (Inito)">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                          {['Cycle Start', 'LH Surge Day', 'Peak E3G', 'Peak PdG', 'Signal Concordance'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCycles.map(cycle => {
                          const h = computeHormoneData(cycle);
                          const hasData = h.peakLH || h.peakE3G || h.peakPdG;
                          if (!hasData) return (
                            <tr key={cycle.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px 12px 10px 0', fontWeight: 500 }}>
                                {format(new Date(cycle.startDate + 'T00:00:00'), 'MMM d')}
                              </td>
                              <td colSpan={4} style={{ padding: '10px 0', color: '#999', fontStyle: 'italic' }}>
                                No hormone data recorded
                              </td>
                            </tr>
                          );
                          return (
                            <tr key={cycle.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px 12px 10px 0', fontWeight: 500 }}>
                                {format(new Date(cycle.startDate + 'T00:00:00'), 'MMM d')}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>
                                {h.peakLH ? `CD ${h.peakLH.cycleDay} (${h.peakLH.lh!.toFixed(1)} mIU/mL)` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>
                                {h.peakE3G ? `${h.peakE3G.e3g!.toFixed(1)} ng/mL (CD ${h.peakE3G.cycleDay})` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>
                                {h.peakPdG ? `${h.peakPdG.pdg!.toFixed(1)} µg/mL (CD ${h.peakPdG.cycleDay})` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>
                                {h.concordant === null ? '—' : (
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: h.concordant ? '#ecfdf5' : '#fef2f2',
                                    color: h.concordant ? '#065f46' : '#991b1b',
                                  }}>
                                    {h.concordant ? 'Concordant' : 'Discordant'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {/* BBT Overview */}
                {include.bbtData && (
                  <ReportSection title="BBT Overview (TempDrop)">
                    {bbtData.follicularCount === 0 && bbtData.lutealCount === 0 ? (
                      <p style={{ color: '#999', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
                        No BBT data recorded for the selected period.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <StatCard
                          label="Avg. Follicular Temp"
                          value={bbtData.avgFollicular != null ? `${bbtData.avgFollicular.toFixed(2)}°F` : '—'}
                          sub={`${bbtData.follicularCount} readings`}
                        />
                        <StatCard
                          label="Avg. Luteal Temp"
                          value={bbtData.avgLuteal != null ? `${bbtData.avgLuteal.toFixed(2)}°F` : '—'}
                          sub={`${bbtData.lutealCount} readings`}
                        />
                        <StatCard
                          label="Thermal Shift"
                          value={bbtData.thermalShift != null ? `+${bbtData.thermalShift.toFixed(2)}°F` : '—'}
                          sub={bbtData.thermalShift != null && bbtData.thermalShift >= 0.2 ? 'Adequate shift' : bbtData.thermalShift != null ? 'Below 0.2°F threshold' : ''}
                        />
                      </div>
                    )}
                  </ReportSection>
                )}

                {/* Lab Results */}
                {include.labResults && latestLabs.length > 0 && (
                  <ReportSection title="Lab Results (Most Recent)">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                          {['Test', 'Value', 'Optimal Range', 'Date', 'Status'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {latestLabs.map(lab => {
                          const status = getLabStatus(lab);
                          const colors = statusColors[status];
                          return (
                            <tr key={lab.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px 12px 10px 0', fontWeight: 500 }}>
                                {lab.testName}
                                <span style={{ display: 'block', fontSize: 10, color: '#999', fontWeight: 400 }}>{lab.category}</span>
                              </td>
                              <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>
                                {lab.value} <span style={{ fontWeight: 400, color: '#999' }}>{lab.unit}</span>
                              </td>
                              <td style={{ padding: '10px 12px 10px 0', color: '#777' }}>
                                {lab.optimalRangeLow != null && lab.optimalRangeHigh != null
                                  ? `${lab.optimalRangeLow}–${lab.optimalRangeHigh} ${lab.unit}`
                                  : '—'}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0', color: '#777' }}>
                                {format(new Date(lab.date + 'T00:00:00'), 'MMM d, yyyy')}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: colors.bg,
                                  color: colors.text,
                                }}>
                                  <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: colors.dot, display: 'inline-block',
                                  }} />
                                  {statusLabels[status]}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {include.labResults && latestLabs.length === 0 && (
                  <ReportSection title="Lab Results">
                    <p style={{ color: '#999', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
                      No lab results recorded.
                    </p>
                  </ReportSection>
                )}

                {/* Supplement Protocol */}
                {include.supplementProtocol && (
                  <ReportSection title="Current Supplement Protocol">
                    {activeSupplements.length === 0 ? (
                      <p style={{ color: '#999', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
                        No active supplements recorded.
                      </p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                            {['Supplement', 'Dose', 'Timing', 'Notes'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeSupplements.map(sup => (
                            <tr key={sup.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px 12px 10px 0', fontWeight: 500 }}>
                                {sup.name}
                                {sup.brand && (
                                  <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}> ({sup.brand})</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0' }}>{sup.dose}</td>
                              <td style={{ padding: '10px 12px 10px 0', color: '#555' }}>
                                {sup.timing.map(t => TIMING_LABELS[t] ?? t).join(', ')}
                              </td>
                              <td style={{ padding: '10px 12px 10px 0', color: '#777', fontSize: 11 }}>
                                {sup.cyclePhaseRules || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </ReportSection>
                )}

                {/* Symptoms Log */}
                {include.symptomsLog && symptoms.length > 0 && (
                  <ReportSection title="Most Reported Symptoms">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {symptoms.map(([symptom, count]) => (
                        <span
                          key={symptom}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            background: '#f5f5f5',
                            color: '#444',
                            fontWeight: 500,
                          }}
                        >
                          {symptom}
                          <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
                            {count}x
                          </span>
                        </span>
                      ))}
                    </div>
                  </ReportSection>
                )}

                {/* Footer */}
                <div style={{ marginTop: 32, paddingTop: 20, borderTop: '2px solid #e5e5e5' }}>
                  <p style={{ fontSize: 10, color: '#999', margin: '0 0 4px', lineHeight: 1.6 }}>
                    Generated by iyla (Solairen Health). This report is informational and does not constitute medical advice.
                  </p>
                  <p style={{ fontSize: 10, color: '#bbb', margin: 0, lineHeight: 1.6 }}>
                    Data is self-reported from Inito, TempDrop, Kegg, and manual entry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: 14, fontWeight: 700, color: '#333', margin: '0 0 14px',
        paddingBottom: 8, borderBottom: '1px solid #eee',
        textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{
      padding: 16, border: '1px solid #eee', borderRadius: 10,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>{sub}</p>
      )}
    </div>
  );
}
