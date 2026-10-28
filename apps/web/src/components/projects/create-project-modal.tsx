'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DynamicIcon, AVAILABLE_PROJECT_ICONS, AVAILABLE_PROJECT_COLORS } from '@/components/icons/dynamic-icon';
import { ProjectGroup } from '@project-hub/shared';
import { X, AlertCircle, Plus, Check } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectGroups: ProjectGroup[];
  onProjectCreated: (project: any) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  projectGroups,
  onProjectCreated,
}: CreateProjectModalProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [color, setColor] = useState<string>(AVAILABLE_PROJECT_COLORS[0]);
  const [iconValue, setIconValue] = useState<string>(AVAILABLE_PROJECT_ICONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Auto-generate key from name if key hasn't been manually customized
  const handleNameChange = (val: string) => {
    setName(val);
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const generated = words
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase();
      if (/^[A-Z0-9]{2,5}$/.test(generated)) {
        setKey(generated);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Project name is required.');
      return;
    }

    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey || cleanKey.length < 2 || cleanKey.length > 5 || !/^[A-Z0-9]+$/.test(cleanKey)) {
      setErrorMessage('Project key must be 2 to 5 uppercase alphanumeric characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          key: cleanKey,
          description: description.trim() || undefined,
          groupId: groupId || undefined,
          color,
          iconType: 'lucide',
          iconValue,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to create project.');
        setIsLoading(false);
        return;
      }

      onProjectCreated(data.project);
      onClose();
      router.push(`/projects/${data.project.id}/board`);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error creating project.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-border bg-white shadow-elevated overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create New Project</h2>
            <p className="text-xs text-gray-500">Add a project workspace with side-by-side board and chat</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Project Name and Key */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                id="projectName"
                label="Project Name"
                placeholder="Marketing Campaign"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                id="projectKey"
                label="Key (2-5 Chars)"
                placeholder="MKT"
                maxLength={5}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              className="flex w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-subtle placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Brief summary of project objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Project Group (Folder) */}
          {projectGroups.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Folder Group
              </label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">No Group (Root)</option>
                {projectGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Icon Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Project Icon
            </label>
            <div className="flex flex-wrap gap-2 p-2 border border-border rounded-lg bg-gray-50">
              {AVAILABLE_PROJECT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setIconValue(icon)}
                  className={`p-2 rounded-lg border transition-all ${
                    iconValue === icon
                      ? 'border-primary bg-primary/10 text-primary shadow-subtle scale-105'
                      : 'border-transparent bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                  title={icon}
                >
                  <DynamicIcon name={icon} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Project Accent Color
            </label>
            <div className="flex items-center gap-2.5 p-2 border border-border rounded-lg bg-gray-50">
              {AVAILABLE_PROJECT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                    color === hex ? 'scale-110 ring-2 ring-primary ring-offset-2' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {color === hex && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
