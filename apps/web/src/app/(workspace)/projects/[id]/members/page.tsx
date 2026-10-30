'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Users,
  Shield,
  AlertCircle,
  Trash2,
  ArrowRight,
  UserPlus,
  Loader2,
  X,
  Check,
} from 'lucide-react';

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

interface CandidateUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  designation: string | null;
  orgRole: string;
}

interface AvailableRole {
  id: string;
  name: string;
  isSystem: boolean;
  description: string | null;
}

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<CandidateUser[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProjectRole, setSelectedProjectRole] = useState<string>('Member');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Quick Role Change state
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);

  // Removal & task reassignment modal state
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);
  const [reassignOption, setReassignOption] = useState<'reassign' | 'unassign'>('reassign');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to load project members');
      }
      const data = await res.json();
      setMembers(data.members || []);
      setCanManageMembers(Boolean(data.canManageMembers));
      setAvailableUsers(data.availableUsers || []);
      setAvailableRoles(data.availableRoles || []);

      if (data.availableUsers && data.availableUsers.length > 0 && !selectedUserId) {
        setSelectedUserId(data.availableUsers[0].id);
      }
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

  const handleOpenAddModal = () => {
    setAddError(null);
    const firstUser = availableUsers[0];
    if (firstUser) {
      setSelectedUserId(firstUser.id);
    } else {
      setSelectedUserId('');
    }
    setSelectedProjectRole('Member');
    setIsAddModalOpen(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setAddError('Please select a team member to add.');
      return;
    }

    setSubmittingAdd(true);
    setAddError(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          projectRole: selectedProjectRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add project member.');
      }

      setIsAddModalOpen(false);
      await fetchMembers();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setUpdatingRoleMemberId(targetUserId);
    setError(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          projectRole: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update member role.');
      }

      await fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingRoleMemberId(null);
    }
  };

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

        {canManageMembers && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-subtle transition-colors cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
                  {canManageMembers ? (
                    <div className="relative">
                      <select
                        value={m.projectRole}
                        onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                        disabled={updatingRoleMemberId === m.userId}
                        title="Change project role"
                        aria-label={`Change role for ${m.fullName}`}
                        className="text-[11px] font-semibold pl-2.5 pr-6 py-1 rounded-full bg-gray-100 hover:bg-gray-200/80 border border-transparent focus:border-primary text-gray-700 outline-none cursor-pointer appearance-none transition-colors"
                      >
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {updatingRoleMemberId === m.userId && (
                        <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1.5 text-gray-500" />
                      )}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                      <Shield className="h-3 w-3 text-primary" />
                      {m.projectRole}
                    </span>
                  )}

                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => handleOpenRemoveModal(m)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove member from project"
                      aria-label={`Remove ${m.fullName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
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

      {/* Add Project Member Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-5 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add Project Member</h3>
                  <p className="text-[11px] text-gray-500">Grant an organization member access to this project.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            {availableUsers.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 text-center space-y-2">
                <p className="font-semibold text-gray-800">All members already added</p>
                <p className="text-[11px] text-gray-500">
                  Every active member in your organization already has access to this project.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="select-user" className="block text-xs font-semibold text-gray-700">
                    Organization Member
                  </label>
                  <select
                    id="select-user"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-white px-3 py-2 text-gray-900 outline-none focus:border-primary shadow-2xs"
                  >
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} {u.designation ? `(${u.designation})` : `(${u.orgRole})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="select-role" className="block text-xs font-semibold text-gray-700">
                    Project Role Picker
                  </label>
                  <select
                    id="select-role"
                    value={selectedProjectRole}
                    onChange={(e) => setSelectedProjectRole(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-white px-3 py-2 text-gray-900 outline-none focus:border-primary shadow-2xs"
                  >
                    {availableRoles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} {r.isSystem ? '' : '(Custom)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Role defines their permissions within this project.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={submittingAdd}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd || !selectedUserId}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-subtle transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submittingAdd ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Add to Project</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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

            {removingMember.openTaskCount > 0 && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Action required: {removingMember.openTaskCount} open task(s)</span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-normal">
                  This user currently has assigned tasks. Choose how to handle their active tasks before removing:
                </p>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reassign"
                      checked={reassignOption === 'reassign'}
                      onChange={() => setReassignOption('reassign')}
                      className="mt-0.5 text-primary"
                    />
                    <span className="text-xs font-medium">Reassign all tasks to an eligible member:</span>
                  </label>

                  {reassignOption === 'reassign' && (
                    <div className="ml-5">
                      {otherEligibleMembers.length > 0 ? (
                        <select
                          value={selectedAssigneeId}
                          onChange={(e) => setSelectedAssigneeId(e.target.value)}
                          className="w-full text-xs rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-gray-900 shadow-2xs outline-none focus:border-primary"
                        >
                          {otherEligibleMembers.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.fullName} ({m.projectRole})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-red-600 font-medium">
                          No other eligible members with task assignability found. Please choose unassign.
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reassign"
                      checked={reassignOption === 'unassign'}
                      onChange={() => setReassignOption('unassign')}
                      className="mt-0.5 text-primary"
                    />
                    <span className="text-xs font-medium">Unassign tasks (leaves tasks unassigned on the board)</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRemovingMember(null)}
                disabled={submittingRemove}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={
                  submittingRemove ||
                  (removingMember.openTaskCount > 0 &&
                    reassignOption === 'reassign' &&
                    !selectedAssigneeId)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 shadow-subtle transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingRemove ? (
                  <span>Removing...</span>
                ) : (
                  <>
                    <span>Confirm Removal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
