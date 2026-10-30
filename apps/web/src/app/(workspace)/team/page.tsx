'use client';

import React, { useState, useEffect } from 'react';
import { Users, Shield, Search, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TeamDirectoryPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setUsers(data.users);
        } else {
          setError(data.message || 'Failed to load team directory');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.designation?.toLowerCase().includes(q) ||
      u.org_role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Team Directory</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            People and collaborators across the organization.
          </p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search colleagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Team Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-border bg-white p-5 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center uppercase shadow-2xs shrink-0">
                {u.full_name ? u.full_name.charAt(0) : 'U'}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-gray-900 truncate">{u.full_name}</h3>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {u.designation || 'Team Member'}
                </p>
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                  <Shield className="h-2.5 w-2.5 text-primary" />
                  {u.org_role}
                </span>
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Member since {format(new Date(u.created_at), 'MMM yyyy')}</span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center text-xs text-gray-400">
            No colleagues found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
