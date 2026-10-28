'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/navigation/navbar';
import { Sidebar } from '@/components/navigation/sidebar';
import { CommandPalette } from '@/components/search/command-palette';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { Project, ProjectGroup, UserProfile, OrgSettings } from '@project-hub/shared';

interface WorkspaceShellProps {
  userProfile: UserProfile | null;
  orgSettings: OrgSettings | null;
  initialProjects: Project[];
  projectGroups: ProjectGroup[];
  activeProjectId?: string;
  children: React.ReactNode;
}

export function WorkspaceShell({
  userProfile,
  orgSettings,
  initialProjects,
  projectGroups,
  activeProjectId,
  children,
}: WorkspaceShellProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const handleTogglePin = async (projectId: string, currentPin: boolean) => {
    // Optimistic UI update
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isPinned: !currentPin } : p))
    );

    try {
      await fetch(`/api/v1/projects/${projectId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPin }),
      });
    } catch {
      // Revert if network error
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, isPinned: currentPin } : p))
      );
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [...prev, newProject]);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <Navbar
        userProfile={userProfile}
        orgSettings={orgSettings}
        projects={projects}
        activeProjectId={activeProjectId}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
      />

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          userProfile={userProfile}
          projects={projects}
          projectGroups={projectGroups}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCreateProject={() => setIsCreateProjectOpen(true)}
          onTogglePinProject={handleTogglePin}
        />

        {/* Content Area */}
        <main className="flex-1 flex overflow-hidden bg-background">
          {children}
        </main>
      </div>

      {/* Ctrl+K Command Palette */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        projectGroups={projectGroups}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
