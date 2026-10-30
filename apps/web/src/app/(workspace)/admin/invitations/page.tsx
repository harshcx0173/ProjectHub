'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Copy, Check, Trash2, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [orgRole, setOrgRole] = useState('Member');
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitationsAndRoles = async () => {
    try {
      const [invRes, rolesRes] = await Promise.all([
        fetch('/api/v1/invitations'),
        fetch('/api/v1/admin/roles'),
      ]);

      if (!invRes.ok) throw new Error('Failed to load invitations');
      const invData = await invRes.json();
      setInvitations(invData.invitations || []);

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
    fetchInvitationsAndRoles();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setGeneratedLink(null);
    setCopied(false);

    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgRole }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to generate invitation');
      }

      const data = await res.json();
      setGeneratedLink(data.inviteLink);
      setEmail('');
      await fetchInvitationsAndRoles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend invitation');

      setGeneratedLink(data.inviteLink);
      setCopied(false);
      await fetchInvitationsAndRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    try {
      const res = await fetch(`/api/v1/invitations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke invitation');
      await fetchInvitationsAndRoles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Invitations Manager</h1>
        <p className="text-xs text-gray-500 mt-1">
          Generate secure single-use invitation links for new team members. Public signups are strictly disabled.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Link Alert */}
      {generatedLink && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">
              Invitation Link Generated Successfully!
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
          <p className="text-[11px] text-emerald-700">
            Share this one-time link with the invited member. It will expire in 7 days:
          </p>
          <div className="p-2 rounded bg-white border border-emerald-200 font-mono text-[11px] text-gray-700 break-all select-all">
            {generatedLink}
          </div>
        </div>
      )}

      {/* Create Invitation Form */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-subtle space-y-4">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          Invite a New Member
        </h2>

        <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <select
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value)}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {roles.length > 0 ? (
              roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))
            ) : (
              <>
                <option value="Member">Member</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </>
            )}
          </select>

          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Generating...' : 'Create Invite Link'}
          </button>
        </form>
      </div>

      {/* Pending Invitations Table */}
      <div className="rounded-2xl border border-border bg-white shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-border bg-gray-50/70">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Active Pending Invitations ({invitations.length})
          </h2>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-50/50 border-b border-border text-gray-600 font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Email</th>
              <th className="py-2.5 px-4">Role</th>
              <th className="py-2.5 px-4">Expires</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-900">{inv.email}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                    {inv.org_role}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {format(new Date(inv.expires_at), 'MMM d, yyyy')}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleResend(inv.id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Resend invitation (generate new token)"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Revoke invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {invitations.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-gray-400 text-xs">
                  {loading ? 'Loading invitations...' : 'No pending invitations.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
