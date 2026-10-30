'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DynamicIcon, AVAILABLE_PROJECT_ICONS, AVAILABLE_PROJECT_COLORS } from '@/components/icons/dynamic-icon';
import { Lock, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [iconValue, setIconValue] = useState('Folder');
  const [color, setColor] = useState('#2563EB');
  const [isArchived, setIsArchived] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function fetchProject() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/projects/${projectId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Failed to load project details.');
          return;
        }

        const data = await res.json();
        const project = data.project;

        if (!project) {
          setErrorMessage('Project not found.');
          return;
        }

        setIsAdmin(Boolean(data.isAdmin));
        setName(project.name);
        setKey(project.key);
        setDescription(project.description || '');
        setIconValue(project.icon_value);
        setColor(project.color);
        setIsArchived(project.is_archived);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error fetching project settings.');
      } finally {
        setIsLoading(false);
      }
    }

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
      };

      // Only send admin fields if admin
      if (isAdmin) {
        payload.iconValue = iconValue;
        payload.color = color;
        payload.isArchived = isArchived;
      }

      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update project settings.');
        setIsSaving(false);
        return;
      }

      setSuccessMessage('Project settings saved successfully.');
      setIsSaving(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Unexpected error updating settings.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-gray-50/50 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Project Settings</h2>
        <p className="text-xs text-gray-500 mt-1">Configure project general info, icon, and colors</p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Info Card */}
        <Card className="border border-border bg-white shadow-card">
          <CardHeader>
            <CardTitle className="text-base">General Information</CardTitle>
            <CardDescription>Basic identifiers for this project workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  id="name"
                  label="Project Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Project Key (Locked)
                </label>
                <div className="flex h-10 w-full items-center rounded-lg border border-border bg-gray-100 px-3 text-sm font-mono text-gray-500 uppercase select-none">
                  {key}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Description
              </label>
              <textarea
                rows={3}
                className="flex w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-subtle placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Project Branding & Appearance (Admin-Only in Plan) */}
        <Card className="border border-border bg-white shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Project Icon & Appearance</CardTitle>
                <CardDescription>
                  Icon and color shown in sidebar and headers
                </CardDescription>
              </div>
              {!isAdmin && (
                <Badge variant="warning">
                  Admin Only
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isAdmin && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Project icons and accent colors can only be modified by Organization Administrators.
                </span>
              </div>
            )}

            {/* Icon Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Select Icon
              </label>
              <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg bg-gray-50">
                {AVAILABLE_PROJECT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setIconValue(icon)}
                    className={`p-2 rounded-lg border transition-all ${
                      iconValue === icon
                        ? 'border-primary bg-primary/10 text-primary shadow-subtle scale-105'
                        : 'border-transparent bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    title={icon}
                  >
                    <DynamicIcon name={icon} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Swatch Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Accent Color
              </label>
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-gray-50">
                {AVAILABLE_PROJECT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setColor(hex)}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                      color === hex
                        ? 'scale-110 ring-2 ring-primary ring-offset-2'
                        : 'hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {color === hex && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" isLoading={isSaving}>
            <Save className="h-4 w-4 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
