import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Cycle, DailyReading, LabResult, Supplement } from './types';

export interface ProviderPdfInput {
  userName: string;
  userAge?: number;
  generatedOn: string;
  cycles: Cycle[];
  readings: DailyReading[];
  labs: LabResult[];
  supplements: Supplement[];
  summary: {
    currentCycleDay: number | null;
    currentCycleStart: string | null;
    avgCycleLength: number | null;
    avgLutealPhase: number | null;
    avgFollicularPhase: number | null;
    totalCyclesTracked: number;
  };
  notes?: string;
}

// ---------- palette (warm + accent) ----------
const WARM_900: [number, number, number] = [41, 37, 36];
const WARM_800: [number, number, number] = [68, 64, 60];
const WARM_700: [number, number, number] = [68, 64, 60];
const WARM_600: [number, number, number] = [87, 83, 78];
const WARM_500: [number, number, number] = [120, 113, 108];
const WARM_400: [number, number, number] = [168, 162, 158];
const WARM_300: [number, number, number] = [214, 211, 209];
const WARM_100: [number, number, number] = [245, 245, 244];
const WARM_50: [number, number, number] = [250, 250, 249];
const EMERALD: [number, number, number] = [16, 150, 108];
const AMBER: [number, number, number] = [202, 138, 4];
const ROSE: [number, number, number] = [225, 29, 72];

// page geometry (A4 portrait, mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setText(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function setDraw(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function sanitizeSlug(name: string | null): string {
  const raw = (name ?? 'patient').trim().toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'patient';
}

