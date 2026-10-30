'use client';

import React, { useState, useEffect, use } from 'react';
import { Users, Shield, AlertCircle } from 'lucide-react';

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`);
      if (!res.ok) throw new Error('Failed to load project members');
      const data = await res.json();
      setMembers(data.members || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Project Members</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Team members with access to this project&apos;s tasks, files, and discussion channel.
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-white shadow-subtle">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading members...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center uppercase shadow-2xs">
                    {m.fullName ? m.fullName.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">{m.fullName}</h3>
                    <p className="text-[11px] text-gray-400">{m.designation || 'Member'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                    <Shield className="h-3 w-3 text-primary" />
                    {m.projectRole}
                  </span>
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="p-12 text-center text-xs text-gray-400">
                No individual members assigned. Project is visible to organization administrators.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
