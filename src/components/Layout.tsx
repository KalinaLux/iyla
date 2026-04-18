import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  LineChart,
  FlaskConical,
  Pill,
  CalendarDays,
  Heart,
  Brain,
  Menu,
  X,
  Sparkles,
  Syringe,
  Wind,
  Moon,
  FileText,
  Feather,
  FolderOpen,
  Users,
  Lock,
  Link,
  BookOpen,
  HandHeart,
} from 'lucide-react';
import { useState } from 'react';

const navSections: { section: string; items: { to: string; icon: typeof LayoutDashboard; label: string }[] }[] = [
  {
    section: 'Daily',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/tww', icon: Heart, label: 'TWW Companion' },
      { to: '/breathwork', icon: Wind, label: 'Breathwork' },
      { to: '/reconnect', icon: HandHeart, label: 'Reconnect' },
    ],
  },
  {
    section: 'Tracking',
    items: [
      { to: '/cycle', icon: CalendarDays, label: 'Cycle History' },
      { to: '/charts', icon: LineChart, label: 'Charts' },
      { to: '/labs', icon: FlaskConical, label: 'Labs' },
      { to: '/supplements', icon: Pill, label: 'Supplements' },
      { to: '/sleep', icon: Moon, label: 'Sleep Analysis' },
    ],
  },
  {
    section: 'Advanced',
    items: [
      { to: '/ivf', icon: Syringe, label: 'IVF Module' },
      { to: '/insights', icon: Brain, label: 'Insights' },
      { to: '/loss-support', icon: Feather, label: 'Loss Support' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { to: '/report', icon: FileText, label: 'Provider Report' },
      { to: '/vault', icon: FolderOpen, label: 'Document Vault' },
      { to: '/partner', icon: Users, label: 'Partner View' },
      { to: '/pairing', icon: Link, label: 'Partner Pairing' },
      { to: '/dictionary', icon: BookOpen, label: 'TTC Dictionary' },
      { to: '/privacy', icon: Lock, label: 'Privacy & Data' },
    ],
  },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-warm-100">
        <div className="p-6 border-b border-warm-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center shadow-sm shadow-teal-200/50">
              <Sparkles size={14} className="text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-warm-800 tracking-tight">
                <span className="text-[22px]">i</span>yla
              </h1>
              <p className="text-[10px] text-warm-400 tracking-wide">All your fertility data. One clear picture.</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navSections.map(({ section, items }) => (
            <div key={section}>
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-warm-300">
                {section}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-warm-50 text-warm-800 shadow-sm shadow-warm-100/50'
                          : 'text-warm-400 hover:bg-warm-50 hover:text-warm-600'
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={1.5} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-warm-100">
          <div className="px-4 py-3 bg-warm-50 rounded-2xl">
            <p className="text-xs font-medium text-warm-600">Your data stays here</p>
            <p className="text-[11px] text-warm-400 mt-0.5">Local-first. Private. Only a summary syncs to your partner.</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-warm-100 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center">
            <Sparkles size={12} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-base font-bold text-warm-800"><span className="text-lg">i</span>yla</h1>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-warm-400 hover:text-warm-600 rounded-xl"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl rounded-r-3xl flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}>
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto pb-8">
              {navSections.map(({ section, items }) => (
                <div key={section}>
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-warm-300">
                    {section}
                  </p>
                  <div className="space-y-0.5">
                    {items.map(({ to, icon: Icon, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-warm-50 text-warm-800'
                              : 'text-warm-400 hover:bg-warm-50 hover:text-warm-600'
                          }`
                        }
                      >
                        <Icon size={17} strokeWidth={1.5} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:pt-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)' }}>
        <div className="max-w-5xl mx-auto p-5 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
