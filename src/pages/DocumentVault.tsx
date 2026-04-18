import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { vaultDb, type VaultDocument } from '../lib/vault-db';
import {
  Upload,
  FileText,
  Image,
  File,
  Search,
  Filter,
  Trash2,
  Eye,
  Download,
  FolderOpen,
  Shield,
  X,
  ChevronDown,
  Clock,
  HardDrive,
} from 'lucide-react';
import Modal from '../components/Modal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.heic,.doc,.docx';
const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOC_TYPES = [
  'lab results',
  'ultrasound',
  "doctor's note",
  'insurance',
  'prescription',
  'treatment plan',
  'consent form',
  'other',
] as const;

type DocType = (typeof DOC_TYPES)[number];

const DOC_TYPE_COLORS: Record<DocType, { bg: string; text: string }> = {
  'lab results':    { bg: 'bg-teal-100',    text: 'text-teal-600' },
  ultrasound:       { bg: 'bg-violet-100',  text: 'text-violet-600' },
  "doctor's note":  { bg: 'bg-amber-100',   text: 'text-amber-600' },
  insurance:        { bg: 'bg-blue-100',     text: 'text-blue-600' },
  prescription:     { bg: 'bg-rose-100',     text: 'text-rose-500' },
  'treatment plan': { bg: 'bg-green-100',    text: 'text-green-600' },
  'consent form':   { bg: 'bg-lavender-100', text: 'text-lavender-600' },
  other:            { bg: 'bg-warm-100',     text: 'text-warm-600' },
};

function typeColor(t: string) {
  return DOC_TYPE_COLORS[t as DocType] ?? DOC_TYPE_COLORS.other;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return FileText;
  if (mime.startsWith('image/')) return Image;
  return File;
}

function friendlySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentVault() {
  const allDocs = useLiveQuery(() => vaultDb.documents.toArray()) ?? [];

  // Upload state
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [docDate, setDocDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [provider, setProvider] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Library state
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Preview / delete state
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultDocument | null>(null);

  // ------- Upload handlers -------

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED_MIME.includes(file.type) && !file.name.match(/\.(heic|doc|docx)$/i)) return;
    setStagedFile(file);
    setDocType(DOC_TYPES[0]);
    setDocDate(format(new Date(), 'yyyy-MM-dd'));
    setProvider('');
    setTags('');
    setNotes('');
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files),
    [handleFiles],
  );

  async function handleSave() {
    if (!stagedFile) return;
    await vaultDb.documents.add({
      filename: stagedFile.name,
      type: docType,
      mimeType: stagedFile.type,
      size: stagedFile.size,
      date: docDate,
      provider: provider || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes || undefined,
      blob: stagedFile,
      createdAt: new Date().toISOString(),
    });
    setStagedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ------- Preview -------

  function openPreview(doc: VaultDocument) {
    if (doc.mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(doc.blob);
      setPreviewUrl(url);
      setPreviewDoc(doc);
    } else {
      const url = URL.createObjectURL(doc.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewDoc(null);
  }

  // ------- Delete -------

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    await vaultDb.documents.delete(deleteTarget.id);
    setDeleteTarget(null);
  }

  // ------- Filtered docs -------

  const filtered = allDocs
    .filter((d) => {
      if (filterType && d.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [d.filename, d.provider ?? '', ...d.tags].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      sortOrder === 'newest'
        ? b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
        : a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );

  const totalSize = allDocs.reduce((sum, d) => sum + d.size, 0);

  // ------- Render -------

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Document Vault</h1>
          <p className="text-sm text-warm-400 mt-0.5">
            Securely store fertility documents on your device
          </p>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 px-6 py-4 flex flex-wrap items-center gap-6 text-sm">
        <span className="flex items-center gap-2 text-warm-600">
          <FolderOpen size={16} strokeWidth={1.5} className="text-warm-400" />
          <span className="font-medium">{allDocs.length}</span> document{allDocs.length !== 1 && 's'}
        </span>
        <span className="flex items-center gap-2 text-warm-600">
          <HardDrive size={16} strokeWidth={1.5} className="text-warm-400" />
          <span className="font-medium">{friendlySize(totalSize)}</span> used
        </span>
        <span className="flex items-center gap-2 text-warm-400 ml-auto">
          <Shield size={14} strokeWidth={1.5} />
          All documents stay on your device
        </span>
      </div>

      {/* Upload Area */}
      {!stagedFile ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            dragOver
              ? 'border-warm-400 bg-warm-100'
              : 'border-warm-200 bg-warm-50 hover:border-warm-400'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-warm-100 flex items-center justify-center">
            <Upload size={22} strokeWidth={1.5} className="text-warm-500" />
          </div>
          <p className="text-sm font-medium text-warm-600">
            Drag & drop a file or <span className="text-warm-800 underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-warm-400">PDF, JPG, PNG, HEIC, DOC, DOCX</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={onFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warm-50 flex items-center justify-center">
                {(() => {
                  const Icon = fileIcon(stagedFile.type);
                  return <Icon size={18} strokeWidth={1.5} className="text-warm-500" />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium text-warm-700 truncate max-w-xs">
                  {stagedFile.name}
                </p>
                <p className="text-xs text-warm-400">{friendlySize(stagedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setStagedFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="p-2 text-warm-300 hover:text-warm-500 hover:bg-warm-50 rounded-xl transition-all"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Document type */}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-warm-500">Document Type</span>
              <div className="relative">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full appearance-none bg-warm-50 border border-warm-100 rounded-xl px-3.5 py-2.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-200 pr-9"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
                />
              </div>
            </label>

            {/* Date */}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-warm-500">Date</span>
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="w-full bg-warm-50 border border-warm-100 rounded-xl px-3.5 py-2.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-200"
              />
            </label>

            {/* Provider */}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-warm-500">Provider (optional)</span>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Dr. Smith"
                className="w-full bg-warm-50 border border-warm-100 rounded-xl px-3.5 py-2.5 text-sm text-warm-700 placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-warm-200"
              />
            </label>

            {/* Tags */}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-warm-500">Tags (comma-separated)</span>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="IVF, cycle 2, AMH"
                className="w-full bg-warm-50 border border-warm-100 rounded-xl px-3.5 py-2.5 text-sm text-warm-700 placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-warm-200"
              />
            </label>
          </div>

          {/* Notes */}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-warm-500">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context…"
              className="w-full bg-warm-50 border border-warm-100 rounded-xl px-3.5 py-2.5 text-sm text-warm-700 placeholder:text-warm-300 resize-none focus:outline-none focus:ring-2 focus:ring-warm-200"
            />
          </label>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-warm-800 text-white px-6 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
          >
            <Upload size={15} />
            Save to Vault
          </button>
        </div>
      )}

      {/* Search & Filter */}
      {allDocs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              strokeWidth={1.5}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-400"
            />
            <input
              type="text"
              placeholder="Search by name, provider, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-warm-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-warm-700 placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-warm-200"
            />
          </div>

          <div className="relative">
            <Filter
              size={14}
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="appearance-none bg-white border border-warm-100 rounded-xl pl-9 pr-8 py-2.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-200"
            >
              <option value="">All types</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
            />
          </div>

          <div className="relative">
            <Clock
              size={14}
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="appearance-none bg-white border border-warm-100 rounded-xl pl-9 pr-8 py-2.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Document Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const Icon = fileIcon(doc.mimeType);
            const colors = typeColor(doc.type);
            return (
              <div
                key={doc.id}
                className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 p-5 flex flex-col gap-3 group"
              >
                {/* Icon + type pill */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-warm-50 flex items-center justify-center shrink-0">
                    <Icon size={18} strokeWidth={1.5} className="text-warm-500" />
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {doc.type}
                  </span>
                </div>

                {/* Filename + meta */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warm-700 truncate">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-warm-400">
                    <span>{format(new Date(doc.date), 'MMM d, yyyy')}</span>
                    {doc.provider && (
                      <>
                        <span className="text-warm-200">·</span>
                        <span className="truncate">{doc.provider}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium bg-warm-50 text-warm-500 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button
                    onClick={() => openPreview(doc)}
                    className="flex items-center gap-1.5 text-xs text-warm-500 hover:text-warm-700 bg-warm-50 hover:bg-warm-100 px-3 py-1.5 rounded-xl transition-all"
                  >
                    {doc.mimeType.startsWith('image/') ? (
                      <Eye size={13} strokeWidth={1.5} />
                    ) : (
                      <Download size={13} strokeWidth={1.5} />
                    )}
                    {doc.mimeType.startsWith('image/') ? 'Preview' : 'Download'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    className="flex items-center gap-1.5 text-xs text-warm-400 hover:text-rose-500 bg-warm-50 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-all ml-auto"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : allDocs.length > 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 p-10 text-center">
          <Search size={24} strokeWidth={1.5} className="mx-auto text-warm-300 mb-3" />
          <p className="text-sm text-warm-500">No documents match your search</p>
          <p className="text-xs text-warm-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        !stagedFile && (
          <div className="bg-white rounded-3xl border border-warm-100 shadow-sm shadow-warm-100/50 p-10 text-center">
            <FolderOpen size={28} strokeWidth={1.5} className="mx-auto text-warm-300 mb-3" />
            <p className="text-sm text-warm-500 font-medium">Your vault is empty</p>
            <p className="text-xs text-warm-400 mt-1">
              Upload lab results, ultrasound images, or doctor's notes to get started
            </p>
          </div>
        )
      )}

      {/* Image Preview Modal */}
      <Modal open={!!previewDoc} onClose={closePreview} title={previewDoc?.filename ?? 'Preview'} maxWidth="max-w-2xl">
        {previewUrl && (
          <img
            src={previewUrl}
            alt={previewDoc?.filename}
            className="w-full rounded-2xl object-contain max-h-[70vh]"
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Document"
      >
        <div className="space-y-5">
          <p className="text-sm text-warm-600">
            Are you sure you want to permanently delete{' '}
            <span className="font-medium text-warm-800">{deleteTarget?.filename}</span>? This
            action cannot be undone.
          </p>
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm text-warm-500 hover:text-warm-700 bg-warm-50 hover:bg-warm-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
