'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Search, UserMinus } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Offboarding modal state
  const [offboardingUser, setOffboardingUser] = useState<any | null>(null);
  const [reassignOption, setReassignOption] = useState<'reassign' | 'unassign'>('reassign');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [submittingOffboarding, setSubmittingOffboarding] = useState(false);

  const fetchUsers = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/v1/admin/users'),
        fetch('/api/v1/admin/roles'),
      ]);

      if (!usersRes.ok) throw new Error('Failed to load user directory');
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, orgRole: newRole }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update role');
        return;
      }

      await fetchUsers();
    } catch {
      alert('Network error while updating role');
    }
  };

  const handleClickStatusToggle = (userItem: any) => {
    if (userItem.status === 'active') {
      // Open offboarding modal
      setOffboardingUser(userItem);
      const otherUsers = users.filter((u) => u.id !== userItem.id && u.status === 'active');
      if (otherUsers.length > 0) {
        setSelectedAssigneeId(otherUsers[0].id);
      }
      setReassignOption('reassign');
    } else {
      // Directly reactivate
      handleConfirmStatusChange(userItem.id, 'active');
    }
  };

  const handleConfirmStatusChange = async (
    userId: string,
    nextStatus: string,
    reassignData?: { reassignToUserId?: string; unassignTasks?: boolean }
  ) => {
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          status: nextStatus,
          ...reassignData,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to change user status');
        return;
      }

      setOffboardingUser(null);
      await fetchUsers();
    } catch {
      alert('Network error while updating status');
    }
  };

  const handleOffboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offboardingUser) return;

    setSubmittingOffboarding(true);
    try {
      await handleConfirmStatusChange(offboardingUser.id, 'disabled', {
        reassignToUserId: reassignOption === 'reassign' ? selectedAssigneeId : undefined,
        unassignTasks: reassignOption === 'unassign',
      });
    } finally {
      setSubmittingOffboarding(false);
    }
  };

  const activeOtherUsers = users.filter(
    (u) => offboardingUser && u.id !== offboardingUser.id && u.status === 'active'
  );

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.designation?.toLowerCase().includes(q) ||
      u.org_role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">User Directory</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage organization members, assign roles, and handle user offboarding with task reassignment.
          </p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, role or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-white shadow-subtle overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-50/50 border-b border-border text-gray-600 font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Member</th>
              <th className="py-2.5 px-4">Designation</th>
              <th className="py-2.5 px-4">Organization Role</th>
              <th className="py-2.5 px-4">2FA Status</th>
              <th className="py-2.5 px-4">Account Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 uppercase text-[10px]">
                      {u.full_name ? u.full_name.charAt(0) : 'U'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{u.full_name}</h3>
                      <span className="text-[10px] text-gray-400">
                        Joined {format(new Date(u.created_at), 'MMM yyyy')}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4 text-gray-600">
                  {u.designation || <span className="text-gray-300">-</span>}
                </td>

                <td className="py-3 px-4">
                  <select
                    value={u.org_role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-xs font-medium py-1 px-2 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Member">Member</option>
                      </>
                    )}
                  </select>
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.is_totp_enabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.is_totp_enabled ? 'TOTP Active' : 'None'}
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>

                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleClickStatusToggle(u)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      u.status === 'active'
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {u.status === 'active' ? 'Disable' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                  {loading ? 'Loading users...' : 'No users found matching your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Offboarding & Reassignment Modal */}
      {offboardingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <UserMinus className="h-5 w-5" />
              <h3 className="text-base font-bold text-gray-900">
                Offboard Member: {offboardingUser.full_name}
              </h3>
            </div>

            <p className="text-xs text-gray-600">
              Disabling this user will immediately revoke all their active sessions and terminate their access to the application.
            </p>

            <form onSubmit={handleOffboardSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 block">
                  Task Reassignment Strategy:
                </label>

                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-gray-50/50 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="reassignOption"
                      checked={reassignOption === 'reassign'}
                      onChange={() => setReassignOption('reassign')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">
                        Reassign open tasks to another member
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Automatically transfer all open project tasks assigned to this user.
                      </span>

                      {reassignOption === 'reassign' && (
                        <div className="mt-2.5">
                          <select
                            value={selectedAssigneeId}
                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                            required
                            className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {activeOtherUsers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name} ({m.org_role})
                              </option>
                            ))}
                            {activeOtherUsers.length === 0 && (
                              <option value="" disabled>
                                No other active members available
                              </option>
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-gray-50/50 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="reassignOption"
                      checked={reassignOption === 'unassign'}
                      onChange={() => setReassignOption('unassign')}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">
                        Unassign all open tasks
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Remove user from task assignments without assigning a replacement.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setOffboardingUser(null)}
                  className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOffboarding || (reassignOption === 'reassign' && !selectedAssigneeId)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {submittingOffboarding ? 'Offboarding...' : 'Confirm Offboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
