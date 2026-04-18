import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, ScanLine, Check, AlertCircle, X } from 'lucide-react';
import Modal from './Modal';
import { runOcr, fieldLabel, fieldDefaults, DAILY_FIELDS } from '../lib/ocr';
import type { OcrResult, OcrCandidate, OcrField, OcrProgress } from '../lib/ocr';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user saves parsed values to a daily reading for the given date */
  onSaveToDailyReading?: (
    date: string,
    updates: { lh?: number; e3g?: number; pdg?: number; fsh?: number },
  ) => void | Promise<void>;
  /** Called when user saves parsed values to labs */
  onSaveToLabs?: (
    entries: Array<{ testName: string; value: number; unit: string; date: string }>,
  ) => void | Promise<void>;
  /** Default date to use for saves */
  defaultDate: string;
}

type Stage = 'upload' | 'processing' | 'review' | 'error';

interface EditableCandidate extends OcrCandidate {
  id: string;
  include: boolean;
}

const ALL_FIELDS: OcrField[] = [
  'lh', 'e3g', 'pdg', 'fsh',
  'estradiol', 'progesterone', 'tsh', 'amh', 'vitamin_d', 'ferritin',
  'unknown',
];

const LAB_TEST_NAME: Record<OcrField, string> = {
  lh: 'LH (Baseline)',
  e3g: 'E3G',
  pdg: 'PdG',
  fsh: 'FSH (Baseline)',
  estradiol: 'Estradiol',
  progesterone: 'Progesterone',
  tsh: 'TSH',
  amh: 'AMH',
  vitamin_d: 'Vitamin D',
  ferritin: 'Ferritin',
  unknown: 'Unknown',
};

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function toEditable(candidates: OcrCandidate[]): EditableCandidate[] {
  return candidates.map((c, i) => ({
    ...c,
    id: `${c.field}-${i}-${c.value}`,
    include: true,
  }));
}

