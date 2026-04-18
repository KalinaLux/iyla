import { useMemo, useState } from 'react';
import { Sunrise, Moon, Feather, Sparkles, Check } from 'lucide-react';
import { format } from 'date-fns';
import { journalDb } from '../../lib/journal-db';
import type { EmotionalTone, EntryKind, JournalEntry } from '../../lib/journal-db';
import {
  getPromptVariant,
  getPromptSet,
  getClosingMessage,
  type CyclePhaseKey,
} from '../../lib/journal-prompts';
import MoodStressSliders from './MoodStressSliders';
import EmotionalToneSelector from './EmotionalToneSelector';

interface Props {
  existingEntry: JournalEntry | null;
  defaultKind: EntryKind;
  cyclePhase?: CyclePhaseKey;
  cycleDay?: number;
  onSave: () => void;
  onCancel: () => void;
}

const KIND_META: Record<
  EntryKind,
  { icon: typeof Sunrise; label: string; subtle: string; emoji: string }
> = {
  morning: {
    icon: Sunrise,
    label: 'Morning intention',
    subtle: "A soft start — no performance required.",
    emoji: '🌅',
  },
  evening: {
    icon: Moon,
    label: 'Evening reflection',
    subtle: 'A slow look at the day, with gratitude.',
    emoji: '🌙',
  },
  freeform: {
    icon: Feather,
    label: 'Freeform entry',
    subtle: "Anything you'd like to hold on the page.",
    emoji: '✍️',
  },
};

