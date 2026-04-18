import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  Baby,
  Calendar,
  Heart,
  Plus,
  Sparkles,
  Feather,
  PartyPopper,
  ChevronRight,
  CalendarClock,
  Shield,
} from 'lucide-react';
import Modal from '../components/Modal';
import { pregnancyDb, type PregnancyAppointment } from '../lib/pregnancy-db';
import {
  APPOINTMENT_SCHEDULE,
  computePregnancyWeek,
  daysUntilDue,
  getMilestone,
  setPregnancyModeFlag,
} from '../lib/pregnancy';
import WeekCard from '../components/pregnancy/WeekCard';
import PregnancyTimeline from '../components/pregnancy/PregnancyTimeline';
import AppointmentCard from '../components/pregnancy/AppointmentCard';
import PregnancySymptomLog from '../components/pregnancy/PregnancySymptomLog';

const APPOINTMENT_TYPES: { value: PregnancyAppointment['type']; label: string }[] = [
  { value: 'ob_visit', label: 'OB visit' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'blood_draw', label: 'Blood draw' },
  { value: 'glucose', label: 'Glucose test' },
  { value: 'nst', label: 'Non-stress test (NST)' },
  { value: 'other', label: 'Other' },
];

export default function Pregnancy() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const pregnancy = useLiveQuery(
    () => pregnancyDb.pregnancies.where('status').equals('active').first(),
    [],
  );

  const appointments = useLiveQuery(
    async () => {
      if (!pregnancy?.id) return [] as PregnancyAppointment[];
      const rows = await pregnancyDb.appointments
        .where('pregnancyId')
        .equals(pregnancy.id)
        .toArray();
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    },
    [pregnancy?.id],
  ) ?? [];

  const [showAddAppt, setShowAddAppt] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitMode, setExitMode] = useState<'completed' | 'loss' | null>(null);
  const [exitDate, setExitDate] = useState<string>(today);
  const [exitNotes, setExitNotes] = useState('');

  const [newAppt, setNewAppt] = useState({
    date: today,
    time: '',
    type: 'ob_visit' as PregnancyAppointment['type'],
    provider: '',
    location: '',
    notes: '',
  });

  const weekInfo = useMemo(
    () => (pregnancy ? computePregnancyWeek(pregnancy.lmpDate, new Date()) : null),
    [pregnancy],
  );

  if (!pregnancy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-lavender-50 flex items-center justify-center">
          <Baby size={24} className="text-lavender-500" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold text-warm-800">Pregnancy mode isn't active</h2>
        <p className="text-sm text-warm-500 max-w-sm">
          When you log a positive test on the Dashboard, iyla will transition into
          pregnancy mode and this page will fill in.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-5 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { week, day, trimester } = weekInfo!;
  const milestone = getMilestone(week);
  const untilDue = daysUntilDue(pregnancy.estimatedDueDate, new Date());

  const upcoming = appointments
    .filter((a) => !a.completed && a.date >= today)
    .slice(0, 3);
  const missingSuggestions = APPOINTMENT_SCHEDULE.filter(
    (s) => s.week >= week && !appointments.some((a) => Math.abs(weekFromLmp(a.date, pregnancy.lmpDate) - s.week) <= 1),
  ).slice(0, 3);

  async function handleAddAppt() {
    if (!pregnancy?.id || !newAppt.date) return;
    await pregnancyDb.appointments.add({
      pregnancyId: pregnancy.id,
      date: newAppt.date,
      time: newAppt.time || undefined,
      type: newAppt.type,
      provider: newAppt.provider || undefined,
      location: newAppt.location || undefined,
      notes: newAppt.notes || undefined,
      completed: false,
    });
    setNewAppt({ date: today, time: '', type: 'ob_visit', provider: '', location: '', notes: '' });
    setShowAddAppt(false);
  }

  async function handleQuickAddSuggestion(s: (typeof APPOINTMENT_SCHEDULE)[number]) {
    if (!pregnancy?.id) return;
    const lmp = new Date(pregnancy.lmpDate + 'T00:00:00');
    const suggested = new Date(lmp.getTime() + (s.week - 1) * 7 * 24 * 60 * 60 * 1000);
    await pregnancyDb.appointments.add({
      pregnancyId: pregnancy.id,
      date: format(suggested, 'yyyy-MM-dd'),
      type: s.type,
      notes: `${s.title}\n${s.description}`,
      completed: false,
    });
  }

  async function handleToggleAppt(a: PregnancyAppointment) {
    if (!a.id) return;
    await pregnancyDb.appointments.update(a.id, { completed: !a.completed });
  }

  async function handleExit() {
    if (!pregnancy?.id || !exitMode) return;
    const now = new Date().toISOString();
    await pregnancyDb.pregnancies.update(pregnancy.id, {
      status: exitMode,
      outcomeDate: exitDate,
      notes: [pregnancy.notes, exitNotes].filter(Boolean).join('\n\n— Outcome note —\n') || undefined,
      updatedAt: now,
    });
    setPregnancyModeFlag(false);
    setShowExitModal(false);
    if (exitMode === 'loss') {
      navigate('/loss-support');
    } else {
      navigate('/');
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Pregnancy</h1>
          <p className="text-sm text-warm-400 mt-0.5">
            Week {week} · {format(new Date(pregnancy.estimatedDueDate + 'T00:00:00'), 'MMM d, yyyy')} due
          </p>
        </div>
        <button
          onClick={() => setShowAddAppt(true)}
          className="flex items-center gap-2 bg-warm-800 text-white px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          Appointment
        </button>
      </div>

      {/* Week hero */}
      <WeekCard
        week={week}
        day={day}
        trimester={trimester}
        milestone={milestone}
        daysUntilDue={untilDue}
      />

      {/* Key dates */}
      <div className="grid grid-cols-3 gap-3">
        <KeyDate label="Due date" value={format(new Date(pregnancy.estimatedDueDate + 'T00:00:00'), 'MMM d')} sub={format(new Date(pregnancy.estimatedDueDate + 'T00:00:00'), 'yyyy')} />
        <KeyDate label="Trimester" value={`T${trimester}`} sub={trimester === 1 ? 'of 3' : trimester === 2 ? 'halfway zone' : 'home stretch'} />
        <KeyDate label={untilDue >= 0 ? 'Days to go' : 'Past due by'} value={`${Math.abs(untilDue)}`} sub={untilDue >= 0 ? 'days' : 'days'} />
      </div>

      {/* This week's focus */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-lavender-500" strokeWidth={2} />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-warm-500">
            This week's focus
          </p>
        </div>
        <p className="text-sm text-warm-700 leading-relaxed">{milestone.momTip}</p>
      </div>

      {/* Loss-risk awareness — only weeks 4–12, gently framed */}
      {week >= 4 && week <= 12 && milestone.lossRiskNote && (
        <div className="rounded-3xl bg-rose-50/50 border border-rose-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/70 flex items-center justify-center shrink-0">
              <Heart size={15} className="text-rose-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 mb-1">
                Gentle note
              </p>
              <p className="text-sm text-warm-700 leading-relaxed">
                {milestone.lossRiskNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's symptom log */}
      <PregnancySymptomLog
        pregnancyId={pregnancy.id!}
        week={week}
        day={day}
        trimester={trimester}
      />

      {/* Upcoming appointments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-warm-500" strokeWidth={1.5} />
            <h2 className="text-base font-semibold text-warm-800">Upcoming appointments</h2>
          </div>
          {appointments.length > 3 && (
            <span className="text-xs text-warm-400">{appointments.length} total</span>
          )}
        </div>

        {upcoming.length === 0 ? (
          <div className="bg-white rounded-3xl border border-warm-100 p-6 text-center">
            <Calendar size={22} className="text-warm-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-warm-500 mb-3">No appointments scheduled.</p>
            {missingSuggestions.length > 0 && (
              <div className="space-y-2 text-left mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-400 text-center">
                  Suggested next
                </p>
                {missingSuggestions.map((s) => (
                  <button
                    key={`${s.week}-${s.type}`}
                    onClick={() => handleQuickAddSuggestion(s)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-warm-50 border border-warm-100 hover:bg-warm-100 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-warm-700">
                        Week {s.week} — {s.title}
                      </p>
                      <p className="text-xs text-warm-400 mt-0.5">{s.description}</p>
                    </div>
                    <ChevronRight size={14} className="text-warm-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onClick={() => handleToggleAppt(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <PregnancyTimeline currentWeek={week} />

      {/* All appointments (history) */}
      {appointments.length > 0 && (
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 space-y-3">
          <h3 className="text-sm font-semibold text-warm-700">All appointments</h3>
          <div className="space-y-2">
            {appointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a} onClick={() => handleToggleAppt(a)} />
            ))}
          </div>
        </div>
      )}

      {/* Exit */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-warm-500" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-warm-700">Exit pregnancy mode</h3>
        </div>
        <p className="text-xs text-warm-500 leading-relaxed">
          You can step out of pregnancy mode at any time. Your data is preserved either way.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => {
              setExitMode('completed');
              setShowExitModal(true);
            }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-2xl bg-white/80 flex items-center justify-center shrink-0">
              <PartyPopper size={16} className="text-emerald-600" strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Completed — celebrate</p>
              <p className="text-xs text-emerald-600/80 mt-0.5">Mark this pregnancy as completed.</p>
            </div>
          </button>
          <button
            onClick={() => {
              setExitMode('loss');
              setShowExitModal(true);
            }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-warm-200 bg-warm-50/60 hover:bg-warm-50 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-2xl bg-white/80 flex items-center justify-center shrink-0">
              <Feather size={16} className="text-warm-500" strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-sm font-semibold text-warm-700">I lost the pregnancy</p>
              <p className="text-xs text-warm-500 mt-0.5">Hold space, and move to Support & Recovery.</p>
            </div>
          </button>
        </div>
      </div>

      {/* Add appointment modal */}
      <Modal
        open={showAddAppt}
        onClose={() => setShowAddAppt(false)}
        title="Add appointment"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">Date</label>
              <input
                type="date"
                value={newAppt.date}
                onChange={(e) => setNewAppt((n) => ({ ...n, date: e.target.value }))}
                className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">Time</label>
              <input
                type="time"
                value={newAppt.time}
                onChange={(e) => setNewAppt((n) => ({ ...n, time: e.target.value }))}
                className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Type</label>
            <select
              value={newAppt.type}
              onChange={(e) =>
                setNewAppt((n) => ({ ...n, type: e.target.value as PregnancyAppointment['type'] }))
              }
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Provider</label>
            <input
              value={newAppt.provider}
              onChange={(e) => setNewAppt((n) => ({ ...n, provider: e.target.value }))}
              placeholder="Dr. Name"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 placeholder:text-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Location</label>
            <input
              value={newAppt.location}
              onChange={(e) => setNewAppt((n) => ({ ...n, location: e.target.value }))}
              placeholder="Clinic or address"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 placeholder:text-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Notes</label>
            <textarea
              value={newAppt.notes}
              onChange={(e) => setNewAppt((n) => ({ ...n, notes: e.target.value }))}
              rows={2}
              placeholder="Questions to ask, reminders…"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 placeholder:text-warm-300 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddAppt(false)}
              className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAppt}
              className="px-6 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Exit modal */}
      <Modal
        open={showExitModal}
        onClose={() => setShowExitModal(false)}
        title={exitMode === 'completed' ? 'Celebrate the completion' : 'Hold space'}
      >
        <div className="space-y-4">
          {exitMode === 'completed' ? (
            <p className="text-sm text-warm-600 leading-relaxed">
              What an arc. When you mark the outcome date, iyla will archive this pregnancy
              and step out of pregnancy mode. Your data stays with you.
            </p>
          ) : (
            <p className="text-sm text-warm-600 leading-relaxed">
              We're so sorry. We'll gently close this record and take you to Support & Recovery —
              you can log as much or as little there as feels right.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">
              {exitMode === 'completed' ? 'Birth date' : 'Date'}
            </label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">
              Note <span className="text-warm-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              rows={3}
              placeholder={
                exitMode === 'completed'
                  ? 'A line about today.'
                  : 'Only if you want to. Whatever is true.'
              }
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 placeholder:text-warm-300 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowExitModal(false)}
              className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl"
            >
              Cancel
            </button>
            <button
              onClick={handleExit}
              className={`px-6 py-2.5 rounded-2xl text-sm font-medium text-white shadow-sm transition-all ${
                exitMode === 'completed'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-warm-700 hover:bg-warm-800'
              }`}
            >
              {exitMode === 'completed' ? 'Mark completed' : 'Hold space & continue'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Compute the pregnancy week an ISO date falls in, given LMP. */
function weekFromLmp(isoDate: string, lmpDate: string): number {
  const lmp = new Date(lmpDate + 'T00:00:00');
  const d = new Date(isoDate + 'T00:00:00');
  const diffDays = Math.floor((d.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function KeyDate({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-100 px-4 py-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-400">
        {label}
      </p>
      <p className="text-lg font-semibold text-warm-800 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-warm-400 mt-0.5">{sub}</p>}
    </div>
  );
}
