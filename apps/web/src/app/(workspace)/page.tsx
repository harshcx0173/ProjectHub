import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import {
  Folder,
  ArrowRight,
  Pin,
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, org_role')
    .eq('id', user!.id)
    .maybeSingle();

  // Fetch authorized projects
  const { data: rawProjects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      key,
      description,
      icon_type,
      icon_value,
      color,
      is_archived,
      created_at,
      user_project_prefs!left(is_pinned, last_opened_at)
    `)
    .eq('is_archived', false)
    .order('name');

  const projects = (rawProjects || []).map((p: any) => {
    const prefs = Array.isArray(p.user_project_prefs)
      ? p.user_project_prefs[0]
      : p.user_project_prefs;

    return {
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      iconValue: p.icon_value,
      color: p.color,
      isPinned: Boolean(prefs?.is_pinned),
    };
  });

  const pinned = projects.filter((p) => p.isPinned);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-gray-50/50">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Welcome back, {profile?.full_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Company Project Workspace • Single-Tenant Dashboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={profile?.org_role === 'Admin' ? 'default' : 'secondary'}>
            Role: {profile?.org_role}
          </Badge>
        </div>
      </div>

      {/* Pinned Projects Section */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Pinned Projects ({pinned.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/board`}
                className="group block"
              >
                <Card className="h-full border border-border bg-white shadow-card hover:shadow-elevated hover:border-primary/40 transition-all p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-subtle"
                        style={{ backgroundColor: project.color }}
                      >
                        <DynamicIcon name={project.iconValue} className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <span className="text-[11px] font-mono text-gray-400 uppercase">
                          {project.key}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  {project.description && (
                    <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Accessible Projects Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Your Projects ({projects.length})
            </h2>
          </div>
        </div>

        {projects.length === 0 ? (
          <Card className="border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 mb-3">
              <Folder className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No Projects Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              You currently do not have access to any projects. Use the sidebar &quot;+&quot; button to create your first project or contact an administrator.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/board`}
                className="group block"
              >
                <Card className="h-full border border-border bg-white shadow-card hover:shadow-elevated hover:border-primary/40 transition-all p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-subtle"
                        style={{ backgroundColor: project.color }}
                      >
                        <DynamicIcon name={project.iconValue} className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <span className="text-[11px] font-mono text-gray-400 uppercase">
                          {project.key}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  {project.description && (
                    <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
