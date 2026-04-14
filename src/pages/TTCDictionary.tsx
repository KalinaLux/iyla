import { useState } from 'react';
import { BookOpen, User, Users, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { TTC_DICTIONARY, CATEGORIES, type DictionaryEntry } from '../lib/ttc-dictionary';
import { getSelectedTheme, getThemeById, SIGNAL_THEMES } from '../lib/signal-themes';

type ViewMode = 'hers' | 'his';

function EntryCard({ entry, mode, themeId }: { entry: DictionaryEntry; mode: ViewMode; themeId: string }) {
  const [expanded, setExpanded] = useState(false);
  const theme = getThemeById(themeId);

  const definition = mode === 'hers' ? entry.herDefinition : entry.themedDefinitions[themeId] || entry.herDefinition;

  return (
    <div className="bg-white rounded-2xl border border-warm-100 overflow-hidden transition-all duration-200 hover:shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-warm-800">{entry.term}</h3>
            {entry.abbreviation && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-warm-100 text-warm-500 rounded-lg">
                {entry.abbreviation}
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-warm-400 mt-1 line-clamp-2">{definition}</p>
          )}
        </div>
        <div className="mt-1 flex-shrink-0">
          {expanded ? (
            <ChevronUp size={16} className="text-warm-300" />
          ) : (
            <ChevronDown size={16} className="text-warm-300" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {mode === 'his' && themeId !== 'silent' ? (
            <>
              <div className={`rounded-2xl p-4 bg-gradient-to-br ${theme.gradient} bg-opacity-5`}>
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{theme.emoji}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                      {theme.name} Edition
                    </span>
                  </div>
                  <p className="text-sm text-warm-700 leading-relaxed">{definition}</p>
                </div>
              </div>
              <details className="group">
                <summary className="text-xs text-warm-400 cursor-pointer hover:text-warm-600 transition-colors">
                  Show medical definition
                </summary>
                <p className="text-xs text-warm-500 leading-relaxed mt-2 pl-3 border-l-2 border-warm-100">
                  {entry.herDefinition}
                </p>
              </details>
            </>
          ) : (
            <div className="bg-warm-50 rounded-xl p-4">
              <p className="text-sm text-warm-600 leading-relaxed">{definition}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TTCDictionary() {
  const [mode, setMode] = useState<ViewMode>('hers');
  const [themeId, setThemeId] = useState(() => getSelectedTheme());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredEntries = TTC_DICTIONARY.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.abbreviation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.herDefinition.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || entry.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedEntries = CATEGORIES.map((cat) => ({
    ...cat,
    entries: filteredEntries.filter((e) => e.category === cat.id),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-warm-800 tracking-tight">TTC Dictionary</h1>
        <p className="text-sm text-warm-400 mt-1">Every term you need, explained your way</p>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-2">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('hers')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
              mode === 'hers'
                ? 'bg-rose-50 text-rose-600 shadow-sm'
                : 'text-warm-400 hover:text-warm-600 hover:bg-warm-50'
            }`}
          >
            <User size={16} strokeWidth={1.5} />
            Her Version
          </button>
          <button
            onClick={() => setMode('his')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
              mode === 'his'
                ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                : 'text-warm-400 hover:text-warm-600 hover:bg-warm-50'
            }`}
          >
            <Users size={16} strokeWidth={1.5} />
            His Version
          </button>
        </div>
      </div>

      {/* Theme Picker (His mode only) */}
      {mode === 'his' && (
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-warm-300 mb-3">
            Translation Style
          </p>
          <div className="flex flex-wrap gap-2">
            {SIGNAL_THEMES.filter((t) => t.id !== 'silent').map((theme) => (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  themeId === theme.id
                    ? 'bg-warm-800 text-white shadow-sm'
                    : 'bg-warm-50 text-warm-500 hover:bg-warm-100 hover:text-warm-700'
                }`}
              >
                {theme.emoji} {theme.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Intro Card */}
      <div
        className={`rounded-3xl p-6 md:p-8 text-white shadow-lg ${
          mode === 'hers'
            ? 'bg-gradient-to-br from-rose-400 to-pink-500 shadow-rose-200/40'
            : `bg-gradient-to-br ${getThemeById(themeId).gradient} shadow-warm-200/40`
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <BookOpen size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {mode === 'hers' ? 'The Real Definitions' : `The ${getThemeById(themeId).name} Translation`}
            </h2>
            <p className="text-sm text-white/70">
              {mode === 'hers'
                ? 'Medical accuracy meets human readability'
                : `Every fertility term, decoded ${getThemeById(themeId).emoji}`}
            </p>
          </div>
        </div>
        <p className="text-sm text-white/80 leading-relaxed mt-2">
          {mode === 'hers'
            ? 'Clear, compassionate explanations of every TTC term — from the basics to the deeply medical. No jargon left behind.'
            : `Because "LH surge" shouldn't require a medical degree to understand. Here's everything translated into language that actually makes sense.`}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-300" />
        <input
          type="text"
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-warm-100 rounded-2xl text-sm text-warm-800 placeholder-warm-300 focus:outline-none focus:ring-2 focus:ring-warm-200 transition-all"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
            activeCategory === null
              ? 'bg-warm-800 text-white'
              : 'bg-warm-50 text-warm-400 hover:text-warm-600'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
              activeCategory === cat.id
                ? 'bg-warm-800 text-white'
                : 'bg-warm-50 text-warm-400 hover:text-warm-600'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Dictionary Entries */}
      {groupedEntries.map((group) => (
        <div key={group.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">{group.emoji}</span>
            <h2 className="text-sm font-semibold text-warm-600">{group.label}</h2>
            <span className="text-xs text-warm-300">({group.entries.length})</span>
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <EntryCard key={entry.term} entry={entry} mode={mode} themeId={themeId} />
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {groupedEntries.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={32} className="mx-auto text-warm-200 mb-3" />
          <p className="text-sm text-warm-400">No terms match your search</p>
        </div>
      )}

      {/* Footer */}
      <div className="bg-warm-50 rounded-2xl p-5 text-center">
        <p className="text-xs text-warm-400">
          {mode === 'hers'
            ? 'Definitions are educational and not medical advice. Always consult your healthcare provider.'
            : 'Translations are for entertainment and education. The real definitions are always one tap away.'}
        </p>
      </div>
    </div>
  );
}
