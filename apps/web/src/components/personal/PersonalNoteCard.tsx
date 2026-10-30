'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PersonalNote, NOTE_COLORS, ChecklistItem } from '@project-hub/shared';
import {
  Pin,
  Palette,
  FileText,
  CheckSquare,
  ArrowRight,
  Archive,
  Trash2,
  RotateCcw,
  Plus,
  X,
  Clock,
  Check,
  CloudOff,
} from 'lucide-react';

interface PersonalNoteCardProps {
  note: PersonalNote;
  isTrashView?: boolean;
  isArchivedView?: boolean;
  saveStatus: 'saved' | 'saving' | 'offline';
  onUpdate: (id: string, updates: Partial<PersonalNote>) => void;
  onDeletePermanent?: (id: string) => void;
  onConvertToTask?: (note: PersonalNote) => void;
}

export function PersonalNoteCard({
  note,
  isTrashView = false,
  isArchivedView: _isArchivedView = false,
  saveStatus,
  onUpdate,
  onDeletePermanent,
  onConvertToTask,
}: PersonalNoteCardProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [contentType, setContentType] = useState<'text' | 'checklist'>(note.contentType);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklistItems || []);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal state if note prop updates externally (only when not actively typing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setTitle(note.title);
      setContent(note.content);
    }
    setContentType(note.contentType);
    setChecklist(note.checklistItems || []);
  }, [note.title, note.content, note.contentType, note.checklistItems]);

  const triggerDebouncedUpdate = (updates: Partial<PersonalNote>) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(note.id, updates);
    }, 800);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      onUpdate(note.id, { title, content });
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerDebouncedUpdate({ title: val });
  };

  const handleContentChange = (val: string) => {
    if (val.length > 5000) return;
    setContent(val);
    triggerDebouncedUpdate({ content: val });
  };

  const handleTogglePin = () => {
    const nextPin = !note.isPinned;
    onUpdate(note.id, { isPinned: nextPin });
  };

  const handleColorChange = (hex: string) => {
    setIsColorPickerOpen(false);
    onUpdate(note.id, { color: hex });
  };

  const handleToggleContentType = () => {
    const nextType: 'text' | 'checklist' = contentType === 'text' ? 'checklist' : 'text';
    setContentType(nextType);
    let nextChecklist = checklist;
    if (nextType === 'checklist' && checklist.length === 0 && content.trim()) {
      // Split lines into initial checklist items
      nextChecklist = content
        .split('\n')
        .map((line) => line.replace(/^[-*•\d.]\s*/, '').trim())
        .filter(Boolean)
        .map((text) => ({ id: crypto.randomUUID(), text, completed: false }));
      setChecklist(nextChecklist);
    }
    onUpdate(note.id, { contentType: nextType, checklistItems: nextChecklist });
  };

  const handleToggleCheckItem = (itemId: string) => {
    const nextList = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(nextList);
    onUpdate(note.id, { checklistItems: nextList });
  };

  const handleUpdateCheckItemText = (itemId: string, text: string) => {
    const nextList = checklist.map((item) =>
      item.id === itemId ? { ...item, text } : item
    );
    setChecklist(nextList);
    triggerDebouncedUpdate({ checklistItems: nextList });
  };

  const handleRemoveCheckItem = (itemId: string) => {
    const nextList = checklist.filter((item) => item.id !== itemId);
    setChecklist(nextList);
    onUpdate(note.id, { checklistItems: nextList });
  };

  const handleAddCheckItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChecklistText.trim() || checklist.length >= 50) return;
    const nextList = [
      ...checklist,
      { id: crypto.randomUUID(), text: newChecklistText.trim(), completed: false },
    ];
    setChecklist(nextList);
    setNewChecklistText('');
    onUpdate(note.id, { checklistItems: nextList });
  };

  const colorConfig = NOTE_COLORS.find((c) => c.hex.toLowerCase() === note.color.toLowerCase()) || NOTE_COLORS[0];

  return (
    <div
      style={{ backgroundColor: colorConfig.hex }}
      className={`group relative flex flex-col rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 border border-black/5 ${
        note.isPinned ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5">
        <input
          type="text"
          value={title}
          disabled={isTrashView}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Note"
          className="w-full bg-transparent text-xs font-bold text-gray-900 placeholder-gray-500/60 focus:outline-none focus:ring-0 tracking-tight"
        />

        <div className="flex items-center gap-1 shrink-0">
          {!isTrashView && (
            <>
              {/* Pin Toggle */}
              <button
                type="button"
                onClick={handleTogglePin}
                title={note.isPinned ? 'Unpin note' : 'Pin to top'}
                className={`p-1 rounded-md transition-colors ${
                  note.isPinned
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-black/5 opacity-70 group-hover:opacity-100'
                }`}
              >
                <Pin className={`h-3.5 w-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
              </button>

              {/* Mode Toggle (Text / Checklist) */}
              <button
                type="button"
                onClick={handleToggleContentType}
                title={contentType === 'text' ? 'Switch to interactive checklist' : 'Switch to plain text note'}
                className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-colors"
              >
                {contentType === 'text' ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Palette Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  title="Change note color"
                  className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-colors"
                >
                  <Palette className="h-3.5 w-3.5" />
                </button>

                {isColorPickerOpen && (
                  <div className="absolute right-0 top-6 z-30 flex gap-1.5 p-1.5 bg-white rounded-xl shadow-lg border border-border">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleColorChange(c.hex)}
                        style={{ backgroundColor: c.hex }}
                        className={`h-5 w-5 rounded-full border border-black/10 hover:scale-110 transition-transform ${
                          note.color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-primary ring-offset-1' : ''
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Convert to Task */}
              {onConvertToTask && (
                <button
                  type="button"
                  onClick={() => onConvertToTask(note)}
                  title="Convert to project task"
                  className="p-1 rounded-md text-gray-500 hover:text-primary hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Archive / Unarchive */}
              <button
                type="button"
                onClick={() => onUpdate(note.id, { isArchived: !note.isArchived })}
                title={note.isArchived ? 'Unarchive note' : 'Archive note'}
                className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>

              {/* Soft Delete */}
              <button
                type="button"
                onClick={() => onUpdate(note.id, { isDeleted: true })}
                title="Move note to trash"
                className="p-1 rounded-md text-gray-500 hover:text-red-600 hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Trash View Controls: Restore and Permanent Delete */}
          {isTrashView && (
            <>
              <button
                type="button"
                onClick={() => onUpdate(note.id, { isDeleted: false })}
                title="Restore note from trash"
                className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100/50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {onDeletePermanent && (
                <button
                  type="button"
                  onClick={() => onDeletePermanent(note.id)}
                  title="Delete permanently"
                  className="p-1 rounded-md text-red-700 hover:bg-red-100/50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Note Body */}
      <div className="py-2.5 flex-1 flex flex-col min-h-[140px]">
        {contentType === 'text' ? (
          <textarea
            value={content}
            disabled={isTrashView}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={handleBlur}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Write your note here..."
            className="w-full flex-1 bg-transparent text-xs text-gray-800 placeholder-gray-500/50 resize-none focus:outline-none focus:ring-0 leading-relaxed font-normal"
          />
        ) : (
          <div className="flex-1 flex flex-col space-y-1.5">
            <div className="space-y-1 overflow-y-auto max-h-48 pr-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    disabled={isTrashView}
                    onChange={() => handleToggleCheckItem(item.id)}
                    className="h-3.5 w-3.5 rounded border-gray-400 text-primary focus:ring-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={item.text}
                    disabled={isTrashView}
                    onChange={(e) => handleUpdateCheckItemText(item.id, e.target.value)}
                    className={`flex-1 bg-transparent text-xs focus:outline-none ${
                      item.completed ? 'line-through text-gray-500' : 'text-gray-800'
                    }`}
                  />
                  {!isTrashView && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCheckItem(item.id)}
                      className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-600 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isTrashView && (
              <form onSubmit={handleAddCheckItem} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Add item..."
                  className="flex-1 bg-white/60 text-xs px-2 py-1 rounded-md border border-black/5 placeholder-gray-400 focus:outline-none focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  className="p-1 rounded-md bg-black/5 hover:bg-black/10 text-gray-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer / Status bar */}
      <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[10px] text-gray-600 font-medium">
        <div className="flex items-center gap-1.5">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-gray-600">
              <Clock className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-700">
              <Check className="h-3 w-3" />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'offline' && (
            <span className="flex items-center gap-1 text-amber-700">
              <CloudOff className="h-3 w-3" />
              <span>Offline (Saved locally)</span>
            </span>
          )}
        </div>

        <span className="text-gray-500/80">
          {contentType === 'checklist'
            ? `${checklist.filter((i) => i.completed).length}/${checklist.length} done`
            : `${content.length} chars`}
        </span>
      </div>
    </div>
  );
}
