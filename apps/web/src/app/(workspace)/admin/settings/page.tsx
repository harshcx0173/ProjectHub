'use client';

import React, { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const [companyName, setCompanyName] = useState('Hydrated Studio');
  const [appName, setAppName] = useState('Project Hub');
  const [timezone, setTimezone] = useState('UTC');
  const [maxNotesPerUser, setMaxNotesPerUser] = useState(100);
  const [maxCharLength, setMaxCharLength] = useState(5000);
  const [maxChecklistItems, setMaxChecklistItems] = useState(50);
  const [trashRetentionDays, setTrashRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setCompanyName(data.settings.company_name || 'Hydrated Studio');
          setAppName(data.settings.app_name || 'Project Hub');
          setTimezone(data.settings.timezone || 'UTC');
          if (data.settings.personal_notes_limits) {
            setMaxNotesPerUser(data.settings.personal_notes_limits.maxNotesPerUser || 100);
            setMaxCharLength(data.settings.personal_notes_limits.maxCharLength || 5000);
            setMaxChecklistItems(data.settings.personal_notes_limits.maxChecklistItems || 50);
            setTrashRetentionDays(data.settings.personal_notes_limits.trashRetentionDays || 30);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          appName,
          timezone,
          personalNotesLimits: {
            maxNotesPerUser,
            maxCharLength,
            maxChecklistItems,
            trashRetentionDays,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save settings');
      }

      setSuccess('Organization settings updated successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-xs text-gray-400">
        Loading organization settings...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Organization Settings</h1>
        <p className="text-xs text-gray-500 mt-1">
          Configure branding, application identity, and operational preferences.
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

      {/* Settings Form Card */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">App Display Name</label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 block mb-1">Default Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 tracking-tight uppercase mb-1">Personal Space Limits</h2>
            <p className="text-[11px] text-gray-500 mb-4">Configure usage limits and retention policies for user sticky notes.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Max Notes per User</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={maxNotesPerUser}
                  onChange={(e) => setMaxNotesPerUser(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Max Character Length per Note</label>
                <input
                  type="number"
                  min="500"
                  max="20000"
                  value={maxCharLength}
                  onChange={(e) => setMaxCharLength(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Max Checklist Items per Note</label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={maxChecklistItems}
                  onChange={(e) => setMaxChecklistItems(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Trash Retention Days</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={trashRetentionDays}
                  onChange={(e) => setTrashRetentionDays(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