export default function OcrModal({
  open,
  onClose,
  onSaveToDailyReading,
  onSaveToLabs,
  defaultDate,
}: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [progress, setProgress] = useState<OcrProgress>({
    phase: 'loading',
    progress: 0,
    message: '',
  });
  const [result, setResult] = useState<OcrResult | null>(null);
  const [editable, setEditable] = useState<EditableCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveDate, setSaveDate] = useState<string>(defaultDate);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStage('upload');
    setProgress({ phase: 'loading', progress: 0, message: '' });
    setResult(null);
    setEditable([]);
    setError(null);
    setSaveDate(defaultDate);
    setPreview(null);
  }, [defaultDate]);

  useEffect(() => {
    if (open) {
      setSaveDate(defaultDate);
    } else {
      reset();
    }
  }, [open, defaultDate, reset]);

  const handleFile = useCallback(async (file: File | Blob) => {
    setStage('processing');
    setError(null);
    setProgress({ phase: 'loading', progress: 0, message: 'Starting…' });
    try {
      if (file instanceof Blob) {
        const url = URL.createObjectURL(file);
        setPreview(url);
      }
      const res = await runOcr(file, p => setProgress(p));
      setResult(res);
      setEditable(toEditable(res.candidates));
      if (res.candidates.length === 0) {
        setError("Couldn't read any numbers from that image.");
        setStage('error');
      } else {
        setStage('review');
      }
    } catch (err) {
      console.error('OCR failed', err);
      setError(err instanceof Error ? err.message : 'OCR failed');
      setStage('error');
    }
  }, []);

  // Paste-from-clipboard support while modal is open
  useEffect(() => {
    if (!open || stage !== 'upload') return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            void handleFile(blob);
            return;
          }
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, stage, handleFile]);

  // Release object URL when done
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function updateCandidate(id: string, patch: Partial<EditableCandidate>) {
    setEditable(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleSaveDaily() {
    if (!onSaveToDailyReading) return;
    const included = editable.filter(c => c.include && DAILY_FIELDS.includes(c.field));
    if (included.length === 0) return;
    const updates: { lh?: number; e3g?: number; pdg?: number; fsh?: number } = {};
    for (const c of included) {
      if (c.field === 'lh') updates.lh = c.value;
      else if (c.field === 'e3g') updates.e3g = c.value;
      else if (c.field === 'pdg') updates.pdg = c.value;
      else if (c.field === 'fsh') updates.fsh = c.value;
    }
    setSaving(true);
    try {
      await onSaveToDailyReading(saveDate, updates);
      onClose();
    } catch (err) {
      console.error('Save daily failed', err);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLabs() {
    if (!onSaveToLabs) return;
    const included = editable.filter(
      c => c.include && !DAILY_FIELDS.includes(c.field) && c.field !== 'unknown',
    );
    if (included.length === 0) return;
    const entries = included.map(c => ({
      testName: LAB_TEST_NAME[c.field],
      value: c.value,
      unit: c.unit || fieldDefaults(c.field).unit || '',
      date: saveDate,
    }));
    setSaving(true);
    try {
      await onSaveToLabs(entries);
      onClose();
    } catch (err) {
      console.error('Save labs failed', err);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const dailyCandidates = editable.filter(c => DAILY_FIELDS.includes(c.field));
  const labCandidates = editable.filter(
    c => !DAILY_FIELDS.includes(c.field) && c.field !== 'unknown',
  );
  const unknownCandidates = editable.filter(c => c.field === 'unknown');

  return (
    <Modal open={open} onClose={onClose} title="Scan lab panel" maxWidth="max-w-2xl">
      {stage === 'upload' && (
        <div className="space-y-5">
          <p className="text-sm text-warm-500 leading-relaxed">
            Take a clear, well-lit photo of your Inito panel or lab report. We'll read the numbers for you — you can fix anything that's off before saving.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 px-6 py-10 bg-warm-50 hover:bg-warm-100 border border-warm-200 rounded-3xl transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-warm-600">
                <Camera size={22} strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-warm-700">Take photo</div>
              <div className="text-xs text-warm-400">Use your camera</div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 px-6 py-10 bg-warm-50 hover:bg-warm-100 border border-warm-200 rounded-3xl transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-warm-600">
                <Upload size={22} strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-warm-700">Upload image</div>
              <div className="text-xs text-warm-400">From your device</div>
            </button>
          </div>

          <p className="text-xs text-warm-400 text-center">
            Tip: you can also paste an image (⌘V).
          </p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            {...(isMobile() ? { capture: 'environment' as const } : {})}
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {stage === 'processing' && (
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-2xl bg-warm-50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-warm-600">
                <ScanLine size={24} strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-sm font-medium text-warm-700">
              {progress.phase === 'loading' && 'Loading OCR engine'}
              {progress.phase === 'recognizing' && 'Reading your image'}
              {progress.phase === 'parsing' && 'Finding values'}
              {progress.phase === 'done' && 'Done'}
            </div>
            <div className="text-xs text-warm-400">{progress.message}</div>
          </div>

          <div className="w-full bg-warm-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-warm-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>

          {preview && (
            <div className="rounded-2xl overflow-hidden border border-warm-200">
              <img src={preview} alt="Scanned lab panel" className="w-full max-h-64 object-contain bg-warm-50" />
            </div>
          )}
        </div>
      )}

      {stage === 'review' && result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-warm-700">
                {result.detectedFormat === 'inito_panel' && 'Inito panel detected'}
                {result.detectedFormat === 'lab_report' && 'Lab report detected'}
                {result.detectedFormat === 'unknown' && 'Unrecognized format'}
              </div>
              <div className="text-xs text-warm-400">
                Overall confidence: {Math.round(result.confidence)}% · {result.candidates.length} value{result.candidates.length === 1 ? '' : 's'} found
              </div>
            </div>
            <div>
              <label className="block text-xs text-warm-500 mb-1">Date</label>
              <input
                type="date"
                value={saveDate}
                onChange={e => setSaveDate(e.target.value)}
                className="border border-warm-200 rounded-xl px-3 py-1.5 text-xs text-warm-700 bg-warm-50/30 focus:outline-none focus:ring-2 focus:ring-warm-300"
              />
            </div>
          </div>

          {dailyCandidates.length > 0 && (
            <Section title="Daily tracking (Inito)" count={dailyCandidates.filter(c => c.include).length}>
              {dailyCandidates.map(c => (
                <CandidateRow key={c.id} candidate={c} onChange={patch => updateCandidate(c.id, patch)} />
              ))}
            </Section>
          )}

          {labCandidates.length > 0 && (
            <Section title="Lab results" count={labCandidates.filter(c => c.include).length}>
              {labCandidates.map(c => (
                <CandidateRow key={c.id} candidate={c} onChange={patch => updateCandidate(c.id, patch)} />
              ))}
            </Section>
          )}

          {unknownCandidates.length > 0 && (
            <Section title="Other numbers found" count={unknownCandidates.filter(c => c.include).length}>
              {unknownCandidates.map(c => (
                <CandidateRow key={c.id} candidate={c} onChange={patch => updateCandidate(c.id, patch)} />
              ))}
            </Section>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600">
              <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-warm-100">
            <button
              onClick={reset}
              className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl transition-colors"
            >
              Scan another
            </button>
            {onSaveToLabs && labCandidates.some(c => c.include) && (
              <button
                onClick={handleSaveLabs}
                disabled={saving}
                className="px-5 py-2.5 bg-warm-100 text-warm-800 rounded-2xl text-sm font-medium hover:bg-warm-200 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={14} strokeWidth={1.5} />
                Save to Labs
              </button>
            )}
            {onSaveToDailyReading && dailyCandidates.some(c => c.include) && (
              <button
                onClick={handleSaveDaily}
                disabled={saving}
                className="px-5 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                <Check size={14} strokeWidth={1.5} />
                Save to Daily Reading
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
            <AlertCircle size={24} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-sm font-medium text-warm-700 mb-1">Couldn't read that clearly</div>
            <div className="text-xs text-warm-400 max-w-sm">
              {error ?? 'Try better lighting, hold the camera steady, and make sure the whole panel is in frame.'}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-sm font-medium text-warm-600">{title}</div>
        <div className="text-xs text-warm-400">{count} selected</div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function CandidateRow({
  candidate,
  onChange,
}: {
  candidate: EditableCandidate;
  onChange: (patch: Partial<EditableCandidate>) => void;
}) {
  const conf = Math.round(candidate.confidence);
  return (
    <div
      className={`border rounded-2xl p-3.5 transition-all ${
        candidate.include ? 'border-warm-200 bg-warm-50/40' : 'border-warm-100 bg-white opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onChange({ include: !candidate.include })}
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
            candidate.include
              ? 'bg-warm-700 border-warm-700 text-white'
              : 'bg-white border-warm-300 text-transparent'
          }`}
          aria-label={candidate.include ? 'Uncheck' : 'Check'}
        >
          {candidate.include ? <Check size={12} strokeWidth={2} /> : <X size={12} strokeWidth={2} />}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <select
              value={candidate.field}
              onChange={e => onChange({ field: e.target.value as OcrField })}
              className="border border-warm-200 rounded-xl px-2.5 py-1.5 text-xs text-warm-700 bg-white focus:outline-none focus:ring-2 focus:ring-warm-300"
            >
              {ALL_FIELDS.map(f => (
                <option key={f} value={f}>{fieldLabel(f)}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={candidate.value}
              onChange={e => {
                const v = parseFloat(e.target.value);
                onChange({ value: Number.isFinite(v) ? v : 0 });
              }}
              className="w-24 border border-warm-200 rounded-xl px-2.5 py-1.5 text-xs text-warm-700 bg-white focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
            <input
              type="text"
              value={candidate.unit ?? ''}
              onChange={e => onChange({ unit: e.target.value })}
              placeholder="unit"
              className="w-20 border border-warm-200 rounded-xl px-2.5 py-1.5 text-xs text-warm-500 bg-white focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-warm-100 rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full ${
                  conf >= 80 ? 'bg-emerald-400' : conf >= 60 ? 'bg-honey-400' : 'bg-rose-300'
                }`}
                style={{ width: `${conf}%` }}
              />
            </div>
            <div className="text-[10px] text-warm-400 tabular-nums w-10 text-right">{conf}%</div>
          </div>

          <div className="text-[11px] text-warm-400 italic truncate" title={candidate.rawText}>
            “{candidate.rawText}”
          </div>
        </div>
      </div>
    </div>
  );
}
