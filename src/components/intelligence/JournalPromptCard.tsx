import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { BookHeart, Sunrise, Moon, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../Modal';
import JournalEntryEditor from '../journal/JournalEntryEditor';
import { journalDb, type EntryKind } from '../../lib/journal-db';
import {
  getPromptVariant,
  getPromptSet,
  type CyclePhaseKey,
} from '../../lib/journal-prompts';

interface Props {
  cyclePhase?: CyclePhaseKey;
  cycleDay?: number;
}

export default function JournalPromptCard({ cyclePhase, cycleDay }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const phaseKey: CyclePhaseKey = cyclePhase ?? 'unknown';

  const todayEntries = useLiveQuery(
    () => journalDb.entries.where('date').equals(today).toArray(),
    [today],
  ) ?? [];

  const hasMorning = todayEntries.some(e => e.kind === 'morning');
  const hasEvening = todayEntries.some(e => e.kind === 'evening');

  const unansweredKind: EntryKind | null = !hasMorning
    ? 'morning'
    : !hasEvening
    ? 'evening'
    : null;

  const morningPrompts = useMemo(
    () => getPromptVariant(phaseKey, today, 'morning'),
    [phaseKey, today],
  );
  const eveningPrompts = useMemo(
    () => getPromptVariant(phaseKey, today, 'evening'),
    [phaseKey, today],
  );
  const promptSet = useMemo(() => getPromptSet(phaseKey), [phaseKey]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKind, setEditorKind] = useState<EntryKind>('morning');

  function open(k: EntryKind) {
    setEditorKind(k);
    setEditorOpen(true);
  }

  // ── Both answered — show the affirmation and a soft link in ──
  if (!unansweredKind) {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-lavender-50 flex items-center justify-center shrink-0">
            <Sparkles size={15} className="text-lavender-600" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-warm-700">
                Today's journal is complete
              </h3>
              <span className="text-xs">🌙</span>
            </div>
            <p className="text-sm text-warm-500 italic leading-relaxed">
              {promptSet.affirmation}
            </p>
          </div>
          <Link
            to="/journal"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-warm-500 hover:text-warm-700 transition-colors"
          >
            Open journal
            <ArrowRight size={11} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    );
  }

  // ── One or more prompts still waiting ──
  const isMorning = unansweredKind === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
  const firstPrompt = prompts[0] ?? '';
  const Icon = isMorning ? Sunrise : Moon;
  const kindLabel = isMorning ? 'Morning intention' : 'Evening reflection';
  const gradient = isMorning
    ? 'from-honey-100 to-rose-100'
    : 'from-lavender-100 to-honey-50';
  const iconBg = isMorning ? 'bg-honey-200/80 text-honey-700' : 'bg-lavender-200/70 text-lavender-600';

  return (
    <>
      <button
        type="button"
        onClick={() => open(unansweredKind)}
        className={`w-full text-left rounded-3xl border border-warm-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 bg-gradient-to-br ${gradient}`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={15} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BookHeart size={13} className="text-warm-700/70" strokeWidth={1.8} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-warm-700/70">
                Journal · {kindLabel}
              </span>
            </div>
            <p className="text-sm font-semibold text-warm-800 leading-snug">
              {firstPrompt}
            </p>
            <p className="text-xs text-warm-700/70 mt-1.5 italic">
              Tap to write — takes less than a minute.
            </p>
          </div>
          <ArrowRight size={14} className="text-warm-600 shrink-0 mt-1" strokeWidth={2} />
        </div>
      </button>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="New entry"
        maxWidth="max-w-2xl"
      >
        <JournalEntryEditor
          key={`prompt-${editorKind}-${today}`}
          existingEntry={null}
          defaultKind={editorKind}
          cyclePhase={phaseKey}
          cycleDay={cycleDay}
          onSave={() => setEditorOpen(false)}
          onCancel={() => setEditorOpen(false)}
        />
      </Modal>
    </>
  );
}
