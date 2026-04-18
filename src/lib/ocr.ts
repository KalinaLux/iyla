import { createWorker } from 'tesseract.js';

/**
 * Minimal structural types for the bits of the tesseract.js Page result we
 * actually use. We avoid `import type { Page, Word }` because tesseract.js
 * ships `export = Tesseract` which is awkward with `verbatimModuleSyntax`.
 */
interface OcrWord {
  text?: string;
  confidence?: number;
}
interface OcrLine {
  words?: OcrWord[];
}
interface OcrParagraph {
  lines?: OcrLine[];
}
interface OcrBlock {
  paragraphs?: OcrParagraph[];
}
interface OcrPage {
  text?: string;
  confidence?: number;
  blocks?: OcrBlock[] | null;
}

export type OcrField =
  | 'lh'
  | 'e3g'
  | 'pdg'
  | 'fsh'
  | 'estradiol'
  | 'progesterone'
  | 'tsh'
  | 'amh'
  | 'vitamin_d'
  | 'ferritin'
  | 'unknown';

export interface OcrCandidate {
  /** Which lab value we think this is */
  field: OcrField;
  /** Parsed numeric value */
  value: number;
  /** Unit if we could detect one */
  unit?: string;
  /** The raw snippet of text we extracted it from */
  rawText: string;
  /** OCR confidence (0-100) */
  confidence: number;
}

export interface OcrResult {
  /** Full OCR text dump */
  rawText: string;
  /** Overall average OCR confidence (0-100) */
  confidence: number;
  /** Parsed field candidates (deduped, highest-confidence per field) */
  candidates: OcrCandidate[];
  /** Best guess at the format of the source image */
  detectedFormat: 'inito_panel' | 'lab_report' | 'unknown';
  /** Wall-clock time spent processing */
  processingTimeMs: number;
}

export interface OcrProgress {
  phase: 'loading' | 'recognizing' | 'parsing' | 'done';
  /** 0..1 */
  progress: number;
  message: string;
}

interface FieldSpec {
  field: Exclude<OcrField, 'unknown'>;
  /**
   * Regex that captures: group 1 = label (not used), later group(s) = value and optional unit.
   * We always require at least one capture group that is the number.
   */
  pattern: RegExp;
  /** Which capture group holds the numeric value. */
  valueGroup: number;
  /** Optional capture group for the unit. */
  unitGroup?: number;
  /** Default unit for this field when the OCR didn't catch one. */
  defaultUnit?: string;
  /** Sanity range — values outside this range are rejected for this field. */
  min: number;
  max: number;
}

/**
 * Field specs, ordered by specificity. The FSH pattern is run before "generic" ones
 * because "FSH" would otherwise be eaten by the less specific fallbacks.
 */
const FIELD_SPECS: FieldSpec[] = [
  {
    field: 'lh',
    pattern: /\b(LH|luteinizing)\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(mIU\/mL|mIU|IU\/L|iu\/l)?/i,
    valueGroup: 2,
    unitGroup: 3,
    defaultUnit: 'mIU/mL',
    min: 0,
    max: 500,
  },
  {
    field: 'e3g',
    pattern: /\b(E3G|estrone[-\s]?3[-\s]?glucuronide|estrogen)\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ng\/mL|ng|pg\/mL|pg)?/i,
    valueGroup: 2,
    unitGroup: 3,
    defaultUnit: 'ng/mL',
    min: 0,
    max: 10000,
  },
  {
    field: 'pdg',
    pattern: /\b(PdG|pregnanediol)\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ug\/mL|µg\/mL|μg\/mL|ug|ng)?/i,
    valueGroup: 2,
    unitGroup: 3,
    defaultUnit: 'µg/mL',
    min: 0,
    max: 1000,
  },
  {
    field: 'fsh',
    pattern: /\bFSH\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(mIU\/mL|mIU|IU\/L|iu\/l)?/i,
    valueGroup: 1,
    unitGroup: 2,
    defaultUnit: 'mIU/mL',
    min: 0,
    max: 500,
  },
  {
    field: 'estradiol',
    pattern: /\b(estradiol|E2)\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(pg\/mL|pg|pmol\/L)?/i,
    valueGroup: 2,
    unitGroup: 3,
    defaultUnit: 'pg/mL',
    min: 0,
    max: 10000,
  },
  {
    field: 'progesterone',
    pattern: /\bprogesterone\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ng\/mL|nmol\/L)?/i,
    valueGroup: 1,
    unitGroup: 2,
    defaultUnit: 'ng/mL',
    min: 0,
    max: 500,
  },
  {
    field: 'tsh',
    pattern: /\bTSH\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(mIU\/L|uIU\/mL|µIU\/mL|μIU\/mL)?/i,
    valueGroup: 1,
    unitGroup: 2,
    defaultUnit: 'mIU/L',
    min: 0,
    max: 100,
  },
  {
    field: 'amh',
    pattern: /\bAMH\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ng\/mL|pmol\/L)?/i,
    valueGroup: 1,
    unitGroup: 2,
    defaultUnit: 'ng/mL',
    min: 0,
    max: 50,
  },
  {
    field: 'vitamin_d',
    pattern: /\b(vitamin\s*d|25[-\s]?OH)\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ng\/mL|nmol\/L)?/i,
    valueGroup: 2,
    unitGroup: 3,
    defaultUnit: 'ng/mL',
    min: 0,
    max: 200,
  },
  {
    field: 'ferritin',
    pattern: /\bferritin\b[^0-9\n]{0,20}([0-9]+\.?[0-9]*)\s*(ng\/mL|ug\/L|µg\/L|μg\/L)?/i,
    valueGroup: 1,
    unitGroup: 2,
    defaultUnit: 'ng/mL',
    min: 0,
    max: 2000,
  },
];

