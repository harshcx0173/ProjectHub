import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Project, ProjectGroup, UserProfile, OrgSettings } from '@project-hub/shared';

export default async function AuthenticatedWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.status === 'disabled') {
    redirect('/login?error=deactivated');
  }

  // Fetch Org Settings
  const { data: orgSettingsData } = await supabase
    .from('org_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  // Fetch User Projects
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
      group_id,
      is_archived,
      created_by,
      created_at,
      updated_at,
      user_project_prefs!left(is_pinned, last_opened_at)
    `)
    .eq('is_archived', false)
    .order('name');

  // Fetch Project Groups
  const { data: rawGroups } = await supabase
    .from('project_groups')
    .select('*')
    .order('position', { ascending: true });

  const projects: Project[] = (rawProjects || []).map((p: any) => {
    const prefs = Array.isArray(p.user_project_prefs)
      ? p.user_project_prefs[0]
      : p.user_project_prefs;

    return {
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      iconType: p.icon_type,
      iconValue: p.icon_value,
      color: p.color,
      groupId: p.group_id,
      isArchived: p.is_archived,
      createdBy: p.created_by,
      isPinned: Boolean(prefs?.is_pinned),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  const projectGroups: ProjectGroup[] = (rawGroups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    position: g.position,
    createdAt: g.created_at,
  }));

  const userProfile: UserProfile = {
    id: profile.id,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    designation: profile.designation,
    timezone: profile.timezone,
    status: profile.status,
    orgRole: profile.org_role,
    isTotpEnabled: profile.is_totp_enabled,
    lastSeenAt: profile.last_seen_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };

  const orgSettings: OrgSettings = {
    id: orgSettingsData?.id || '',
    companyName: orgSettingsData?.company_name || 'Hydrated Studio',
    appName: orgSettingsData?.app_name || 'Project Hub',
    logoUrl: orgSettingsData?.logo_url || null,
    timezone: orgSettingsData?.timezone || 'UTC',
    workingDays: orgSettingsData?.working_days || [1, 2, 3, 4, 5],
    createdAt: orgSettingsData?.created_at || '',
    updatedAt: orgSettingsData?.updated_at || '',
  };

  return (
    <WorkspaceShell
      userProfile={userProfile}
      orgSettings={orgSettings}
      initialProjects={projects}
      projectGroups={projectGroups}
    >
      {children}
    </WorkspaceShell>
  );
}
