import { useId } from 'react';

interface Props {
  mood: number | undefined;
  stress: number | undefined;
  onMoodChange: (v: number) => void;
  onStressChange: (v: number) => void;
}

const MOOD_EMOJIS = ['😔', '😕', '😐', '🙂', '😊'];
const STRESS_EMOJIS = ['😌', '🙂', '😐', '😟', '😫'];

/** Maps 1–10 → 0..4 (emoji bucket) */
function emojiIndex(val: number): number {
  const clamped = Math.max(1, Math.min(10, val));
  return Math.min(4, Math.floor((clamped - 1) / 2));
}

/** Linear-interp a warm-palette color for mood (rose → honey → green). */
function moodColor(val: number): string {
  const t = (Math.max(1, Math.min(10, val)) - 1) / 9; // 0..1
  if (t < 0.5) return lerpHex('#d9a3aa', '#e2c88a', t / 0.5); // rose-400 → honey-300
  return lerpHex('#e2c88a', '#93bf96', (t - 0.5) / 0.5); // honey-300 → green-400
}

/** Stress: inverted — low is calm green, high is rose. */
function stressColor(val: number): string {
  const t = (Math.max(1, Math.min(10, val)) - 1) / 9;
  if (t < 0.5) return lerpHex('#93bf96', '#e2c88a', t / 0.5);
  return lerpHex('#e2c88a', '#d9a3aa', (t - 0.5) / 0.5);
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bC = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bC})`;
}

export default function MoodStressSliders({
  mood,
  stress,
  onMoodChange,
  onStressChange,
}: Props) {
  const moodId = useId();
  const stressId = useId();

  const moodVal = mood ?? 5;
  const stressVal = stress ?? 5;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SliderBlock
        id={moodId}
        label="Mood"
        subtle="How does today feel?"
        value={moodVal}
        displayEmoji={MOOD_EMOJIS[emojiIndex(moodVal)]}
        color={moodColor(moodVal)}
        onChange={onMoodChange}
        set={mood != null}
      />
      <SliderBlock
        id={stressId}
        label="Stress"
        subtle="How activated is your body?"
        value={stressVal}
        displayEmoji={STRESS_EMOJIS[emojiIndex(stressVal)]}
        color={stressColor(stressVal)}
        onChange={onStressChange}
        set={stress != null}
      />
    </div>
  );
}

function SliderBlock({
  id,
  label,
  subtle,
  value,
  displayEmoji,
  color,
  onChange,
  set,
}: {
  id: string;
  label: string;
  subtle: string;
  value: number;
  displayEmoji: string;
  color: string;
  onChange: (v: number) => void;
  set: boolean;
}) {
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="bg-warm-50/80 rounded-3xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label htmlFor={id} className="text-sm font-semibold text-warm-700">
            {label}
          </label>
          <p className="text-xs text-warm-400 mt-0.5">{subtle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-2xl transition-transform duration-300"
            style={{ transform: `scale(${0.9 + (value / 10) * 0.25})` }}
            aria-hidden
          >
            {displayEmoji}
          </span>
          <span
            className="text-sm font-semibold tabular-nums w-6 text-right"
            style={{ color: set ? color : '#c2c2c2' }}
          >
            {set ? value : '—'}
          </span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e0e0e0 ${pct}%, #e0e0e0 100%)`,
          accentColor: color,
        }}
      />
      <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider text-warm-300 font-medium">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  );
}
