import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { Kanban, FileText, Users, Settings } from 'lucide-react';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch project with permissions check (RLS enforced)
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Record last opened preference
  await supabase.from('user_project_prefs').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      last_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id, project_id' }
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Project Header */}
      <div className="border-b border-border bg-white px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-subtle shrink-0"
            style={{ backgroundColor: project.color }}
          >
            <DynamicIcon name={project.icon_value} className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 leading-none">{project.name}</h1>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase font-semibold">
                {project.key}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{project.description}</p>
            )}
          </div>
        </div>

        {/* Project Navigation Tabs */}
        <nav className="flex items-center gap-1">
          <Link
            href={`/projects/${projectId}/board`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Kanban className="h-3.5 w-3.5 text-gray-500" />
            Board
          </Link>
          <Link
            href={`/projects/${projectId}/files`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-gray-500" />
            Files
          </Link>
          <Link
            href={`/projects/${projectId}/members`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-gray-500" />
            Members
          </Link>
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-gray-500" />
            Settings
          </Link>
        </nav>
      </div>

      {/* Main Content (Board, Files, Members, Settings) */}
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  );
}