export function providerPdfFilename(userName: string | null): string {
  const slug = sanitizeSlug(userName);
  const date = new Date().toISOString().slice(0, 10);
  return `iyla-report-${slug}-${date}.pdf`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function round1(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function cycleLength(c: Cycle): number | null {
  if (!c.endDate) return null;
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function outcomeLabel(o: Cycle['outcome']): string {
  switch (o) {
    case 'ongoing': return 'Ongoing';
    case 'negative': return 'Not pregnant';
    case 'chemical': return 'Chemical';
    case 'positive': return 'Positive';
    case 'miscarriage': return 'Loss';
    default: return String(o);
  }
}

function labStatus(lab: LabResult): { status: 'optimal' | 'in-ref' | 'out-of-ref'; label: string } {
  const {
    value, referenceRangeLow, referenceRangeHigh, optimalRangeLow, optimalRangeHigh,
  } = lab;
  if (referenceRangeLow != null && referenceRangeHigh != null) {
    if (value < referenceRangeLow || value > referenceRangeHigh) {
      return { status: 'out-of-ref', label: 'Out of range' };
    }
  }
  if (optimalRangeLow != null && optimalRangeHigh != null) {
    if (value >= optimalRangeLow && value <= optimalRangeHigh) {
      return { status: 'optimal', label: 'In optimal' };
    }
    return { status: 'in-ref', label: 'In reference' };
  }
  return { status: 'in-ref', label: 'In reference' };
}

function latestLabs(labs: LabResult[]): LabResult[] {
  const byName = new Map<string, LabResult>();
  for (const l of labs) {
    const prev = byName.get(l.testName);
    if (!prev || new Date(l.date).getTime() > new Date(prev.date).getTime()) {
      byName.set(l.testName, l);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.category.localeCompare(b.category) || a.testName.localeCompare(b.testName));
}

function fertilityStatusShort(s?: DailyReading['fertilityStatus']): string {
  if (!s) return '—';
  switch (s) {
    case 'low': return 'Low';
    case 'rising': return 'Rising';
    case 'high': return 'High';
    case 'peak': return 'Peak';
    case 'confirmed_ovulation': return 'Ov+';
    case 'luteal': return 'Luteal';
    case 'menstrual': return 'Menses';
    default: return String(s);
  }
}

function mucusShort(m?: DailyReading['cervicalMucus']): string {
  if (!m || m === 'not_checked') return '—';
  switch (m) {
    case 'dry': return 'Dry';
    case 'sticky': return 'Sticky';
    case 'creamy': return 'Creamy';
    case 'watery': return 'Watery';
    case 'egg_white': return 'EWCM';
    default: return String(m);
  }
}

// ---------- sections ----------

function drawHeader(doc: jsPDF, input: ProviderPdfInput): number {
  setText(doc, WARM_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('iyla Clinical Summary', MARGIN, MARGIN + 4);

  setText(doc, WARM_500);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subLine = input.userName
    ? `Prepared for: ${input.userName}${input.userAge ? `, Age ${input.userAge}` : ''}`
    : 'Prepared for: iyla member';
  doc.text(subLine, MARGIN, MARGIN + 11);
  doc.text(`Generated: ${formatDate(input.generatedOn)}`, MARGIN, MARGIN + 16);

  setText(doc, WARM_400);
  doc.setFontSize(8);
  doc.text('Powered by iyla — by Solairen Health', PAGE_W - MARGIN, MARGIN + 16, { align: 'right' });

  // rule
  setDraw(doc, WARM_300);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, MARGIN + 20, PAGE_W - MARGIN, MARGIN + 20);

  return MARGIN + 25;
}

function drawTwoColumnSummary(doc: jsPDF, input: ProviderPdfInput, startY: number): number {
  const colW = (CONTENT_W - 6) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 6;
  const boxH = 44;

  // left column — patient
  setFill(doc, WARM_50);
  setDraw(doc, WARM_100);
  doc.setLineWidth(0.2);
  doc.roundedRect(leftX, startY, colW, boxH, 2, 2, 'FD');

  setText(doc, WARM_400);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PATIENT', leftX + 4, startY + 6);

  setText(doc, WARM_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(input.userName || 'iyla member', leftX + 4, startY + 13);

  setText(doc, WARM_600);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let py = startY + 20;
  if (input.userAge != null) {
    doc.text(`Age: ${input.userAge}`, leftX + 4, py);
    py += 5;
  }
  doc.text('Data source: self-reported home monitoring', leftX + 4, py);
  py += 5;
  setText(doc, WARM_400);
  doc.setFontSize(8);
  doc.text('(TempDrop, Inito, Kegg, manual observations)', leftX + 4, py);

  // right column — cycle stats
  setFill(doc, WARM_50);
  setDraw(doc, WARM_100);
  doc.roundedRect(rightX, startY, colW, boxH, 2, 2, 'FD');

  setText(doc, WARM_400);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CYCLE STATS', rightX + 4, startY + 6);

  const lengths = input.cycles.map(cycleLength).filter((n): n is number => n != null);
  const sd = stddev(lengths);

  const rows: Array<[string, string]> = [
    ['Total cycles tracked', String(input.summary.totalCyclesTracked)],
    [
      'Avg cycle length',
      input.summary.avgCycleLength != null
        ? `${round1(input.summary.avgCycleLength)}${sd != null ? ` ± ${round1(sd)}` : ''} d`
        : '—',
    ],
    ['Avg luteal phase', input.summary.avgLutealPhase != null ? `${round1(input.summary.avgLutealPhase)} d` : '—'],
    ['Avg follicular phase', input.summary.avgFollicularPhase != null ? `${round1(input.summary.avgFollicularPhase)} d` : '—'],
    [
      'Current cycle day',
      input.summary.currentCycleDay != null
        ? `CD${input.summary.currentCycleDay}${input.summary.currentCycleStart ? ` (start ${formatShortDate(input.summary.currentCycleStart)})` : ''}`
        : '—',
    ],
  ];

  let ry = startY + 13;
  rows.forEach(([label, value]) => {
    setText(doc, WARM_500);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, rightX + 4, ry);
    setText(doc, WARM_900);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX + colW - 4, ry, { align: 'right' });
    ry += 6;
  });

  return startY + boxH + 6;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  setText(doc, WARM_400);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(title.toUpperCase(), MARGIN, y);
  setDraw(doc, WARM_100);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 1.5, PAGE_W - MARGIN, y + 1.5);
  return y + 6;
}

function drawCycleHistoryTable(doc: jsPDF, input: ProviderPdfInput, startY: number): number {
  const sorted = [...input.cycles].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).slice(0, 6);

  const body = sorted.map((c, idx) => {
    const pos = input.cycles.length - input.cycles
      .slice()
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .findIndex((cc) => cc.id === c.id);
    const len = cycleLength(c);
    const ongoing = c.outcome === 'ongoing' || !c.endDate;
    return {
      ongoing,
      cells: [
        `#${pos > 0 ? pos : sorted.length - idx}`,
        formatDate(c.startDate),
        ongoing ? 'ongoing' : formatDate(c.endDate),
        ongoing ? '—' : (len != null ? String(len) : '—'),
        c.lutealPhaseDays != null ? String(c.lutealPhaseDays) : '—',
        outcomeLabel(c.outcome),
      ],
    };
  });

  let y = drawSectionTitle(doc, 'Recent cycle history', startY);

  if (body.length === 0) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No cycles logged yet.', MARGIN, y + 3);
    return y + 10;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Cycle', 'Start', 'End', 'Length (d)', 'Luteal (d)', 'Outcome']],
    body: body.map((r) => r.cells),
    headStyles: { fillColor: WARM_800, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: WARM_50 },
    styles: { fontSize: 9, textColor: WARM_700, cellPadding: 2.2, lineColor: WARM_100, lineWidth: 0.1 },
    didParseCell: (data) => {
      if (data.section === 'body' && body[data.row.index]?.ongoing) {
        data.cell.styles.fontStyle = 'italic';
        data.cell.styles.textColor = WARM_500;
      }
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

function drawLabsTable(doc: jsPDF, input: ProviderPdfInput, startY: number): number {
  const latest = latestLabs(input.labs);

  let y = drawSectionTitle(doc, 'Key lab values (latest per test)', startY);

  if (latest.length === 0) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No labs logged.', MARGIN, y + 3);
    return y + 10;
  }

  const body = latest.map((lab) => {
    const status = labStatus(lab);
    const ref = (lab.referenceRangeLow != null && lab.referenceRangeHigh != null)
      ? `${lab.referenceRangeLow}–${lab.referenceRangeHigh}`
      : '—';
    const optimal = (lab.optimalRangeLow != null && lab.optimalRangeHigh != null)
      ? `${lab.optimalRangeLow}–${lab.optimalRangeHigh}`
      : '—';
    return {
      status,
      cells: [
        lab.testName,
        round1(lab.value),
        lab.unit,
        ref,
        optimal,
        status.label,
        formatShortDate(lab.date),
      ],
    };
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Test', 'Value', 'Unit', 'Ref range', 'Optimal', 'Status', 'Date']],
    body: body.map((r) => r.cells),
    headStyles: { fillColor: WARM_800, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: WARM_50 },
    styles: { fontSize: 8.5, textColor: WARM_700, cellPadding: 2, lineColor: WARM_100, lineWidth: 0.1 },
    columnStyles: {
      1: { halign: 'right' },
      5: { fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const row = body[data.row.index];
        if (!row) return;
        if (row.status.status === 'optimal') {
          data.cell.styles.textColor = EMERALD;
        } else if (row.status.status === 'in-ref') {
          data.cell.styles.textColor = AMBER;
        } else {
          data.cell.styles.textColor = ROSE;
        }
      }
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

function drawCurrentCycleReadings(doc: jsPDF, input: ProviderPdfInput, startY: number): number {
  const ongoing = input.cycles.find((c) => c.outcome === 'ongoing' && !c.endDate)
    ?? [...input.cycles].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

  let y = drawSectionTitle(doc, 'Current cycle daily readings', startY);

  if (!ongoing || ongoing.id == null) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No active cycle readings.', MARGIN, y + 3);
    return y + 10;
  }

  const readings = input.readings
    .filter((r) => r.cycleId === ongoing.id)
    .sort((a, b) => a.cycleDay - b.cycleDay);

  if (readings.length === 0) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No readings logged for the current cycle yet.', MARGIN, y + 3);
    return y + 10;
  }

  const MAX = 40;
  const shown = readings.slice(0, MAX);
  const extra = readings.length - shown.length;

  const body = shown.map((r) => [
    String(r.cycleDay),
    formatShortDate(r.date),
    r.bbt != null ? r.bbt.toFixed(2) : '—',
    r.lh != null ? round1(r.lh) : '—',
    r.e3g != null ? round1(r.e3g) : '—',
    r.pdg != null ? round1(r.pdg) : '—',
    r.keggImpedance != null ? round1(r.keggImpedance) : '—',
    mucusShort(r.cervicalMucus),
    fertilityStatusShort(r.fertilityStatus),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['CD', 'Date', 'BBT', 'LH', 'E3G', 'PdG', 'Kegg Imp', 'Mucus', 'Status']],
    body,
    headStyles: { fillColor: WARM_800, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: WARM_50 },
    styles: { fontSize: 8, textColor: WARM_700, cellPadding: 1.8, lineColor: WARM_100, lineWidth: 0.1 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  if (extra > 0) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(`+ ${extra} more reading${extra === 1 ? '' : 's'} (truncated for print).`, MARGIN, finalY + 4);
    finalY += 4;
  }

  return finalY + 8;
}

function drawSupplements(doc: jsPDF, input: ProviderPdfInput, startY: number): number {
  const active = input.supplements.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  let y = drawSectionTitle(doc, 'Active supplement protocol', startY);

  if (active.length === 0) {
    setText(doc, WARM_400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No active supplements.', MARGIN, y + 3);
    return y + 10;
  }

  setText(doc, WARM_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const s of active) {
    y = ensureSpace(doc, y, 6);
    const timing = s.timing.length > 0 ? s.timing.join(', ') : 'flexible';
    const line = `•  ${s.name} — ${s.dose} (${timing})`;
    const wrapped = doc.splitTextToSize(line, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4.5 + 1.2;
  }

  return y + 4;
}

function drawNotes(doc: jsPDF, notes: string, startY: number): number {
  let y = drawSectionTitle(doc, 'Clinical notes', startY);
  setText(doc, WARM_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const wrapped = doc.splitTextToSize(notes, CONTENT_W);
  y = ensureSpace(doc, y, wrapped.length * 5 + 4);
  doc.text(wrapped, MARGIN, y);
  return y + wrapped.length * 5 + 4;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const footerZone = PAGE_H - MARGIN - 10;
  if (y + needed > footerZone) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

function drawFooters(doc: jsPDF, input: ProviderPdfInput) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setDraw(doc, WARM_100);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - MARGIN - 8, PAGE_W - MARGIN, PAGE_H - MARGIN - 8);

    setText(doc, WARM_400);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const leftLabel = `iyla Clinical Summary — ${input.userName || 'iyla member'}`;
    doc.text(leftLabel, MARGIN, PAGE_H - MARGIN - 4);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 4, { align: 'right' });

    doc.setFontSize(7);
    setText(doc, WARM_400);
    doc.text(
      'This document is self-reported and supplements, not replaces, clinical evaluation.',
      PAGE_W / 2,
      PAGE_H - MARGIN + 1,
      { align: 'center' },
    );
  }
}

// ---------- main entry ----------

export function generateProviderPdf(input: ProviderPdfInput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let y = drawHeader(doc, input);
  y = drawTwoColumnSummary(doc, input, y);
  y = ensureSpace(doc, y, 30);
  y = drawCycleHistoryTable(doc, input, y);
  y = ensureSpace(doc, y, 30);
  y = drawLabsTable(doc, input, y);
  y = ensureSpace(doc, y, 30);
  y = drawCurrentCycleReadings(doc, input, y);
  y = ensureSpace(doc, y, 20);
  y = drawSupplements(doc, input, y);
  if (input.notes && input.notes.trim().length > 0) {
    y = ensureSpace(doc, y, 20);
    drawNotes(doc, input.notes.trim(), y);
  }

  drawFooters(doc, input);

  doc.save(providerPdfFilename(input.userName));
}