/**
 * Collapse all whitespace inside a line to single spaces but preserve
 * line breaks — values usually sit on the same line as their label, and
 * keeping lines intact helps the \n-bounded [^0-9\n] guards.
 */
function normalizeText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Given the OCR's per-word confidence data, estimate the confidence for a
 * snippet of text by averaging the confidence of words whose text appears in it.
 * Falls back to the overall page confidence if we can't find any.
 */
function snippetConfidence(snippet: string, words: OcrWord[], pageConfidence: number): number {
  if (words.length === 0) return pageConfidence;
  const tokens = snippet.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return pageConfidence;
  const matched = words.filter(w => {
    const t = (w.text ?? '').toLowerCase();
    if (!t) return false;
    return tokens.some(tok => tok.includes(t) || t.includes(tok));
  });
  if (matched.length === 0) return pageConfidence;
  const sum = matched.reduce((acc, w) => acc + (w.confidence ?? 0), 0);
  return sum / matched.length;
}

function findLineContaining(normalizedText: string, needle: string): string {
  const lines = normalizedText.split('\n');
  const match = lines.find(l => l.toLowerCase().includes(needle.toLowerCase()));
  return match ?? needle;
}

function parseInitoAndLabs(
  normalizedText: string,
  words: OcrWord[],
  pageConfidence: number,
): OcrCandidate[] {
  const candidates: OcrCandidate[] = [];
  for (const spec of FIELD_SPECS) {
    const globalPattern = new RegExp(spec.pattern.source, spec.pattern.flags.includes('g') ? spec.pattern.flags : spec.pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(normalizedText)) !== null) {
      const rawValue = match[spec.valueGroup];
      if (!rawValue) continue;
      const value = parseFloat(rawValue);
      if (!Number.isFinite(value)) continue;
      if (value < spec.min || value > spec.max) continue;
      const unit = spec.unitGroup != null ? match[spec.unitGroup] : undefined;
      const snippet = findLineContaining(normalizedText, match[0]);
      candidates.push({
        field: spec.field,
        value,
        unit: unit || spec.defaultUnit,
        rawText: snippet,
        confidence: snippetConfidence(match[0], words, pageConfidence),
      });
    }
  }
  return candidates;
}

/**
 * Last-resort parser: every standalone number between 0 and 10,000 becomes an
 * 'unknown' candidate. We only emit these for numbers that weren't already
 * consumed by a labeled parser (based on rawText substring match), so they
 * mostly fire on text like sub-regions of a lab report where we don't
 * recognize the label.
 */
function fallbackNumbers(
  normalizedText: string,
  words: OcrWord[],
  pageConfidence: number,
  consumed: OcrCandidate[],
): OcrCandidate[] {
  const out: OcrCandidate[] = [];
  const consumedSnippets = new Set(consumed.map(c => c.rawText));
  const lines = normalizedText.split('\n');
  const numberRe = /\b([0-9]+\.?[0-9]*)\b/g;
  for (const line of lines) {
    if (consumedSnippets.has(line)) continue;
    let match: RegExpExecArray | null;
    while ((match = numberRe.exec(line)) !== null) {
      const value = parseFloat(match[1]);
      if (!Number.isFinite(value)) continue;
      if (value <= 0 || value >= 10000) continue;
      out.push({
        field: 'unknown',
        value,
        rawText: line,
        confidence: snippetConfidence(match[0], words, pageConfidence),
      });
    }
  }
  return out;
}

