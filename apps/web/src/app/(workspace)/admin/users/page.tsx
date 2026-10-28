'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users');
      if (!res.ok) throw new Error('Failed to load user directory');
      const data = await res.json();
      setUsers(data.users || []);
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

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const confirmMsg =
      nextStatus === 'disabled'
        ? 'Are you sure you want to disable this user? They will be signed out from all sessions immediately.'
        : 'Reactivate this user account?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, status: nextStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to change user status');
        return;
      }

      await fetchUsers();
    } catch {
      alert('Network error while updating status');
    }
  };

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
            Manage organization members, assign roles, and handle user offboarding.
          </p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
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
          <thead className="bg-gray-50/80 border-b border-border text-gray-600 font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Designation</th>
              <th className="py-3 px-4">Organization Role</th>
              <th className="py-3 px-4">2FA Status</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center uppercase shadow-2xs">
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
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Member">Member</option>
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
                    onClick={() => handleToggleStatus(u.id, u.status)}
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
    </div>
  );
}
