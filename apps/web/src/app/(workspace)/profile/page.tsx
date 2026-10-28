'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, LogOut, Check, AlertCircle, Laptop, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [timezone, setTimezone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/v1/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data.profile);
      setSessions(data.sessions || []);
      setFullName(data.profile.fullName || '');
      setDesignation(data.profile.designation || '');
      setTimezone(data.profile.timezone || 'UTC');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          designation,
          timezone,
        }),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      await fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm('Are you sure you want to sign out from all other active sessions?')) {
      return;
    }

    setRevoking(true);
    try {
      const res = await fetch('/api/v1/profile/sessions', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke sessions');
      setMessage({ type: 'success', text: 'All other sessions have been signed out.' });
      await fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-xs text-gray-400">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Account & Profile</h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage your personal details, organization role, and security settings.
        </p>
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

      {/* Profile Details Card */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary text-white text-xl font-bold flex items-center justify-center uppercase shadow-card">
            {profile?.fullName ? profile.fullName.charAt(0) : 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{profile?.fullName}</h2>
            <p className="text-xs text-gray-500">{profile?.email}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              <Shield className="h-3 w-3" />
              {profile?.orgRole}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Designation / Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Product Designer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 block mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Security & 2FA Card */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-gray-900">Security & Authentication</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <h3 className="text-xs font-bold text-gray-900">Two-Factor Authentication (TOTP)</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Protects your account with an authenticator app (Google Authenticator, 1Password).
            </p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              profile?.isTotpEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {profile?.isTotpEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">Active Sessions</h2>
              <p className="text-[11px] text-gray-500">
                Devices currently signed into your account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRevokeOtherSessions}
            disabled={revoking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {revoking ? 'Revoking...' : 'Sign Out Other Sessions'}
          </button>
        </div>

        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {sessions.map((s) => (
            <div key={s.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-50/60">
              <div className="space-y-0.5">
                <p className="font-semibold text-gray-800">{s.user_agent || 'Browser session'}</p>
                <p className="text-[11px] text-gray-400">IP: {s.ip_address || '127.0.0.1'}</p>
              </div>
              <div className="text-right text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Last active: {format(new Date(s.last_active_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-400">
              No extra active sessions recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
