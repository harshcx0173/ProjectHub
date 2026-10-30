'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Search,
  Archive,
  RotateCcw,
  Edit2,
  Check,
  AlertCircle,
  Layers,
  Folder,
  Briefcase,
  Code,
  Sparkles,
  Database,
  Terminal,
  Shield,
  LucideIcon,
} from 'lucide-react';

const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  layers: Layers,
  briefcase: Briefcase,
  code: Code,
  sparkles: Sparkles,
  database: Database,
  terminal: Terminal,
  shield: Shield,
};

const COLOR_PALETTE = [
  '#2563EB', // Blue
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#D97706', // Amber
  '#E11D48', // Rose
  '#0891B2', // Cyan
  '#475569', // Slate
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('folder');
  const [editColor, setEditColor] = useState('#2563EB');
  const [saving, setSaving] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenEdit = (proj: any) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDesc(proj.description || '');
    setEditIcon(proj.icon_value || 'folder');
    setEditColor(proj.color || '#2563EB');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          iconType: 'lucide',
          iconValue: editIcon,
          color: editColor,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update project');
      }

      setMessage({ type: 'success', text: `Project "${editName}" updated successfully.` });
      setEditingProject(null);
      await fetchProjects();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (proj: any) => {
    const nextArchived = !proj.is_archived;
    const confirmMsg = nextArchived
      ? `Archive project "${proj.name}"? It will be hidden from the active sidebar.`
      : `Restore project "${proj.name}" to active status?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/v1/projects/${proj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: nextArchived }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update archive status');
      }

      setMessage({
        type: 'success',
        text: `Project "${proj.name}" ${nextArchived ? 'archived' : 'restored'}.`,
      });
      await fetchProjects();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.key && p.key.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return !p.is_archived;
    if (statusFilter === 'archived') return p.is_archived;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Projects Management</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Oversee company projects, modify project icons and theme colors, and manage archival status.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border border-border bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
          </select>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Projects Table */}
      <div className="rounded-2xl border border-border bg-white shadow-subtle overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400">No projects match your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredProjects.map((proj) => {
                  const IconComp = AVAILABLE_ICONS[proj.icon_value] || Folder;
                  return (
                    <tr key={proj.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-subtle"
                            style={{ backgroundColor: proj.color || '#2563EB' }}
                          >
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{proj.name}</div>
                            {proj.description && (
                              <div className="text-[11px] text-gray-400 line-clamp-1 max-w-md">
                                {proj.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-gray-500">
                        {proj.key || 'PRJ'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            proj.is_archived
                              ? 'bg-gray-100 text-gray-600 border border-gray-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {proj.is_archived ? 'Archived' : 'Active'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(proj)}
                            className="p-1.5 rounded-lg border border-border hover:bg-gray-50 text-gray-600 transition-colors"
                            title="Edit project details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleArchive(proj)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              proj.is_archived
                                ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                : 'border-amber-200 text-amber-600 hover:bg-amber-50'
                            }`}
                            title={proj.is_archived ? 'Restore project' : 'Archive project'}
                          >
                            {proj.is_archived ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Edit Project Settings</h3>
            <p className="text-xs text-gray-500">
              Only Administrators have permission to customize project brand colors and icons.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Project Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(AVAILABLE_ICONS).map(([key, Icon]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setEditIcon(key)}
                      className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-colors ${
                        editIcon === key
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] capitalize">{key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Theme Color</label>
                <div className="flex items-center gap-3">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`h-7 w-7 rounded-full transition-transform flex items-center justify-center ${
                        editColor === color ? 'scale-110 ring-2 ring-offset-2 ring-primary' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {editColor === color && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