export default function JournalEntryEditor({
  existingEntry,
  defaultKind,
  cyclePhase,
  cycleDay,
  onSave,
  onCancel,
}: Props) {
  const initialKind: EntryKind = existingEntry?.kind ?? defaultKind;
  const [kind, setKindState] = useState<EntryKind>(initialKind);
  const today = existingEntry?.date ?? format(new Date(), 'yyyy-MM-dd');

  // Prompts are deterministic from date so the same day always shows the
  // same two/three questions.
  const phaseKey: CyclePhaseKey = cyclePhase ?? existingEntry?.cyclePhase ?? 'unknown';
  const promptSet = useMemo(() => getPromptSet(phaseKey), [phaseKey]);

  const morningPrompts = useMemo(
    () => getPromptVariant(phaseKey, today, 'morning'),
    [phaseKey, today],
  );
  const eveningPrompts = useMemo(
    () => getPromptVariant(phaseKey, today, 'evening'),
    [phaseKey, today],
  );

  // Seed local state from the existing entry (if any), otherwise blank.
  const [title, setTitle] = useState(existingEntry?.title ?? '');
  const [body, setBody] = useState(existingEntry?.body ?? '');
  const [mood, setMood] = useState<number | undefined>(existingEntry?.mood);
  const [stress, setStress] = useState<number | undefined>(existingEntry?.stress);
  const [tone, setTone] = useState<EmotionalTone | undefined>(
    existingEntry?.emotionalTone,
  );
  const [intention, setIntention] = useState(existingEntry?.intention ?? '');
  const [tagsInput, setTagsInput] = useState((existingEntry?.tags ?? []).join(', '));
  const [gratitude, setGratitude] = useState<string[]>(() => {
    const g = existingEntry?.gratitude ?? [];
    return [g[0] ?? '', g[1] ?? '', g[2] ?? ''];
  });

  // Build initial structured prompt responses keyed to the active set. Each
  // entry kind keeps its own buffer, so switching between morning ↔ evening
  // without saving doesn't lose what the user has typed.
  const [responsesByKind, setResponsesByKind] = useState<Record<EntryKind, string[]>>(() => {
    const empty: Record<EntryKind, string[]> = { morning: [], evening: [], freeform: [] };
    if (!existingEntry) return empty;
    const activePrompts =
      existingEntry.kind === 'morning'
        ? morningPrompts
        : existingEntry.kind === 'evening'
        ? eveningPrompts
        : [];
    empty[existingEntry.kind] = activePrompts.map((p, i) => {
      const match = existingEntry.prompts?.find(pr => pr.prompt === p);
      return match?.response ?? existingEntry.prompts?.[i]?.response ?? '';
    });
    return empty;
  });

  function setKind(nextKind: EntryKind) {
    setKindState(nextKind);
  }

  const activePrompts =
    kind === 'morning' ? morningPrompts : kind === 'evening' ? eveningPrompts : [];

  // Derive the current prompt-response buffer, padding to match the prompt
  // set length without ever calling setState during render.
  const promptResponses = (() => {
    const stored = responsesByKind[kind] ?? [];
    if (stored.length >= activePrompts.length) return stored.slice(0, activePrompts.length);
    const padded = [...stored];
    while (padded.length < activePrompts.length) padded.push('');
    return padded;
  })();

  function setPromptResponses(next: string[]) {
    setResponsesByKind(prev => ({ ...prev, [kind]: next }));
  }

  const [saving, setSaving] = useState(false);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    const now = new Date().toISOString();
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Evening entries store gratitude both as a dedicated array AND as the
    // 3rd prompt response so full-text search picks them up.
    const prompts =
      kind === 'morning'
        ? morningPrompts.map((p, i) => ({ prompt: p, response: promptResponses[i] ?? '' }))
        : kind === 'evening'
        ? eveningPrompts.map((p, i) => ({
            prompt: p,
            response: i === 2 ? gratitude.filter(Boolean).join(' · ') : (promptResponses[i] ?? ''),
          }))
        : [];

    const payload: Omit<JournalEntry, 'id'> = {
      date: today,
      kind,
      title: title.trim() || undefined,
      body: body.trim(),
      prompts,
      emotionalTone: tone,
      mood,
      stress,
      gratitude: kind === 'evening' ? gratitude.filter(Boolean) : undefined,
      intention: kind === 'morning' ? (intention.trim() || undefined) : undefined,
      tags,
      cyclePhase:
        phaseKey === 'unknown' ? undefined : phaseKey,
      cycleDay,
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingEntry?.id != null) {
      await journalDb.entries.update(existingEntry.id, payload);
    } else {
      await journalDb.entries.add(payload as JournalEntry);
    }

    setClosingMessage(getClosingMessage(tone));

    // Hold the closing message for ~2s so it feels intentional, then dismiss.
    window.setTimeout(() => {
      setSaving(false);
      onSave();
    }, 2000);
  }

  if (closingMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-honey-100 flex items-center justify-center">
          <Sparkles size={24} className="text-honey-600" strokeWidth={1.5} />
        </div>
        <p className="text-base text-warm-700 font-medium max-w-sm leading-relaxed">
          {closingMessage}
        </p>
      </div>
    );
  }

  const KindIcon = KIND_META[kind].icon;

  return (
    <div className="space-y-6">
      {/* Kind switcher */}
      <div className="flex items-center gap-2">
        {(['morning', 'evening', 'freeform'] as EntryKind[]).map(k => {
          const m = KIND_META[k];
          const Active = m.icon;
          const isActive = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
                isActive
                  ? 'bg-warm-800 text-white'
                  : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
              }`}
            >
              <Active size={13} strokeWidth={1.8} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Phase context */}
      <div className="bg-gradient-to-br from-honey-50 to-rose-50/60 rounded-3xl p-5 border border-honey-100/70">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/70 flex items-center justify-center shrink-0">
            <KindIcon size={16} className="text-warm-700" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-warm-400 font-semibold">
              {KIND_META[kind].emoji} {KIND_META[kind].label}
              {cycleDay ? <span className="ml-2 text-warm-400">· CD {cycleDay}</span> : null}
            </p>
            <p className="text-sm text-warm-700 mt-1 leading-relaxed">
              {promptSet.phaseContext}
            </p>
          </div>
        </div>
      </div>

      {/* Mood + Stress */}
      <MoodStressSliders
        mood={mood}
        stress={stress}
        onMoodChange={setMood}
        onStressChange={setStress}
      />

      {/* Emotional tone */}
      <EmotionalToneSelector value={tone} onChange={setTone} />

      {/* Morning — intention + 2 prompts */}
      {kind === 'morning' && (
        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-warm-700">
              Today's intention
            </label>
            <p className="text-xs text-warm-400 mt-0.5 mb-2">
              One line — a word, a feeling, a prayer.
            </p>
            <input
              type="text"
              value={intention}
              onChange={e => setIntention(e.target.value)}
              placeholder="e.g., soften, receive, one honest yes..."
              className="w-full px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors"
            />
          </div>

          {morningPrompts.map((p, i) => (
            <PromptField
              key={p}
              prompt={p}
              value={promptResponses[i] ?? ''}
              onChange={v => updateResponse(i, v, promptResponses, setPromptResponses)}
            />
          ))}
        </div>
      )}

      {/* Evening — 3 prompts; prompt #3 is a gratitude list */}
      {kind === 'evening' && (
        <div className="space-y-5">
          {eveningPrompts.slice(0, 2).map((p, i) => (
            <PromptField
              key={p}
              prompt={p}
              value={promptResponses[i] ?? ''}
              onChange={v => updateResponse(i, v, promptResponses, setPromptResponses)}
            />
          ))}

          {eveningPrompts[2] && (
            <div>
              <label className="text-sm font-semibold text-warm-700">
                {eveningPrompts[2]}
              </label>
              <p className="text-xs text-warm-400 mt-0.5 mb-2">
                Up to three — however small.
              </p>
              <div className="space-y-2">
                {[0, 1, 2].map(idx => (
                  <input
                    key={idx}
                    type="text"
                    value={gratitude[idx] ?? ''}
                    onChange={e => {
                      const next = [...gratitude];
                      next[idx] = e.target.value;
                      setGratitude(next);
                    }}
                    placeholder={
                      idx === 0
                        ? 'e.g., morning light through the window'
                        : idx === 1
                        ? 'e.g., a kind message from a friend'
                        : 'e.g., my body, carrying me'
                    }
                    className="w-full px-4 py-2.5 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors text-sm"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-sm font-semibold text-warm-700">
          Title <span className="text-warm-300 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="A short name for today's entry"
          className="mt-2 w-full px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors"
        />
      </div>

      {/* Body */}
      <div>
        <label className="text-sm font-semibold text-warm-700">
          Anything else you want to write
        </label>
        <p className="text-xs text-warm-400 mt-0.5 mb-2">
          The page has no expectations. Write as little or as much as you like.
        </p>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={kind === 'freeform' ? 8 : 5}
          placeholder="Let the words come…"
          className="w-full px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors resize-y leading-relaxed"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-sm font-semibold text-warm-700">
          Tags <span className="text-warm-300 font-normal">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="prayer, body, partner, rest..."
          className="mt-2 w-full px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors"
        />
      </div>

      {/* Affirmation */}
      <div className="bg-lavender-50 rounded-3xl px-6 py-5 border border-lavender-100">
        <p className="text-[11px] uppercase tracking-wider text-lavender-600 font-semibold mb-1.5">
          A soft reminder
        </p>
        <p className="text-sm text-warm-700 italic leading-relaxed">
          {promptSet.affirmation}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 rounded-2xl text-sm font-medium text-warm-500 hover:bg-warm-50 transition-colors"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-semibold bg-warm-800 text-white hover:bg-warm-900 transition-colors active:scale-95 disabled:opacity-60"
        >
          <Check size={14} strokeWidth={2.2} />
          {saving ? 'Saving…' : existingEntry ? 'Save changes' : 'Save entry'}
        </button>
      </div>
    </div>
  );
}

function updateResponse(
  idx: number,
  value: string,
  current: string[],
  setResponses: (v: string[]) => void,
) {
  const next = [...current];
  next[idx] = value;
  setResponses(next);
}

function PromptField({
  prompt,
  value,
  onChange,
}: {
  prompt: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-warm-700 leading-snug">
        {prompt}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder="Take your time…"
        className="mt-2 w-full px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors resize-y leading-relaxed text-sm"
      />
    </div>
  );
}
