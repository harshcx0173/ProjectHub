'use client';

import React, { useState, useEffect, use } from 'react';
import { Users, Shield, AlertCircle, Trash2, ArrowRight } from 'lucide-react';

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  projectRole: string;
  fullName: string;
  avatarUrl: string | null;
  designation: string | null;
  orgRole: string;
  isAssignable: boolean;
  openTaskCount: number;
  createdAt: string;
}

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Removal & task reassignment modal state
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);
  const [reassignOption, setReassignOption] = useState<'reassign' | 'unassign'>('reassign');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`);
      if (!res.ok) throw new Error('Failed to load project members');
      const data = await res.json();
      setMembers(data.members || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleOpenRemoveModal = (member: ProjectMember) => {
    setRemovingMember(member);
    const otherAssignable = members.filter(
      (m) => m.userId !== member.userId && m.isAssignable
    );
    if (otherAssignable.length > 0 && otherAssignable[0]) {
      setSelectedAssigneeId(otherAssignable[0].userId);
    }
    setReassignOption('reassign');
  };

  const handleConfirmRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removingMember) return;

    setSubmittingRemove(true);
    setError(null);

    try {
      let query = `userId=${removingMember.userId}`;
      if (removingMember.openTaskCount > 0) {
        if (reassignOption === 'reassign' && selectedAssigneeId) {
          query += `&reassignToUserId=${selectedAssigneeId}`;
        } else if (reassignOption === 'unassign') {
          query += `&unassignTasks=true`;
        }
      }

      const res = await fetch(`/api/v1/projects/${projectId}/members?${query}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove member');

      setRemovingMember(null);
      await fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingRemove(false);
    }
  };

  const otherEligibleMembers = members.filter(
    (m) => removingMember && m.userId !== removingMember.userId && m.isAssignable
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Project Members</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Team members with access to this project&apos;s tasks, files, and discussion channel.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Members List */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-white shadow-subtle">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading members...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center uppercase shadow-2xs overflow-hidden">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.fullName} className="h-full w-full object-cover" />
                    ) : (
                      m.fullName.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-gray-900">{m.fullName}</h3>
                      {m.isAssignable && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Assignable
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {m.designation || 'Team Member'} &bull; {m.openTaskCount} open tasks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                    <Shield className="h-3 w-3 text-primary" />
                    {m.projectRole}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenRemoveModal(m)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove member from project"
                    aria-label={`Remove ${m.fullName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="p-12 text-center text-xs text-gray-400">
                No individual members assigned. Project is visible to organization administrators.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remove Member / Reassign Tasks Modal */}
      {removingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">
                Remove Member from Project
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to remove <strong>{removingMember.fullName}</strong> from this project?
            </p>

            {removingMember.openTaskCount > 0 ? (
              <form onSubmit={handleConfirmRemove} className="space-y-4 pt-1">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <div className="font-semibold">Open Tasks Assigned</div>
                  <div>
                    This member is currently assigned to <strong>{removingMember.openTaskCount} open tasks</strong> in this project. Please select what to do with their assignments:
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-border cursor-pointer hover:bg-gray-50 text-xs">
                    <input
                      type="radio"
                      name="reassignOption"
                      value="reassign"
                      checked={reassignOption === 'reassign'}
                      onChange={() => setReassignOption('reassign')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 block">Reassign open tasks to another member</span>
                      <span className="text-[11px] text-gray-500">
                        Transfer all open task assignments in this project to a designated team member.
                      </span>

                      {reassignOption === 'reassign' && (
                        <div className="mt-2">
                          {otherEligibleMembers.length > 0 ? (
                            <select
                              value={selectedAssigneeId}
                              onChange={(e) => setSelectedAssigneeId(e.target.value)}
                              className="w-full text-xs py-1.5 px-2 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {otherEligibleMembers.map((em) => (
                                <option key={em.userId} value={em.userId}>
                                  {em.fullName} ({em.designation || 'Member'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-[11px] text-red-600 italic">
                              No other assignable members found in this project.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-border cursor-pointer hover:bg-gray-50 text-xs">
                    <input
                      type="radio"
                      name="reassignOption"
                      value="unassign"
                      checked={reassignOption === 'unassign'}
                      onChange={() => setReassignOption('unassign')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">Unassign open tasks</span>
                      <span className="text-[11px] text-gray-500">
                        Leave tasks unassigned on the board for other members to pick up.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRemovingMember(null)}
                    disabled={submittingRemove}
                    className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRemove || (reassignOption === 'reassign' && !selectedAssigneeId)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {submittingRemove ? 'Processing...' : 'Confirm Removal'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRemovingMember(null)}
                  disabled={submittingRemove}
                  className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemove}
                  disabled={submittingRemove}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
                >
                  {submittingRemove ? 'Removing...' : 'Remove Member'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
