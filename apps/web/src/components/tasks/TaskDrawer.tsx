'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckSquare,
  MessageSquare,
  History,
  Trash2,
  AlertCircle,
  Plus,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { TaskStatus } from './KanbanColumn';

interface TaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  statuses: TaskStatus[];
}

export function TaskDrawer({
  taskId,
  onClose,
  onTaskUpdated,
  statuses,
}: TaskDrawerProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [newComment, setNewComment] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Load task details when taskId changes
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setConflictError(null);

    fetch(`/api/v1/tasks/${taskId}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.task) {
            setTask(data.task);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  if (!taskId) return null;

  const handleUpdate = async (patch: Record<string, any>) => {
    if (!task) return;
    setSaving(true);
    setConflictError(null);

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          version: task.version,
        }),
      });

      if (res.status === 409) {
        setConflictError('Task was modified by another user. Please close and re-open to refresh.');
        setSaving(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update task');
        setSaving(false);
        return;
      }

      const data = await res.json();
      setTask((prev: any) => ({
        ...prev,
        ...data.task,
        version: data.task.version,
      }));
      setSaving(false);
      onTaskUpdated();
    } catch {
      alert('Network error while saving changes');
      setSaving(false);
    }
  };

  const handleToggleChecklist = async (itemId: string, isCompleted: boolean) => {
    try {
      await fetch(`/api/v1/tasks/${task.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isCompleted }),
      });

      setTask((prev: any) => ({
        ...prev,
        checklistItems: prev.checklistItems.map((item: any) =>
          item.id === itemId ? { ...item, is_completed: isCompleted } : item
        ),
      }));
      onTaskUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim()) return;

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistTitle.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setTask((prev: any) => ({
          ...prev,
          checklistItems: [...(prev.checklistItems || []), data.item],
        }));
        setNewChecklistTitle('');
        onTaskUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      await fetch(`/api/v1/tasks/${task.id}/checklist?itemId=${itemId}`, {
        method: 'DELETE',
      });

      setTask((prev: any) => ({
        ...prev,
        checklistItems: prev.checklistItems.filter((i: any) => i.id !== itemId),
      }));
      onTaskUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setTask((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), data.comment],
        }));
        setNewComment('');
        onTaskUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task? It will be moved to the trash.')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onClose();
        onTaskUpdated();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete task');
      }
    } catch {
      alert('Network error while deleting task');
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Task Details Drawer"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-tight">
            {task?.taskKey || 'TASK'}
          </span>
          {saving && <span className="text-[11px] text-gray-400">Saving...</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteTask}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete task"
            aria-label="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close task drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-8 text-xs text-gray-400">
          Loading task details...
        </div>
      ) : !task ? (
        <div className="flex-1 flex items-center justify-center p-8 text-xs text-gray-400">
          Task not found.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {conflictError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{conflictError}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              type="text"
              defaultValue={task.title}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== task.title) {
                  handleUpdate({ title: e.target.value.trim() });
                }
              }}
              className="w-full text-base font-semibold text-gray-900 border border-transparent hover:border-gray-300 focus:border-primary focus:outline-none rounded-lg p-1.5 transition-colors"
            />
          </div>

          {/* Properties Grid: Status, Priority, Due Date */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-border">
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">Status</label>
              <select
                value={task.statusId}
                onChange={(e) => handleUpdate({ statusId: e.target.value })}
                className="w-full text-xs font-medium py-1.5 px-2 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">Priority</label>
              <select
                value={task.priority}
                onChange={(e) => handleUpdate({ priority: e.target.value })}
                className="w-full text-xs font-medium py-1.5 px-2 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary capitalize"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-gray-500 block mb-1">Due Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => handleUpdate({ dueDate: e.target.value || null })}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Description
            </label>
            <textarea
              defaultValue={task.description || ''}
              onBlur={(e) => {
                if (e.target.value !== (task.description || '')) {
                  handleUpdate({ description: e.target.value });
                }
              }}
              rows={4}
              placeholder="Add detailed task notes or requirements..."
              className="w-full text-xs text-gray-800 p-2.5 rounded-lg border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-y"
            />
          </div>

          {/* Checklist (Subtasks) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <CheckSquare className="h-3.5 w-3.5 text-gray-500" />
                <span>Checklist</span>
                <span className="text-gray-400 font-normal">
                  ({(task.checklistItems || []).filter((i: any) => i.is_completed).length}/
                  {(task.checklistItems || []).length})
                </span>
              </div>
            </div>

            {/* Checklist items list */}
            <div className="space-y-1.5">
              {(task.checklistItems || []).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-50 group transition-colors"
                >
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(e) => handleToggleChecklist(item.id, e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className={item.is_completed ? 'line-through text-gray-400' : ''}>
                      {item.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity p-0.5"
                    title="Remove item"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add checklist item */}
            <form onSubmit={handleAddChecklistItem} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add subtask checklist item..."
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </form>
          </div>

          {/* Tabs: Comments & Activity */}
          <div className="pt-2 border-t border-border">
            <div className="flex border-b border-border mb-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === 'comments'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments ({(task.comments || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === 'activity'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Activity
              </button>
            </div>

            {activeTab === 'comments' ? (
              <div className="space-y-3">
                {/* Comments list */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {(task.comments || []).map((c: any) => (
                    <div key={c.id} className="p-2.5 rounded-lg bg-gray-50 border border-border space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-gray-800">
                          {c.author?.full_name || 'Team Member'}
                        </span>
                        <span className="text-gray-400">
                          {format(new Date(c.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}

                  {(task.comments || []).length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-4">No comments yet.</p>
                  )}
                </div>

                {/* Comment composer */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium flex items-center gap-1 shadow-subtle transition-colors"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </form>
              </div>
            ) : (
              /* Activity list */
              <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                {(task.activity || []).map((act: any) => (
                  <div key={act.id} className="flex items-start gap-2 py-1 text-gray-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[11px]">
                        <strong className="text-gray-900 font-medium">
                          {act.profiles?.full_name || 'System'}
                        </strong>{' '}
                        {act.action.replace('task.', '')}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {format(new Date(act.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
