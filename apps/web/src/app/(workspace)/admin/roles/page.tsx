'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Plus, Check, AlertCircle } from 'lucide-react';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRolesAndPermissions = async () => {
    try {
      const res = await fetch('/api/v1/admin/roles');
      if (!res.ok) throw new Error('Failed to load roles and permissions');
      const data = await res.json();
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  const handleTogglePerm = (permId: string) => {
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/v1/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || undefined,
          permissionIds: selectedPermIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create role');
      }

      setSuccess(`Custom role "${newRoleName.trim()}" created successfully!`);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedPermIds([]);
      await fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Group permissions by group_name
  const groupedPerms = permissions.reduce<Record<string, any[]>>((acc, p) => {
    const grp = p.group_name || 'General';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(p);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Roles & Permissions</h1>
        <p className="text-xs text-gray-500 mt-1">
          System roles are immutable. Create custom roles from the permission checklist to grant granular access.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-700 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* System Roles Grid */}
      <div>
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
          Existing Roles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading && (
            <div className="col-span-full py-8 text-center text-xs text-gray-400">
              Loading roles catalog...
            </div>
          )}
          {roles.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-white p-4 shadow-subtle space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>
                  {r.is_locked ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      <Lock className="h-2.5 w-2.5" /> Locked
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.description || 'Custom defined role'}</p>
              </div>

              <span className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                {r.is_system ? 'System default role' : 'Created by Admin'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Role Builder */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Custom Role Builder</h2>
            <p className="text-[11px] text-gray-500">
              Select allowed permissions. Non-assignable administrative keys cannot be added to custom roles.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateRole} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Role Name</label>
              <input
                type="text"
                required
                placeholder="e.g. QA Engineer"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Brief role summary..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Permission Checklist Matrix */}
          <div className="pt-3 border-t border-gray-100 space-y-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Permission Checklist ({selectedPermIds.length} selected)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(groupedPerms).map(([groupName, perms]) => (
                <div key={groupName} className="p-3.5 rounded-xl bg-gray-50/70 border border-border space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 capitalize border-b border-gray-200/60 pb-1.5">
                    {groupName}
                  </h4>
                  <div className="space-y-1.5">
                    {perms.map((p) => {
                      const isLocked = !p.is_assignable;
                      const isChecked = selectedPermIds.includes(p.id);

                      return (
                        <label
                          key={p.id}
                          className={`flex items-start gap-2 text-xs p-1 rounded-md transition-colors ${
                            isLocked
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-white cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={isChecked}
                            onChange={() => handleTogglePerm(p.id)}
                            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <div>
                            <span className="font-mono text-[11px] font-semibold text-gray-800">
                              {p.key}
                            </span>
                            {isLocked && (
                              <span className="ml-1.5 text-[9px] uppercase font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                System Only
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={creating || !newRoleName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating Role...' : 'Create Custom Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
