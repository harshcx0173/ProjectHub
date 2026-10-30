'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Users, Loader2 } from 'lucide-react';
import { TaskStatus } from './KanbanColumn';

interface MemberOption {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  designation: string | null;
  isAssignable: boolean;
}

interface CreateTaskModalProps {
  projectId: string;
  defaultStatusId?: string;
  statuses: TaskStatus[];
  currentUserId?: string;
  userPermissions?: {
    canAssign?: boolean;
    canSelfAssign?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export function CreateTaskModal({
  projectId,
  defaultStatusId,
  statuses,
  currentUserId,
  userPermissions = { canAssign: true, canSelfAssign: true },
  isOpen,
  onClose,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(defaultStatusId || statuses[0]?.id || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      fetch(`/api/v1/projects/${projectId}/members`)
        .then((res) => res.json())
        .then((data) => {
          setMembers((data.members || []).filter((m: any) => m.isAssignable));
        })
        .catch(() => {});
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const toggleAssignee = (uId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(uId) ? prev.filter((id) => id !== uId) : [...prev, uId]
    );
  };

  const handleSelfAssignToggle = (checked: boolean) => {
    if (!currentUserId) return;
    if (checked) {
      setSelectedAssigneeIds([currentUserId]);
    } else {
      setSelectedAssigneeIds([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          statusId: statusId || statuses[0]?.id,
          priority,
          dueDate: dueDate || undefined,
          assigneeIds: selectedAssigneeIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Failed to create task');
        setLoading(false);
        return;
      }

      // Reset and close
      setTitle('');
      setDescription('');
      setDueDate('');
      setSelectedAssigneeIds([]);
      setLoading(false);
      onTaskCreated();
      onClose();
    } catch {
      setError('Network error while creating task');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/70">
          <h2 className="text-sm font-bold text-gray-900">Create New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Column / Status</label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary capitalize"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Granular Task Assignee Selection */}
          {userPermissions.canAssign ? (
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Assignees ({selectedAssigneeIds.length} selected)
                </span>
                <span className="text-[10px] text-gray-400 font-normal">
                  Only members holding task.assignable
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl border border-border bg-gray-50/60">
                {members.map((m) => {
                  const isChecked = selectedAssigneeIds.includes(m.userId);
                  return (
                    <label
                      key={m.userId}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary font-medium'
                          : 'bg-white border-border text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssignee(m.userId)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span className="truncate">{m.fullName}</span>
                    </label>
                  );
                })}

                {members.length === 0 && (
                  <div className="col-span-2 py-4 text-center text-xs text-gray-400">
                    No assignable members found for this project.
                  </div>
                )}
              </div>
            </div>
          ) : userPermissions.canSelfAssign && currentUserId ? (
            <div className="p-3 rounded-xl border border-border bg-gray-50/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAssigneeIds.includes(currentUserId)}
                  onChange={(e) => handleSelfAssignToggle(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Assign this task to myself</span>
              </label>
              <p className="text-[11px] text-gray-500 mt-1 pl-5.5">
                Your role permits self-assignment.
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Add extra context, acceptance criteria, or links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{loading ? 'Creating...' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
