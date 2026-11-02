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
  Eye,
  Tag,
  Users,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { TaskStatus } from './KanbanColumn';
import { createClient } from '@/lib/supabase/client';
import { renderMessageWithMentions } from '@/lib/mentions';

function formatSafeDate(dateVal: any, pattern: string = 'MMM d, h:mm a'): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return format(d, pattern);
}

interface TaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  statuses: TaskStatus[];
  currentUserId?: string;
  currentUserName?: string;
  userPermissions?: {
    canAssign?: boolean;
    canSelfAssign?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
}

export function TaskDrawer({
  taskId,
  onClose,
  onTaskUpdated,
  statuses,
  currentUserId,
  currentUserName,
  userPermissions = { canAssign: true, canSelfAssign: true, canEdit: true, canDelete: true },
}: TaskDrawerProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [newComment, setNewComment] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [actioningChecklistId, setActioningChecklistId] = useState<string | null>(null);
  const [actioningLabelId, setActioningLabelId] = useState<string | null>(null);
  const [togglingWatch, setTogglingWatch] = useState(false);
  const [attachingLabel, setAttachingLabel] = useState(false);

  // Watchers & Labels state
  const [isWatching, setIsWatching] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [attachedLabels, setAttachedLabels] = useState<any[]>([]);
  const [availableLabels, setAvailableLabels] = useState<any[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  // Assignees state
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Load task details when taskId changes
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`task_read_${taskId}`, new Date().toISOString());
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
            if (data.task.projectId) {
              fetch(`/api/v1/projects/${data.task.projectId}/members`)
                .then((r) => r.json())
                .then((m) => {
                  if (isMounted) {
                    setProjectMembers((m.members || []).filter((mem: any) => mem.isAssignable));
                  }
                })
                .catch(console.error);
            }
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    // Load watchers
    fetch(`/api/v1/tasks/${taskId}/watchers`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setIsWatching(!!data.isWatching);
          setWatcherCount(data.watcherCount || 0);
        }
      })
      .catch(console.error);

    // Load labels
    fetch(`/api/v1/tasks/${taskId}/labels`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setAttachedLabels(data.attachedLabels || []);
          setAvailableLabels(data.availableLabels || []);
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // Realtime subscription for task comments
  useEffect(() => {
    if (!taskId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime_task_comments_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async () => {
          try {
            const res = await fetch(`/api/v1/tasks/${taskId}/comments`);
            if (res.ok) {
              const data = await res.json();
              if (data.comments) {
                setTask((prev: any) => {
                  if (!prev) return prev;
                  const pending = (prev.comments || []).filter(
                    (c: any) => String(c.id).startsWith('temp-') && !data.comments.some((s: any) => s.content === c.content)
                  );
                  return { ...prev, comments: [...data.comments, ...pending] };
                });
              }
            }
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const handleToggleWatch = async () => {
    if (!taskId || togglingWatch) return;
    setTogglingWatch(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/watchers`, { method: 'POST' });
      const data = await res.json();
      setIsWatching(data.isWatching);
      setWatcherCount((prev) => (data.isWatching ? prev + 1 : Math.max(0, prev - 1)));
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingWatch(false);
    }
  };

  const handleAttachLabel = async (labelId?: string, name?: string) => {
    if (!taskId || attachingLabel) return;
    setAttachingLabel(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, name }),
      });

      if (res.ok) {
        const refresh = await fetch(`/api/v1/tasks/${taskId}/labels`);
        const data = await refresh.json();
        setAttachedLabels(data.attachedLabels || []);
        setAvailableLabels(data.availableLabels || []);
        setShowLabelPicker(false);
        setNewLabelName('');
        onTaskUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAttachingLabel(false);
    }
  };

  const handleDetachLabel = async (labelId: string) => {
    if (!taskId || actioningLabelId) return;
    setActioningLabelId(labelId);
    try {
      await fetch(`/api/v1/tasks/${taskId}/labels?labelId=${labelId}`, { method: 'DELETE' });
      setAttachedLabels((prev) => prev.filter((l) => l.id !== labelId));
      onTaskUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setActioningLabelId(null);
    }
  };

  const currentAssigneeIds = (task?.assignees || []).map((a: any) => a.id);

  const handleAddAssignee = async (userId: string) => {
    if (!task) return;
    const newIds = Array.from(new Set([...currentAssigneeIds, userId]));
    await handleUpdate({ assigneeIds: newIds });
    setShowAssigneePicker(false);
  };

  const handleRemoveAssignee = async (userId: string) => {
    if (!task) return;
    const newIds = currentAssigneeIds.filter((id: string) => id !== userId);
    await handleUpdate({ assigneeIds: newIds });
  };

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
    if (!newChecklistTitle.trim() || addingChecklist) return;

    setAddingChecklist(true);
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
    } finally {
      setAddingChecklist(false);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (actioningChecklistId) return;
    setActioningChecklistId(itemId);
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
    } finally {
      setActioningChecklistId(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content || !task?.id) return;

    setNewComment('');
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const optimisticComment = {
      id: tempId,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: currentUserId || 'self',
        full_name: 'You',
        avatar_url: null,
      },
    };

    setTask((prev: any) => ({
      ...prev,
      comments: [...(prev?.comments || []), optimisticComment],
    }));

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setTask((prev: any) => ({
            ...prev,
            comments: (prev?.comments || []).map((c: any) => (c.id === tempId ? data.comment : c)),
          }));
          onTaskUpdated();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task? It will be moved to the trash.')) {
      return;
    }

    setDeletingTask(true);
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
    } finally {
      setDeletingTask(false);
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
            onClick={handleToggleWatch}
            disabled={togglingWatch}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
              isWatching
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border text-gray-600 hover:bg-gray-100'
            }`}
            title={isWatching ? 'Stop watching' : 'Watch this task'}
          >
            {togglingWatch ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            <span>{isWatching ? 'Watching' : 'Watch'}</span>
            <span className="text-[10px] opacity-75">({watcherCount})</span>
          </button>
          <button
            type="button"
            onClick={handleDeleteTask}
            disabled={deletingTask}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete task"
            aria-label="Delete task"
          >
            {deletingTask ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
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

          {/* Labels Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>Labels</span>
              </label>
              <button
                type="button"
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Label
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {attachedLabels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs"
                  style={{ backgroundColor: lbl.color || '#2563EB' }}
                >
                  <span>{lbl.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDetachLabel(lbl.id)}
                    disabled={actioningLabelId === lbl.id}
                    className="hover:opacity-75 disabled:opacity-50"
                  >
                    {actioningLabelId === lbl.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <X className="h-2.5 w-2.5" />
                    )}
                  </button>
                </span>
              ))}

              {attachedLabels.length === 0 && !showLabelPicker && (
                <span className="text-[11px] text-gray-400 italic">No labels attached</span>
              )}
            </div>

            {showLabelPicker && (
              <div className="mt-2 p-2.5 rounded-xl border border-border bg-gray-50/80 space-y-2">
                <div className="text-[11px] font-medium text-gray-600">Available Labels:</div>
                <div className="flex flex-wrap gap-1">
                  {availableLabels
                    .filter((al) => !attachedLabels.some((at) => at.id === al.id))
                    .map((al) => (
                      <button
                        type="button"
                        key={al.id}
                        onClick={() => handleAttachLabel(al.id)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white hover:opacity-85"
                        style={{ backgroundColor: al.color || '#2563EB' }}
                      >
                        + {al.name}
                      </button>
                    ))}
                </div>

                <div className="flex gap-1.5 pt-1 border-t border-gray-200">
                  <input
                    type="text"
                    placeholder="New label name..."
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 rounded border border-border bg-white"
                  />
                  <button
                    type="button"
                    disabled={!newLabelName.trim() || attachingLabel}
                    onClick={() => handleAttachLabel(undefined, newLabelName.trim())}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded text-xs font-semibold disabled:opacity-50"
                  >
                    {attachingLabel && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Create</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Assignees Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>Assignees ({(task.assignees || []).length})</span>
              </label>

              {userPermissions.canAssign ? (
                <button
                  type="button"
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Assign Member
                </button>
              ) : userPermissions.canSelfAssign && currentUserId ? (
                currentAssigneeIds.includes(currentUserId) ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignee(currentUserId)}
                    className="text-[11px] text-red-600 hover:underline font-semibold"
                  >
                    Unassign Me
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddAssignee(currentUserId)}
                    className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Assign to Me
                  </button>
                )
              ) : null}
            </div>

            {/* List of current assignees */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(task.assignees || []).map((a: any) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-800 border border-gray-200"
                >
                  <div className="h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center uppercase overflow-hidden">
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.full_name} className="h-full w-full object-cover" />
                    ) : (
                      a.full_name?.charAt(0) || 'U'
                    )}
                  </div>
                  <span>{a.full_name}</span>
                  {(userPermissions.canAssign || (userPermissions.canSelfAssign && a.id === currentUserId)) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignee(a.id)}
                      className="text-gray-400 hover:text-gray-700"
                      title={`Remove ${a.full_name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}

              {(task.assignees || []).length === 0 && (
                <span className="text-[11px] text-gray-400 italic">No members assigned</span>
              )}
            </div>

            {/* Assignee Picker Dropdown */}
            {showAssigneePicker && userPermissions.canAssign && (
              <div className="mt-2 p-2.5 rounded-xl border border-border bg-gray-50/80 space-y-2">
                <div className="text-[11px] font-medium text-gray-600">
                  Select Assignable Member:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {projectMembers
                    .filter((pm) => !currentAssigneeIds.includes(pm.userId))
                    .map((pm) => (
                      <button
                        type="button"
                        key={pm.userId}
                        onClick={() => handleAddAssignee(pm.userId)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-primary/10 hover:text-primary hover:border-primary border border-border transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{pm.fullName}</span>
                      </button>
                    ))}
                  {projectMembers.filter((pm) => !currentAssigneeIds.includes(pm.userId)).length === 0 && (
                    <span className="text-[11px] text-gray-400 italic">
                      All assignable members are already assigned to this task.
                    </span>
                  )}
                </div>
              </div>
            )}
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
                    disabled={actioningChecklistId === item.id}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity p-0.5 disabled:opacity-50"
                    title="Remove item"
                  >
                    {actioningChecklistId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
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
                disabled={addingChecklist || !newChecklistTitle.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {addingChecklist ? (
                  <Loader2 className="h-3 w-3 animate-spin text-gray-600" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <span>Add</span>
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
                          {formatSafeDate(c.createdAt || c.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 whitespace-pre-wrap">
                        {renderMessageWithMentions(c.content, currentUserName)}
                      </div>
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
                    disabled={!newComment.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium shadow-subtle transition-colors disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    <span>Send</span>
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
                        {formatSafeDate(act.createdAt || act.created_at)}
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
