'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Plus, Check, AlertCircle, RotateCcw, Edit2, Trash2, Users, X } from 'lucide-react';

interface RoleItem {
  id: string;
  name: string;
  is_system: boolean;
  is_locked: boolean;
  description: string | null;
  userCount: number;
}

interface PermissionItem {
  id: string;
  key: string;
  scope: string;
  group_name: string;
  label: string;
  description: string;
  is_assignable: boolean;
}

interface RolePermMapping {
  role_id: string;
  permission_id: string;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create role state
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [createPermIds, setCreatePermIds] = useState<string[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Edit role state
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editPermIds, setEditPermIds] = useState<string[]>([]);
  const [editDesc, setEditDesc] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset to default modal state
  const [resettingRole, setResettingRole] = useState<RoleItem | null>(null);
  const [submittingReset, setSubmittingReset] = useState(false);

  const fetchRolesAndPermissions = async () => {
    try {
      const res = await fetch('/api/v1/admin/roles');
      if (!res.ok) throw new Error('Failed to load roles and permissions catalog');
      const data = await res.json();
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setRolePermissions(data.rolePermissions || []);
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

  const openEditRole = (role: RoleItem) => {
    setEditingRole(role);
    setEditDesc(role.description || '');
    const currentPerms = rolePermissions
      .filter((rp) => rp.role_id === role.id)
      .map((rp) => rp.permission_id);
    setEditPermIds(currentPerms);
    setError(null);
    setSuccess(null);
  };

  const handleToggleEditPerm = (permId: string) => {
    setEditPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleToggleCreatePerm = (permId: string) => {
    setCreatePermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSaveRolePermissions = async () => {
    if (!editingRole) return;
    setSavingEdit(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: editingRole.id,
          permissionIds: editPermIds,
          description: editDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update role permissions');

      setSuccess(
        `Permissions for "${editingRole.name}" updated successfully (${data.permissionsAdded.length} added, ${data.permissionsRemoved.length} removed). Invalidated sessions for ${data.affectedUserCount} users.`
      );
      setEditingRole(null);
      setShowConfirmModal(false);
      await fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmResetDefault = async () => {
    if (!resettingRole) return;
    setSubmittingReset(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: resettingRole.id,
          isResetToDefault: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset role permissions to default');

      setSuccess(
        `Role "${resettingRole.name}" restored to system factory defaults. ${data.affectedUserCount} active user sessions refreshed.`
      );
      setResettingRole(null);
      await fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setSubmittingCreate(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/v1/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || undefined,
          permissionIds: createPermIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create role');

      setSuccess(`Custom role "${newRoleName.trim()}" created successfully!`);
      setNewRoleName('');
      setNewRoleDesc('');
      setCreatePermIds([]);
      setIsCreatingRole(false);
      await fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (!confirm(`Are you sure you want to delete custom role "${role.name}"?`)) return;

    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/roles?roleId=${role.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete role');

      setSuccess(`Custom role "${role.name}" was deleted successfully.`);
      await fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Group permissions by category
  const groupedPerms = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    const grp = p.group_name || 'General';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(p);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Roles & Permissions</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure permissions for default roles (Manager, Member) and custom roles. The Admin role stays locked.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingRole(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Custom Role
        </button>
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

      {/* Roles Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Configured Roles ({roles.length})
        </h2>

        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading roles catalog...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => {
              const rolePermCount = rolePermissions.filter((rp) => rp.role_id === r.id).length;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-white p-5 shadow-subtle flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                          <Users className="h-3 w-3" />
                          <span>{r.userCount} active users</span>
                        </div>
                      </div>

                      {r.is_locked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                          <Lock className="h-2.5 w-2.5" /> Immutable
                        </span>
                      ) : r.is_system ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          System Role
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          Custom Role
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2">
                      {r.description || 'No description provided'}
                    </p>

                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 font-medium">
                        <Shield className="h-3 w-3 text-primary" />
                        <span>{r.name === 'Admin' ? 'All Permissions' : `${rolePermCount} permissions`}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    {r.is_locked ? (
                      <span className="text-[11px] text-gray-400 italic">Locked to Superadmin</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditRole(r)}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit Permissions</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {r.is_system && (
                            <button
                              type="button"
                              onClick={() => setResettingRole(r)}
                              title="Reset role permissions to default"
                              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Reset</span>
                            </button>
                          )}

                          {!r.is_system && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r)}
                              title="Delete custom role"
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Role Permissions Drawer / Modal */}
      {editingRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Edit Permissions: {editingRole.name}
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    Select permissions to grant. Administrative locked permissions are restricted to Admin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Summary of this role's purpose..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Permissions ({editPermIds.length} active)
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    Affects {editingRole.userCount} users with this role
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(groupedPerms).map(([groupName, perms]) => (
                    <div key={groupName} className="p-3.5 rounded-xl bg-gray-50/70 border border-border space-y-2">
                      <h4 className="text-xs font-bold text-gray-800 capitalize border-b border-gray-200 pb-1.5">
                        {groupName}
                      </h4>
                      <div className="space-y-1.5">
                        {perms.map((p) => {
                          const isLocked = !p.is_assignable || p.key === 'org.roles.manage';
                          const isChecked = editPermIds.includes(p.id);

                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2 text-xs p-1 rounded-md transition-colors ${
                                isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={isLocked}
                                checked={isChecked}
                                onChange={() => handleToggleEditPerm(p.id)}
                                className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                              />
                              <div>
                                <span className="font-mono text-[11px] font-semibold text-gray-800">
                                  {p.key}
                                </span>
                                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                  {p.label}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-gray-50/70 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                Saving will invalidate active sessions for {editingRole.userCount} users.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal prior to saving */}
      {showConfirmModal && editingRole && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">Confirm Permission Updates</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This update will immediately modify permissions for the <strong>{editingRole.name}</strong> role and will affect{' '}
              <strong className="text-gray-900">{editingRole.userCount} active users</strong>.
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
              <div className="font-semibold">Security Action:</div>
              <div>
                All active user sessions belonging to these {editingRole.userCount} members will be invalidated immediately, requiring them to re-authenticate with their new access levels.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={savingEdit}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={savingEdit}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
              >
                {savingEdit ? 'Updating Sessions...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset to Default Confirmation Modal */}
      {resettingRole && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-primary">
              <RotateCcw className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">Reset to Factory Default?</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to restore the system permissions for <strong>{resettingRole.name}</strong> to their factory defaults?
            </p>

            <div className="p-3 rounded-xl bg-gray-50 border border-border text-[11px] text-gray-600 space-y-1">
              <div>
                This action will affect <strong className="text-gray-900">{resettingRole.userCount} users</strong>. All their active sessions will be invalidated and refreshed immediately.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResettingRole(null)}
                disabled={submittingReset}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefault}
                disabled={submittingReset}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
              >
                {submittingReset ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Role Modal */}
      {isCreatingRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Create New Custom Role</h2>
                  <p className="text-[11px] text-gray-500">
                    Define custom roles with tailored project and organization permissions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingRole(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateRole} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Role Name <span className="text-red-500">*</span>
                    </label>
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

                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Permission Checklist ({createPermIds.length} selected)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(groupedPerms).map(([groupName, perms]) => (
                      <div key={groupName} className="p-3.5 rounded-xl bg-gray-50/70 border border-border space-y-2">
                        <h4 className="text-xs font-bold text-gray-800 capitalize border-b border-gray-200 pb-1.5">
                          {groupName}
                        </h4>
                        <div className="space-y-1.5">
                          {perms.map((p) => {
                            const isLocked = !p.is_assignable || p.key === 'org.roles.manage';
                            const isChecked = createPermIds.includes(p.id);

                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2 text-xs p-1 rounded-md transition-colors ${
                                  isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isLocked}
                                  checked={isChecked}
                                  onChange={() => handleToggleCreatePerm(p.id)}
                                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                />
                                <div>
                                  <span className="font-mono text-[11px] font-semibold text-gray-800">
                                    {p.key}
                                  </span>
                                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                    {p.label}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-gray-50/70 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(false)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate || !newRoleName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
                >
                  {submittingCreate ? 'Creating Role...' : 'Create Custom Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
