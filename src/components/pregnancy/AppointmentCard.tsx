import { format } from 'date-fns';
import {
  Activity,
  Droplet,
  Stethoscope,
  ClipboardList,
  TestTube,
  Calendar,
  Check,
  Clock,
} from 'lucide-react';
import type { PregnancyAppointment } from '../../lib/pregnancy-db';

interface Props {
  appointment: PregnancyAppointment;
  onClick?: () => void;
}

const TYPE_META: Record<
  PregnancyAppointment['type'],
  { icon: typeof Activity; label: string; tint: string }
> = {
  ultrasound: { icon: Activity, label: 'Ultrasound', tint: 'bg-teal-50 text-teal-600' },
  blood_draw: { icon: Droplet, label: 'Blood draw', tint: 'bg-rose-50 text-rose-500' },
  ob_visit: { icon: Stethoscope, label: 'OB visit', tint: 'bg-lavender-50 text-lavender-600' },
  nst: { icon: ClipboardList, label: 'NST', tint: 'bg-honey-50 text-honey-600' },
  glucose: { icon: TestTube, label: 'Glucose', tint: 'bg-amber-50 text-amber-600' },
  other: { icon: Calendar, label: 'Other', tint: 'bg-warm-100 text-warm-500' },
};

export default function AppointmentCard({ appointment, onClick }: Props) {
  const meta = TYPE_META[appointment.type];
  const Icon = meta.icon;
  const dateObj = new Date(appointment.date + 'T00:00:00');
  const isPast = dateObj < new Date(new Date().toDateString());

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-warm-100 p-4 flex items-center gap-4 hover:shadow-sm hover:border-warm-200 transition-all"
    >
      <div className={`w-11 h-11 rounded-2xl ${meta.tint} flex items-center justify-center shrink-0`}>
        <Icon size={17} strokeWidth={1.6} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-warm-800 truncate">
            {appointment.notes?.split('\n')[0] || meta.label}
          </p>
          {appointment.completed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <Check size={10} strokeWidth={3} />
              Done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-warm-500">
          <span>{format(dateObj, 'EEE, MMM d')}</span>
          {appointment.time && (
            <>
              <span className="text-warm-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={10} strokeWidth={1.5} />
                {appointment.time}
              </span>
            </>
          )}
          {appointment.provider && (
            <>
              <span className="text-warm-300">·</span>
              <span className="truncate">{appointment.provider}</span>
            </>
          )}
        </div>
        {appointment.outcome && (
          <p className="text-xs text-emerald-600 mt-1 truncate">{appointment.outcome}</p>
        )}
      </div>

      <span
        className={`text-[10px] font-semibold shrink-0 px-2 py-1 rounded-full ${
          appointment.completed
            ? 'text-emerald-600 bg-emerald-50'
            : isPast
              ? 'text-warm-400 bg-warm-50'
              : 'text-lavender-600 bg-lavender-50'
        }`}
      >
        {appointment.completed ? 'Complete' : isPast ? 'Overdue' : 'Upcoming'}
      </span>
    </button>
  );
}
