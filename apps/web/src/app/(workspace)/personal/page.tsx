'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PersonalNote, NOTE_COLORS } from '@project-hub/shared';
import { PersonalNoteCard } from '@/components/personal/PersonalNoteCard';
import { ConvertToTaskModal } from '@/components/personal/ConvertToTaskModal';
import {
  StickyNote,
  Plus,
  Search,
  LayoutGrid,
  List,
  Archive,
  Trash2,
  AlertCircle,
  Check,
  Pin,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

type TabType = 'active' | 'archived' | 'trash';
type ViewMode = 'grid' | 'list';

export default function PersonalSpacePage() {
  const [tab, setTab] = useState<TabType>('active');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [taskConvertedAlert, setTaskConvertedAlert] = useState<{ taskId: string; projectId: string } | null>(null);
  const [noteToConvert, setNoteToConvert] = useState<PersonalNote | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  // Storage key helper
  const getStorageKey = () => `project_hub_personal_notes`;

  // Fetch notes from server or local fallback
  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/personal/notes?status=${tab}`);
      if (!res.ok) {
        throw new Error('Failed to fetch personal notes');
      }
      const data = await res.json();
      const serverNotes: PersonalNote[] = Array.isArray(data.notes) ? data.notes : [];

      // Check if local cache has newer unsynced items
      const cached = localStorage.getItem(getStorageKey());
      if (cached) {
        try {
          const localList: PersonalNote[] = JSON.parse(cached);
          // If server returned empty because table is not yet migrated, fall back cleanly to local storage
          if (!data.isTableReady && localList.length > 0) {
            const filteredLocal = localList.filter((n) => {
              if (tab === 'trash') return n.isDeleted;
              if (tab === 'archived') return n.isArchived && !n.isDeleted;
              return !n.isArchived && !n.isDeleted;
            });
            setNotes(filteredLocal);
            setLoading(false);
            return;
          }
        } catch {}
      }

      setNotes(serverNotes);
      // Cache server notes locally
      if (data.isTableReady) {
        localStorage.setItem(getStorageKey(), JSON.stringify(serverNotes));
      }
    } catch (err: any) {
      // Offline fallback
      setSaveStatus('offline');
      const cached = localStorage.getItem(getStorageKey());
      if (cached) {
        try {
          const localList: PersonalNote[] = JSON.parse(cached);
          const filteredLocal = localList.filter((n) => {
            if (tab === 'trash') return n.isDeleted;
            if (tab === 'archived') return n.isArchived && !n.isDeleted;
            return !n.isArchived && !n.isDeleted;
          });
          setNotes(filteredLocal);
        } catch {}
      } else {
        setError(err.message || 'Unable to connect to personal space.');
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Online / Offline synchronization handlers
  useEffect(() => {
    const handleOnline = () => {
      setSaveStatus('saved');
      loadNotes();
    };
    const handleOffline = () => {
      setSaveStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadNotes]);

  // Keyboard shortcut listener: N to create note, Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleCreateNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notes]);

  // Handle Note Creation
  const handleCreateNote = async () => {
    if (isCreatingNote) return;
    setIsCreatingNote(true);
    setSaveStatus('saving');
    const newNoteTemplate: Partial<PersonalNote> = {
      title: '',
      contentType: 'text',
      content: '',
      checklistItems: [],
      color: NOTE_COLORS[0].hex,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      position: 0,
      zIndex: 1,
    };

    try {
      const res = await fetch('/api/v1/personal/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNoteTemplate),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create note');
      }

      const createdNote: PersonalNote = data.note;
      const updatedNotes = [createdNote, ...notes];
      setNotes(updatedNotes);
      localStorage.setItem(getStorageKey(), JSON.stringify(updatedNotes));
      setSaveStatus('saved');

      // Switch to active tab if on archived or trash
      if (tab !== 'active') {
        setTab('active');
      }
    } catch (err: any) {
      // Local optimistic fallback
      const localFallbackNote: PersonalNote = {
        id: crypto.randomUUID(),
        userId: 'current-user',
        title: '',
        contentType: 'text',
        content: '',
        checklistItems: [],
        color: NOTE_COLORS[0].hex,
        posX: 100,
        posY: 100,
        width: 280,
        height: 260,
        isPinned: false,
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
        position: 0,
        zIndex: 1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedNotes = [localFallbackNote, ...notes];
      setNotes(updatedNotes);
      localStorage.setItem(getStorageKey(), JSON.stringify(updatedNotes));
      setSaveStatus('offline');
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Handle Note Update (Debounced from Card)
  const handleUpdateNote = async (id: string, updates: Partial<PersonalNote>) => {
    setSaveStatus('saving');

    // Optimistic state update
    let nextNotes = notes.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));

    // If moving to trash or archive, filter out of current view
    if (tab === 'active' && (updates.isDeleted || updates.isArchived)) {
      nextNotes = nextNotes.filter((n) => n.id !== id);
    } else if (tab === 'archived' && (updates.isArchived === false || updates.isDeleted)) {
      nextNotes = nextNotes.filter((n) => n.id !== id);
    } else if (tab === 'trash' && updates.isDeleted === false) {
      nextNotes = nextNotes.filter((n) => n.id !== id);
    }

    setNotes(nextNotes);
    localStorage.setItem(getStorageKey(), JSON.stringify(nextNotes));

    try {
      const res = await fetch(`/api/v1/personal/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setError('Note was modified in another tab or device. Refreshing...');
          loadNotes();
          return;
        }
        throw new Error(errData.message || 'Failed to update note');
      }

      setSaveStatus('saved');
    } catch {
      setSaveStatus('offline');
    }
  };

  // Permanent Delete (Trash View)
  const handleDeletePermanent = async (id: string) => {
    const nextNotes = notes.filter((n) => n.id !== id);
    setNotes(nextNotes);
    localStorage.setItem(getStorageKey(), JSON.stringify(nextNotes));

    try {
      await fetch(`/api/v1/personal/notes/${id}`, { method: 'DELETE' });
    } catch {}
  };

  // Empty Trash Action
  const handleEmptyTrash = async () => {
    if (!confirm('Are you sure you want to permanently delete all items in Trash?')) return;
    if (isEmptyingTrash) return;
    setIsEmptyingTrash(true);
    const trashIds = notes.map((n) => n.id);
    setNotes([]);
    localStorage.setItem(getStorageKey(), JSON.stringify([]));

    try {
      for (const id of trashIds) {
        await fetch(`/api/v1/personal/notes/${id}`, { method: 'DELETE' }).catch(() => {});
      }
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.checklistItems.some((item) => item.text.toLowerCase().includes(q))
      );
    }

    if (selectedColor) {
      result = result.filter((n) => n.color.toLowerCase() === selectedColor.toLowerCase());
    }

    return result;
  }, [notes, searchQuery, selectedColor]);

  // Separate into pinned and other notes
  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-white border-b border-border shadow-subtle shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Description */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900 tracking-tight">Personal Space</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Private
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Your private scratchpad and interactive checklists. Isolated to you with strict RLS.
              </p>
            </div>
          </div>

          {/* Action Header: Add Note Coral Button & View Mode */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Coral Add Note Button (Master Plan Requirement: #FF6B6B / #F97066 with Plus icon) */}
            <button
              onClick={handleCreateNote}
              disabled={isCreatingNote}
              title="Create new sticky note (Hotkey: N)"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97066] hover:bg-[#F05252] text-white text-xs font-semibold shadow-md transition-all duration-150 transform active:scale-95 disabled:opacity-50"
            >
              {isCreatingNote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>{isCreatingNote ? 'Creating...' : 'New Note'}</span>
              <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded font-mono">
                N
              </kbd>
            </button>
          </div>
        </div>

        {/* Filter and Control Subbar */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs: Active, Archived, Trash */}
          <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTab('active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                tab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span>Notes</span>
            </button>
            <button
              onClick={() => setTab('archived')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                tab === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archived</span>
            </button>
            <button
              onClick={() => setTab('trash')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                tab === 'trash' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Trash (30d)</span>
            </button>
          </div>

          {/* Search Bar & Color Swatch Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes & checklists..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-gray-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Color Dot Filter Swatches */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100/60 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedColor(null)}
                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                  selectedColor === null ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                All
              </button>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(selectedColor === c.hex ? null : c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`h-4 w-4 rounded-full border border-black/10 transition-transform ${
                    selectedColor === c.hex ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'hover:scale-105'
                  }`}
                  title={c.name}
                />
              ))}
            </div>

            {/* Grid vs List View Toggle */}
            <div className="flex items-center bg-gray-100/80 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Task Converted Toast Banner */}
      {taskConvertedAlert && (
        <div className="mx-6 mt-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Note successfully converted to project task and archived.</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${taskConvertedAlert.projectId}/board`}
              className="font-semibold underline hover:text-emerald-900 flex items-center gap-1"
            >
              <span>View Board</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setTaskConvertedAlert(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Canvas Surface */}
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-gray-400">
            <StickyNote className="h-8 w-8 mb-2 animate-pulse text-gray-300" />
            <p className="text-xs font-medium">Loading your personal space...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-white border border-border shadow-subtle flex items-center justify-center text-gray-400 mb-4">
              {tab === 'trash' ? (
                <Trash2 className="h-8 w-8" />
              ) : tab === 'archived' ? (
                <Archive className="h-8 w-8" />
              ) : (
                <StickyNote className="h-8 w-8" />
              )}
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              {tab === 'trash'
                ? 'Trash is empty'
                : tab === 'archived'
                ? 'No archived notes'
                : 'Your Personal Space is empty'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              {tab === 'trash'
                ? 'Notes moved to trash stay here for 30 days before being automatically purged.'
                : tab === 'archived'
                ? 'Archived notes and checklists are stored safely out of your main view.'
                : 'Capture quick thoughts, personal to-dos, and interactive checklists. Visible only to you.'}
            </p>
            {tab === 'active' && (
              <button
                onClick={handleCreateNote}
                disabled={isCreatingNote}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97066] hover:bg-[#F05252] text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
              >
                {isCreatingNote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{isCreatingNote ? 'Creating...' : 'Create Your First Note'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trash Actions Bar */}
            {tab === 'trash' && notes.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <span>Items in trash are automatically deleted after 30 days.</span>
                <button
                  onClick={handleEmptyTrash}
                  disabled={isEmptyingTrash}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isEmptyingTrash && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isEmptyingTrash ? 'Emptying...' : 'Empty Trash'}</span>
                </button>
              </div>
            )}

            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && tab === 'active' && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  <Pin className="h-3.5 w-3.5 fill-current text-primary" />
                  <span>Pinned Notes</span>
                </div>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                      : 'flex flex-col space-y-3'
                  }
                >
                  {pinnedNotes.map((note) => (
                    <PersonalNoteCard
                      key={note.id}
                      note={note}
                      saveStatus={saveStatus}
                      onUpdate={handleUpdateNote}
                      onConvertToTask={(n) => setNoteToConvert(n)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Notes Section */}
            {otherNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && tab === 'active' && (
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    <span>Other Notes</span>
                  </div>
                )}
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                      : 'flex flex-col space-y-3'
                  }
                >
                  {otherNotes.map((note) => (
                    <PersonalNoteCard
                      key={note.id}
                      note={note}
                      isTrashView={tab === 'trash'}
                      isArchivedView={tab === 'archived'}
                      saveStatus={saveStatus}
                      onUpdate={handleUpdateNote}
                      onDeletePermanent={handleDeletePermanent}
                      onConvertToTask={(n) => setNoteToConvert(n)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Convert Note to Task Modal */}
      <ConvertToTaskModal
        note={noteToConvert}
        isOpen={Boolean(noteToConvert)}
        onClose={() => setNoteToConvert(null)}
        onConverted={(taskId, projectId) => {
          setTaskConvertedAlert({ taskId, projectId });
          loadNotes();
        }}
      />
    </div>
  );
}
