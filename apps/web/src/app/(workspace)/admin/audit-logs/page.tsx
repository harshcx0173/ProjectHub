'use client';

import React, { useState, useEffect } from 'react';
import { Filter, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const url = actionFilter === 'all'
        ? '/api/v1/admin/audit-logs'
        : `/api/v1/admin/audit-logs?action=${actionFilter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Audit Trail</h1>
          <p className="text-xs text-gray-500 mt-1">
            Immutable security and activity log tracking user actions, administrative changes, and deletions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-border bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Actions</option>
            <option value="user.invite">user.invite</option>
            <option value="user.role_change">user.role_change</option>
            <option value="user.disable">user.disable</option>
            <option value="project.create">project.create</option>
            <option value="task.create">task.create</option>
            <option value="task.delete">task.delete</option>
            <option value="settings.update">settings.update</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-border bg-white shadow-subtle overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-50/80 border-b border-border text-gray-600 font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target Entity</th>
              <th className="py-3 px-4">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 px-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                  {format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-gray-900">
                    {l.actor?.full_name || 'System / Admin'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {l.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 font-mono text-[11px]">
                  {l.entityType} ({l.entityId ? l.entityId.slice(0, 8) + '...' : 'org'})
                </td>
                <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                  {l.ipAddress || '127.0.0.1'}
                </td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400 text-xs">
                  {loading ? 'Loading audit records...' : 'No audit records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
