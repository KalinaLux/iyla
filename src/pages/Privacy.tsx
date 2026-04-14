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
} from 'lucide-react';
import { db } from '../lib/db';
import { breathworkDb } from '../lib/breathwork-rewards';

type DeleteTarget =
  | 'cycles'
  | 'labs'
  | 'supplements'
  | 'breathwork'
  | 'documents'
  | 'everything';

export default function Privacy() {
  const [confirmTarget, setConfirmTarget] = useState<DeleteTarget | null>(null);
  const [deletedTargets, setDeletedTargets] = useState<Set<DeleteTarget>>(new Set());

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

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        cycles,
        readings,
        labs,
        supplements,
        protocols,
        supplementLogs,
        breathworkLogs,
        breathworkRewards,
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
      case 'documents': {
        const vaultDb = new Dexie('iylaVaultDB');
        await vaultDb.delete();
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
        ]);
        try {
          const vaultDb = new Dexie('iylaVaultDB');
          await vaultDb.delete();
        } catch {
          /* vault may not exist */
        }
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
          labs, supplements, breathwork logs. Yours to keep.
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