function dedupe(candidates: OcrCandidate[]): OcrCandidate[] {
  const byField = new Map<string, OcrCandidate>();
  const unknowns: OcrCandidate[] = [];
  for (const c of candidates) {
    if (c.field === 'unknown') {
      unknowns.push(c);
      continue;
    }
    const existing = byField.get(c.field);
    if (!existing || c.confidence > existing.confidence) {
      byField.set(c.field, c);
    }
  }
  const known = Array.from(byField.values());
  // Keep at most 5 unknowns, highest confidence first, and drop any whose
  // value already shows up in a known candidate (to avoid the same number
  // appearing twice in the review UI).
  const knownValues = new Set(known.map(k => k.value));
  const filteredUnknowns = unknowns
    .filter(u => !knownValues.has(u.value))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  return [...known, ...filteredUnknowns];
}

function detectFormat(text: string): OcrResult['detectedFormat'] {
  const lower = text.toLowerCase();
  if (lower.includes('inito')) return 'inito_panel';
  const initoMarkers = ['lh', 'e3g', 'pdg', 'fsh'];
  const hits = initoMarkers.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text)).length;
  if (hits >= 2) return 'inito_panel';
  if (/reference range|labcorp|quest diagnostics/i.test(text)) return 'lab_report';
  return 'unknown';
}

function collectWords(data: OcrPage): OcrWord[] {
  const words: OcrWord[] = [];
  const blocks = data.blocks ?? [];
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

/**
 * Run OCR on a File or Blob (image). Progress callback fires throughout.
 *
 * The Tesseract worker is always terminated, even on error.
 */
export async function runOcr(
  file: File | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const start = performance.now();
  onProgress?.({ phase: 'loading', progress: 0, message: 'Loading OCR engine…' });

  const worker = await createWorker('eng', undefined, {
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      if (m.status === 'recognizing text') {
        onProgress({
          phase: 'recognizing',
          progress: Math.max(0, Math.min(1, m.progress)),
          message: 'Reading image…',
        });
      } else if (
        m.status === 'loading tesseract core' ||
        m.status === 'initializing tesseract' ||
        m.status === 'loading language traineddata' ||
        m.status === 'initializing api'
      ) {
        onProgress({
          phase: 'loading',
          progress: Math.max(0, Math.min(1, m.progress)),
          message: m.status,
        });
      }
    },
  });

  try {
    onProgress?.({ phase: 'recognizing', progress: 0, message: 'Reading image…' });
    const result = await worker.recognize(file);
    const data = result.data as OcrPage;

    onProgress?.({ phase: 'parsing', progress: 0.95, message: 'Parsing values…' });
    const rawText = data.text ?? '';
    const normalized = normalizeText(rawText);
    const words = collectWords(data);
    const pageConfidence = data.confidence ?? 0;

    const labeled = parseInitoAndLabs(normalized, words, pageConfidence);
    const unknownsExtra = fallbackNumbers(normalized, words, pageConfidence, labeled);
    const candidates = dedupe([...labeled, ...unknownsExtra]);
    const detectedFormat = detectFormat(normalized);

    onProgress?.({ phase: 'done', progress: 1, message: 'Done' });
    return {
      rawText,
      confidence: pageConfidence,
      candidates,
      detectedFormat,
      processingTimeMs: performance.now() - start,
    };
  } finally {
    await worker.terminate().catch(() => {});
  }
}

/**
 * Expose field metadata so UI can show the same default units / sanity ranges.
 */
export function fieldDefaults(field: OcrField): { unit?: string } {
  if (field === 'unknown') return {};
  const spec = FIELD_SPECS.find(s => s.field === field);
  return { unit: spec?.defaultUnit };
}

/**
 * Human-readable name for a field, for UI labels.
 */
export function fieldLabel(field: OcrField): string {
  switch (field) {
    case 'lh': return 'LH';
    case 'e3g': return 'E3G / Estrogen';
    case 'pdg': return 'PdG / Progesterone';
    case 'fsh': return 'FSH';
    case 'estradiol': return 'Estradiol (E2)';
    case 'progesterone': return 'Progesterone';
    case 'tsh': return 'TSH';
    case 'amh': return 'AMH';
    case 'vitamin_d': return 'Vitamin D';
    case 'ferritin': return 'Ferritin';
    case 'unknown': return 'Unknown';
  }
}

/**
 * Fields that map to DailyReading (Inito panel).
 */
export const DAILY_FIELDS: ReadonlyArray<OcrField> = ['lh', 'e3g', 'pdg', 'fsh'];
