import { useState } from 'react';
import Dexie from 'dexie';
import { format } from 'date-fns';
import {
  Shield,
  Lock,
  EyeOff,
  UserX,
  Download,
  Trash2,
  AlertTriangle,
  Heart,
  Code,
  Stethoscope,
  BookHeart,
} from 'lucide-react';
import { db } from '../lib/db';
import { breathworkDb } from '../lib/breathwork-rewards';
import { vaultDb } from '../lib/vault-db';
import { reconnectDb } from '../lib/reconnect-data';
import { journalDb } from '../lib/journal-db';
import { getTerminologyMode, setTerminologyMode, type TerminologyMode } from '../lib/clinical-terminology';

type DeleteTarget =
  | 'cycles'
  | 'labs'
  | 'supplements'
  | 'breathwork'
  | 'journal'
  | 'documents'
  | 'everything';

export default function Privacy() {
  const [confirmTarget, setConfirmTarget] = useState<DeleteTarget | null>(null);
  const [deletedTargets, setDeletedTargets] = useState<Set<DeleteTarget>>(new Set());
  const [termMode, setTermMode] = useState<TerminologyMode>(getTerminologyMode());

  const handleExportJSON = async () => {
    const [cycles, readings, labs, supplements, protocols, supplementLogs] =
      await Promise.all([
        db.cycles.toArray(),
        db.readings.toArray(),
        db.labs.toArray(),
        db.supplements.toArray(),
        db.protocols.toArray(),
        db.supplementLogs.toArray(),
      ]);

    const [breathworkLogs, breathworkRewards] = await Promise.all([
      breathworkDb.logs.toArray(),
      breathworkDb.rewards.toArray(),
    ]);

    // Reconnect data
    let reconnectProfiles: unknown[] = [];
    let reconnectSessions: unknown[] = [];
    try {
      reconnectProfiles = await reconnectDb.profiles.toArray();
      reconnectSessions = await reconnectDb.sessions.toArray();
    } catch { /* DB may not exist yet */ }

    // Vault documents — convert blobs to base64 so JSON can carry them
    let vaultDocuments: unknown[] = [];
    try {
      const docs = await vaultDb.documents.toArray();
      vaultDocuments = await Promise.all(
        docs.map(async (d) => ({
          ...d,
          blob: undefined,
          blobBase64: await blobToBase64(d.blob),
        })),
      );
    } catch { /* DB may not exist yet */ }

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      data: {
        cycles,
        readings,
        labs,
        supplements,
        protocols,
        supplementLogs,
        breathworkLogs,
        breathworkRewards,
        reconnectProfiles,
        reconnectSessions,
        vaultDocuments,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iyla-data-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function blobToBase64(b: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(b);
    });
  }

  const handleExportJournal = async () => {
    const entries = await journalDb.entries.toArray();
    const payload = {
      exportedAt: new Date().toISOString(),
      kind: 'iyla-journal',
      version: '1.0',
      note: 'Private journal export. Not included in the standard data export by design.',
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iyla-journal-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const cycles = await db.cycles.toArray();
    if (cycles.length === 0) return;

    const keys = Object.keys(cycles[0]) as (keyof (typeof cycles)[0])[];
    const header = keys.join(',');
    const rows = cycles.map((c) =>
      keys
        .map((k) => {
          const val = c[k];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iyla-cycles-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (target: DeleteTarget) => {
    if (confirmTarget !== target) {
      setConfirmTarget(target);
      return;
    }

    switch (target) {
      case 'cycles':
        await Promise.all([db.cycles.clear(), db.readings.clear()]);
        break;
      case 'labs':
        await db.labs.clear();
        break;
      case 'supplements':
        await Promise.all([
          db.supplements.clear(),
          db.protocols.clear(),
          db.supplementLogs.clear(),
        ]);
        break;
      case 'breathwork':
        await Promise.all([
          breathworkDb.logs.clear(),
          breathworkDb.rewards.clear(),
        ]);
        break;
      case 'journal':
        await journalDb.entries.clear();
        break;
      case 'documents': {
        await Dexie.delete('IylaVaultDB');
        break;
      }
      case 'everything':
        await Promise.all([
          db.cycles.clear(),
          db.readings.clear(),
          db.labs.clear(),
          db.supplements.clear(),
          db.protocols.clear(),
          db.supplementLogs.clear(),
          breathworkDb.logs.clear(),
          breathworkDb.rewards.clear(),
          journalDb.entries.clear(),
        ]);
        try { await Dexie.delete('IylaVaultDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaReconnectDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaIVFDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaLossDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaRemindersDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaPregnancyDB'); } catch { /* ignore */ }
        try { await Dexie.delete('IylaMedicationsDB'); } catch { /* ignore */ }
        try { localStorage.removeItem('iyla-reminders-lastFired'); } catch { /* ignore */ }
        // Clear partner pairing + role + theme + onboarding + pregnancy flags
        ['iyla-user-role', 'iyla-onboarded', 'iyla-signal-theme', 'iyla_pair_code', 'iyla-pregnancy-mode']
          .forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
        break;
    }

    setDeletedTargets((prev) => new Set(prev).add(target));
    setConfirmTarget(null);
  };

  const cancelConfirm = () => setConfirmTarget(null);

  const deleteItems: {
    target: DeleteTarget;
    label: string;
    description: string;
  }[] = [
    {
      target: 'cycles',
      label: 'Delete all cycle data',
      description: 'Cycles and daily readings',
    },
    {
      target: 'labs',
      label: 'Delete all lab results',
      description: 'Lab tests and values',
    },
    {
      target: 'supplements',
      label: 'Delete all supplement data',
      description: 'Supplements, protocols, and logs',
    },
    {
      target: 'breathwork',
      label: 'Delete breathwork history',
      description: 'Session logs and streak rewards',
    },
    {
      target: 'journal',
      label: 'Delete journal entries',
      description: 'All private journal entries (morning, evening, freeform)',
    },
    {
      target: 'documents',
      label: 'Delete all documents',
      description: 'Everything in the Document Vault',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-warm-700 to-warm-900 p-8 md:p-10 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium text-white/70">
            Privacy & Data Management
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
          Your Data Belongs to You. Period.
        </h1>
        <p className="text-white/80 max-w-2xl leading-relaxed">
          iyla is built on a local-first, zero-cloud architecture. Your
          fertility data lives only on your device. We can't see it, sell
          it, or share it — because we never have it.
        </p>
        <p className="mt-6 text-xs text-white/40 font-medium tracking-wide">
          Solairen Health
        </p>
      </div>

      {/* How Your Data Is Protected */}
      <div>
        <h2 className="text-lg font-semibold text-warm-800 mb-3 px-1">
          How Your Data Is Protected
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: 'Local-First Storage',
              body: 'All data is stored in IndexedDB on your device. Nothing is sent to any server.',
            },
            {
              icon: UserX,
              title: 'No Account Required',
              body: 'No email, no login, no tracking. Your identity stays yours.',
            },
            {
              icon: EyeOff,
              title: 'No Analytics',
              body: 'Zero telemetry, zero tracking pixels, zero third-party scripts.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6"
            >
              <div className="w-10 h-10 rounded-2xl bg-warm-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-warm-600" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-warm-800 mb-1">
                {title}
              </h3>
              <p className="text-sm text-warm-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Terminology Mode */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <Stethoscope size={20} className="text-warm-600" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Language Mode
          </h2>
        </div>
        <p className="text-sm text-warm-400 mb-6 ml-8 leading-relaxed">
          iyla speaks to you in warm, human language by default. Switch to clinical mode
          to see the medical terminology a reproductive endocrinologist would use — useful
          when preparing for an appointment or sharing your screen with a provider.
        </p>
        <div className="flex gap-2 ml-8">
          <button
            onClick={() => { setTermMode('warm'); setTerminologyMode('warm'); }}
            className={`flex-1 max-w-[200px] px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${
              termMode === 'warm'
                ? 'bg-warm-800 text-white shadow-sm'
                : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
            }`}
          >
            Warm voice
          </button>
          <button
            onClick={() => { setTermMode('clinical'); setTerminologyMode('clinical'); }}
            className={`flex-1 max-w-[200px] px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${
              termMode === 'clinical'
                ? 'bg-warm-800 text-white shadow-sm'
                : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
            }`}
          >
            Clinical terminology
          </button>
        </div>
        {termMode === 'clinical' && (
          <div className="mt-4 ml-8 px-4 py-3 bg-teal-50 rounded-2xl text-xs text-teal-700 leading-relaxed">
            Clinical mode is active. Fertility status and phase labels will now use reproductive-endocrinology terminology.
          </div>
        )}
      </div>

      {/* Export */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <Download size={20} className="text-warm-600" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Export All Your Data
          </h2>
        </div>
        <p className="text-sm text-warm-400 mb-6 ml-8 leading-relaxed">
          Download a complete copy of everything iyla stores — cycles, readings,
          labs, supplements, breathwork logs, Reconnect sessions, and vault
          documents (with files). Yours to keep.
          <span className="block mt-2 text-xs text-warm-500 italic">
            Journal entries are private by design and are <strong>not</strong>{' '}
            included here. Use the dedicated journal export below if you want a
            copy.
          </span>
        </p>
        <div className="flex flex-wrap gap-3 ml-8">
          <button
            onClick={handleExportJSON}
            className="px-5 py-2.5 bg-warm-800 text-white text-sm font-medium rounded-2xl hover:bg-warm-900 transition-colors"
          >
            Export as JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="px-5 py-2.5 bg-warm-800 text-white text-sm font-medium rounded-2xl hover:bg-warm-900 transition-colors"
          >
            Export as CSV
          </button>
        </div>
      </div>

      {/* Journal — private, opt-in export */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <BookHeart size={20} className="text-lavender-600" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Journal (private)
          </h2>
        </div>
        <p className="text-sm text-warm-400 mb-6 ml-8 leading-relaxed">
          Your journal is held separately from every other export and sync.
          It's never sent to a partner, never included in provider reports, and
          never bundled into the standard export. If you want a personal copy,
          you can opt in here — the file lives only on your device.
        </p>
        <div className="flex flex-wrap gap-3 ml-8">
          <button
            onClick={handleExportJournal}
            className="px-5 py-2.5 bg-lavender-500 text-white text-sm font-medium rounded-2xl hover:bg-lavender-600 transition-colors"
          >
            Export my journal
          </button>
        </div>
      </div>

      {/* Delete */}
      <div className="bg-rose-50/50 rounded-3xl border border-rose-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <Trash2 size={20} className="text-rose-500" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Delete Your Data
          </h2>
        </div>
        <p className="text-sm text-warm-400 mb-6 ml-8">
          This permanently removes all your data from this device. This cannot
          be undone.
        </p>

        <div className="space-y-3 ml-8">
          {deleteItems.map(({ target, label, description }) => (
            <div
              key={target}
              className="flex items-center justify-between gap-4 py-3 border-b border-rose-100/60 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-warm-700">{label}</p>
                <p className="text-xs text-warm-400">{description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {deletedTargets.has(target) ? (
                  <span className="text-xs text-warm-400 font-medium">
                    Deleted
                  </span>
                ) : confirmTarget === target ? (
                  <>
                    <button
                      onClick={cancelConfirm}
                      className="px-3 py-1.5 text-xs font-medium text-warm-500 rounded-xl hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(target)}
                      className="px-4 py-1.5 bg-rose-500 text-white text-xs font-medium rounded-2xl hover:bg-rose-600 transition-colors flex items-center gap-1.5"
                    >
                      <AlertTriangle size={12} strokeWidth={2} />
                      Are you sure?
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDelete(target)}
                    className="px-4 py-1.5 bg-rose-500 text-white text-xs font-medium rounded-2xl hover:bg-rose-600 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-rose-100 ml-8">
          {deletedTargets.has('everything') ? (
            <p className="text-sm text-warm-400 font-medium">
              All data has been deleted.
            </p>
          ) : confirmTarget === 'everything' ? (
            <div className="flex items-center gap-3">
              <button
                onClick={cancelConfirm}
                className="px-4 py-2 text-sm font-medium text-warm-500 rounded-xl hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete('everything')}
                className="px-5 py-2.5 bg-rose-500 text-white text-sm font-medium rounded-2xl hover:bg-rose-600 transition-colors flex items-center gap-2"
              >
                <AlertTriangle size={14} strokeWidth={2} />
                Yes, delete everything permanently
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleDelete('everything')}
              className="px-5 py-2.5 bg-rose-500 text-white text-sm font-medium rounded-2xl hover:bg-rose-600 transition-colors"
            >
              Delete Everything
            </button>
          )}
        </div>
      </div>

      {/* What Happens When You Delete */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle
            size={20}
            className="text-warm-400"
            strokeWidth={1.5}
          />
          <h2 className="text-lg font-semibold text-warm-800">
            What Happens When You Delete
          </h2>
        </div>
        <ul className="space-y-2.5 ml-8">
          {[
            'Data is permanently removed from IndexedDB',
            'No cloud backups exist to recover from',
            'Export first if you want to keep a copy',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-warm-300 mt-1.5 shrink-0" />
              <span className="text-sm text-warm-500">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Partner Data Sharing */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Heart size={20} className="text-warm-600" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Partner Data Sharing
          </h2>
        </div>
        <ul className="space-y-2.5 ml-8">
          {[
            'When you pair with a partner, only the data you explicitly choose to share is visible to them',
            'Your partner never sees your raw data — only summary insights you approve',
            'You can revoke sharing at any time',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-warm-300 mt-1.5 shrink-0" />
              <span className="text-sm text-warm-500 leading-relaxed">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Open Source */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-3">
          <Code size={20} className="text-warm-600" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-800">
            Open Source Commitment
          </h2>
        </div>
        <p className="text-sm text-warm-500 leading-relaxed ml-8 mb-4">
          iyla's codebase is open for inspection. You don't have to trust our
          words — you can verify our code.
        </p>
        <p className="text-xs text-warm-300 ml-8">
          Built by Solairen Health · Kalina Lux & Dominick Ferrandino ·
          Aguadilla, Puerto Rico · 2026
        </p>
      </div>
    </div>
  );
}
