'use client';

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Trash2,
  AlertCircle,
  RotateCcw,
  Mail,
  Send,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [orgRole, setOrgRole] = useState('Member');
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SMTP Test Modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

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
    setEmailStatus(null);
    setCopied(false);

    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgRole }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate invitation');
      }

      setGeneratedLink(data.inviteLink);
      setEmailStatus(data.emailDelivery || null);
      setEmail('');
      await fetchInvitationsAndRoles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async (id: string) => {
    setError(null);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to resend invitation');

      setGeneratedLink(data.inviteLink);
      setEmailStatus(data.emailDelivery || null);
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

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingSmtp(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testRecipient: testEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({ success: false, message: data.message || 'SMTP test failed.' });
      } else {
        setTestResult({ success: true, message: data.message || 'Test email dispatched successfully.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error executing SMTP test.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Invitations Manager</h1>
          <p className="text-xs text-gray-500 mt-1">
            Send email invitations via SMTP or copy single-use links for team members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTestResult(null);
            setShowTestModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Mail className="h-3.5 w-3.5 text-primary" />
          <span>Test SMTP Delivery</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Link Alert with Email Delivery Status */}
      {generatedLink && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">
              Invitation Generated Successfully!
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>

          {emailStatus && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                emailStatus.sent
                  ? 'border-emerald-300 bg-emerald-100/50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {emailStatus.sent ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Invitation email successfully dispatched via SMTP.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    SMTP email delivery was not completed ({emailStatus.error || 'Check SMTP configuration'}). Please share the link manually below.
                  </span>
                </>
              )}
            </div>
          )}

          <p className="text-[11px] text-emerald-700">
            One-time invitation token (valid for 7 days):
          </p>
          <div className="p-2 rounded-lg bg-white border border-emerald-200 font-mono text-[11px] text-gray-700 break-all select-all">
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
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />

          <select
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value)}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
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
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50 cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Invite Member</span>
              </>
            )}
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
              <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-900">{inv.email}</td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                    {inv.org_role}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400 text-[11px]">
                  {format(new Date(inv.expires_at), 'MMM d, yyyy')}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => handleResend(inv.id)}
                    title="Resend invitation email"
                    className="p-1 text-gray-400 hover:text-primary rounded hover:bg-gray-100 transition-colors inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Resend</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    title="Revoke invitation"
                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Revoke</span>
                  </button>
                </td>
              </tr>
            ))}

            {invitations.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-gray-400">
                  No pending invitations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SMTP Test Modal */}
      {showTestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-900">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">Test SMTP Delivery</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Dispatch a test email to verify your SMTP server host, port, authentication credentials, and network connectivity.
            </p>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <form onSubmit={handleTestSmtp} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="test-email" className="block text-xs font-semibold text-gray-700">
                  Recipient Test Email
                </label>
                <input
                  id="test-email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border focus:outline-none focus:border-primary shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  disabled={testingSmtp}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testingSmtp || !testEmail}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-subtle transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingSmtp ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
