import { useState } from 'react';
import { Heart, Brain, Wind, AlertCircle, Users, Sparkles, ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import { useCurrentCycle, useCycleReadings } from '../lib/hooks';
import { TWW_DAYS, type TWWDay } from '../lib/tww-data';
import { differenceInDays } from 'date-fns';

type CardType = 'biology' | 'symptoms' | 'mindfulness' | 'dont' | 'partner' | 'affirmation';

const cardConfig: { key: CardType; label: string; icon: React.ReactNode; gradient: string; textColor: string }[] = [
  { key: 'biology', label: 'What\'s Happening', icon: <Brain size={16} strokeWidth={1.5} />, gradient: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-700' },
  { key: 'symptoms', label: 'Symptom Context', icon: <Heart size={16} strokeWidth={1.5} />, gradient: 'from-rose-400 to-pink-400', textColor: 'text-rose-600' },
  { key: 'mindfulness', label: 'Today\'s Practice', icon: <Wind size={16} strokeWidth={1.5} />, gradient: 'from-emerald-400 to-teal-400', textColor: 'text-emerald-700' },
  { key: 'dont', label: 'What NOT To Do', icon: <AlertCircle size={16} strokeWidth={1.5} />, gradient: 'from-amber-400 to-orange-400', textColor: 'text-amber-700' },
  { key: 'partner', label: 'For Your Partner', icon: <Users size={16} strokeWidth={1.5} />, gradient: 'from-indigo-400 to-violet-400', textColor: 'text-indigo-600' },
  { key: 'affirmation', label: 'Affirmation', icon: <Sparkles size={16} strokeWidth={1.5} />, gradient: 'from-violet-400 to-fuchsia-400', textColor: 'text-violet-600' },
];

export default function TWWCompanion() {
  const cycle = useCurrentCycle();
  const readings = useCycleReadings(cycle?.id);
  const [previewDPO, setPreviewDPO] = useState<number | null>(null);

  const today = new Date();
  let realDPO: number | null = null;

  if (cycle) {
    const startDate = new Date(cycle.startDate + 'T00:00:00');
    const cycleDay = differenceInDays(today, startDate) + 1;

    const ovulationReading = readings.find(r => r.fertilityStatus === 'confirmed_ovulation');
    const ovulationDay = cycle.ovulationDay ?? ovulationReading?.cycleDay;

    if (ovulationDay) {
      realDPO = cycleDay - ovulationDay;
    } else if (cycleDay > 14) {
      realDPO = cycleDay - 14;
    }
  }

  const dpo = previewDPO ?? realDPO ?? 1;
  const dayData = TWW_DAYS.find(d => d.dpo === dpo) ?? TWW_DAYS[0];
  const isInTWW = realDPO !== null && realDPO >= 1 && realDPO <= 14;
  const isPreviewing = previewDPO !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-warm-800">TWW Companion</h1>
        <p className="text-sm text-warm-400 mt-0.5">
          {isInTWW && !isPreviewing
            ? `You're ${realDPO} DPO. Here's your daily guide.`
            : 'Your daily guide through the two-week wait.'}
        </p>
      </div>

      {/* DPO Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPreviewDPO(Math.max(1, dpo - 1))}
          className="p-2 rounded-xl bg-white border border-warm-200 text-warm-400 hover:text-warm-600 hover:bg-warm-50 transition-all active:scale-95"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 px-1">
          {TWW_DAYS.map(d => (
            <button
              key={d.dpo}
              onClick={() => setPreviewDPO(d.dpo === realDPO ? null : d.dpo)}
              className={`shrink-0 w-9 h-9 rounded-xl text-xs font-semibold transition-all duration-200 ${
                d.dpo === dpo
                  ? 'bg-warm-800 text-white shadow-sm'
                  : d.dpo === realDPO
                  ? 'bg-warm-100 text-warm-700 border border-warm-300'
                  : 'bg-white border border-warm-100 text-warm-400 hover:bg-warm-50 hover:text-warm-600'
              }`}
            >
              {d.dpo}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPreviewDPO(Math.min(14, dpo + 1))}
          className="p-2 rounded-xl bg-white border border-warm-200 text-warm-400 hover:text-warm-600 hover:bg-warm-50 transition-all active:scale-95"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* DPO Label */}
      <div className="text-center">
        <span className="text-4xl font-bold text-warm-800">{dpo} DPO</span>
        <span className="text-sm text-warm-400 ml-2">days past ovulation</span>
        {isPreviewing && (
          <button
            onClick={() => setPreviewDPO(null)}
            className="ml-3 text-xs text-violet-500 hover:text-violet-700 font-medium"
          >
            back to today
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {cardConfig.map(({ key, label, icon, gradient, textColor }) => (
          <TWWCard
            key={key}
            label={label}
            icon={icon}
            gradient={gradient}
            textColor={textColor}
            content={getCardContent(dayData, key)}
          />
        ))}
      </div>

      {/* Evening reflection */}
      <div className="bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 rounded-3xl p-7 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-violet-300" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">Tonight</span>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">
          Before sleep, place your hands on your belly. Three slow breaths. Whatever is happening inside you, your body deserves kindness tonight. Sleep well.
        </p>
      </div>
    </div>
  );
}

function getCardContent(day: TWWDay, type: CardType): string {
  switch (type) {
    case 'biology': return day.biology;
    case 'symptoms': return day.symptomContext;
    case 'mindfulness': return day.mindfulness;
    case 'dont': return day.dontDoThis;
    case 'partner': return day.partnerCard;
    case 'affirmation': return day.affirmation;
  }
}

function TWWCard({ label, icon, gradient, textColor, content }: {
  label: string;
  icon: React.ReactNode;
  gradient: string;
  textColor: string;
  content: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-warm-100 overflow-hidden shadow-sm">
      <div className={`bg-gradient-to-r ${gradient} px-6 py-3 flex items-center gap-2`}>
        <span className="text-white/80">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/90">{label}</span>
      </div>
      <div className="px-6 py-5">
        <p className={`text-sm leading-relaxed ${textColor}`}>{content}</p>
      </div>
    </div>
  );
}
