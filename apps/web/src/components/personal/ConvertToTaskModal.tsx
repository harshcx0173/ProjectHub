'use client';

import React, { useState, useEffect } from 'react';
import { PersonalNote } from '@project-hub/shared';
import { X, CheckSquare, Loader2, AlertCircle } from 'lucide-react';

interface ConvertToTaskModalProps {
  note: PersonalNote | null;
  isOpen: boolean;
  onClose: () => void;
  onConverted: (taskId: string, projectId: string) => void;
}

interface ProjectOption {
  id: string;
  name: string;
  key: string;
}

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface MemberOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export function ConvertToTaskModal({
  note,
  isOpen,
  onClose,
  onConverted,
}: ConvertToTaskModalProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoadingProjects(true);
    fetch('/api/v1/projects')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.projects) ? data.projects : [];
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingProjects(false));
  }, [isOpen]);

  useEffect(() => {
    if (!selectedProjectId) {
      setStatuses([]);
      setMembers([]);
      return;
    }

    setLoadingStatuses(true);
    Promise.all([
      fetch(`/api/v1/projects/${selectedProjectId}/tasks`).then((r) => r.json()),
      fetch(`/api/v1/projects/${selectedProjectId}/members`).then((r) => r.json()).catch(() => ({ members: [] })),
    ])
      .then(([tasksData, membersData]) => {
        const statusList = Array.isArray(tasksData.statuses) ? tasksData.statuses : [];
        setStatuses(statusList);
        if (statusList.length > 0) {
          setSelectedStatusId(statusList[0].id);
        }

        const memberList = Array.isArray(membersData.members)
          ? membersData.members.map((m: any) => ({
              id: m.userId || m.id,
              fullName: m.fullName || 'Member',
              avatarUrl: m.avatarUrl || null,
            }))
          : [];
        setMembers(memberList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStatuses(false));
  }, [selectedProjectId]);

  if (!isOpen || !note) return null;

  const handleToggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a destination project.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/personal/notes/${note.id}/convert-to-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          columnId: selectedStatusId || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assigneeIds: selectedAssignees,
          title: note.title,
          content: note.content,
          contentType: note.contentType,
          checklistItems: note.checklistItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to convert note to task');
      }

      onConverted(data.taskId, selectedProjectId);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Convert Note to Task</h2>
              <p className="text-[11px] text-gray-500">Transform this sticky note into a formal workspace task</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Note Preview */}
        <div className="px-6 py-3 bg-gray-50 border-b border-border text-xs">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Note Preview</p>
          <p className="font-semibold text-gray-800 truncate">{note.title || '(Untitled Note)'}</p>
          <p className="text-gray-500 text-[11px] line-clamp-2 mt-0.5">
            {note.contentType === 'checklist'
              ? `${note.checklistItems.length} checklist items`
              : note.content || 'No content'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Destination Project *</label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading projects...</span>
                </div>
              ) : (
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status / Column */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status Column</label>
              {loadingStatuses ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading columns...</span>
                </div>
              ) : (
                <select
                  value={selectedStatusId}
                  onChange={(e) => setSelectedStatusId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Assignees */}
          {members.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Assignees</label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-lg border border-border bg-gray-50/50">
                {members.map((m) => {
                  const isSelected = selectedAssignees.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleAssignee(m.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-white border border-border text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{m.fullName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg border border-border text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProjectId}
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Create Task & Archive Note</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

