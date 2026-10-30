'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Project, ProjectGroup, UserProfile } from '@project-hub/shared';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import {
  Home,
  CheckSquare,
  StickyNote,
  Inbox,
  Search,
  Pin,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Kanban,
  FileText,
  Users,
  Settings,
  Shield,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  userProfile: UserProfile | null;
  projects: Project[];
  projectGroups: ProjectGroup[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  onOpenCreateProject: () => void;
  onTogglePinProject: (projectId: string, currentPin: boolean) => void;
}

export function Sidebar({
  userProfile,
  projects,
  projectGroups,
  isCollapsed,
  onToggleCollapse,
  onOpenSearch,
  onOpenCreateProject,
  onTogglePinProject,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleProjectExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGroupExpand = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pinnedProjects = projects.filter((p) => p.isPinned && !p.isArchived);
  const unpinnedProjects = projects.filter((p) => !p.isPinned && !p.isArchived);

  return (
    <aside
      className={`relative flex flex-col border-r border-border bg-white transition-all duration-200 select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Fixed Menus */}
      <div className="p-2 space-y-0.5 border-b border-border">
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname === '/'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'Home' : undefined}
        >
          <Home className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Home</span>}
        </Link>

        <Link
          href="/tasks/my"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname.startsWith('/tasks/my')
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'My Tasks' : undefined}
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>My Tasks</span>}
        </Link>

        <Link
          href="/personal"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname.startsWith('/personal')
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'Personal Space' : undefined}
        >
          <StickyNote className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Personal Space</span>}
        </Link>

        <Link
          href="/notifications"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname.startsWith('/notifications')
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'Inbox / Notifications' : undefined}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Inbox</span>}
        </Link>

        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          title={isCollapsed ? 'Search (Ctrl+K)' : undefined}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span>Search</span>
              <kbd className="text-[10px] bg-gray-200 px-1 py-0.5 rounded text-gray-500 font-mono">
                Ctrl+K
              </kbd>
            </div>
          )}
        </button>
      </div>

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Pinned Projects */}
        {pinnedProjects.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Pin className="h-3 w-3 text-amber-500" />
                  Pinned
                </span>
                <span>{pinnedProjects.length}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {pinnedProjects.map((p) => {
                const isProjectActive = pathname.startsWith(`/projects/${p.id}`);
                const isExpanded = expandedProjects[p.id] ?? isProjectActive;

                return (
                  <div key={p.id} className="space-y-0.5">
                    <div
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isProjectActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => router.push(`/projects/${p.id}/board`)}
                      title={isCollapsed ? p.name : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <DynamicIcon name={p.iconValue} className="h-3.5 w-3.5 shrink-0" />
                        {!isCollapsed && <span className="truncate">{p.name}</span>}
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePinProject(p.id, true);
                            }}
                            className="p-1 rounded hover:bg-gray-200 text-amber-600"
                            title="Unpin project"
                          >
                            <Pin className="h-3 w-3 fill-amber-500" />
                          </button>
                          <button
                            onClick={(e) => toggleProjectExpand(p.id, e)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sub-menus */}
                    {!isCollapsed && isExpanded && (
                      <div className="pl-6 pr-2 py-0.5 space-y-0.5 border-l border-gray-100 ml-3">
                        <Link
                          href={`/projects/${p.id}/board`}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                            pathname === `/projects/${p.id}/board`
                              ? 'text-primary font-semibold bg-primary/5'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Kanban className="h-3 w-3 text-gray-400" />
                          Board
                        </Link>
                        <Link
                          href={`/projects/${p.id}/files`}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                            pathname === `/projects/${p.id}/files`
                              ? 'text-primary font-semibold bg-primary/5'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <FileText className="h-3 w-3 text-gray-400" />
                          Files
                        </Link>
                        <Link
                          href={`/projects/${p.id}/members`}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                            pathname === `/projects/${p.id}/members`
                              ? 'text-primary font-semibold bg-primary/5'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Users className="h-3 w-3 text-gray-400" />
                          Members
                        </Link>
                        <Link
                          href={`/projects/${p.id}/settings`}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                            pathname === `/projects/${p.id}/settings`
                              ? 'text-primary font-semibold bg-primary/5'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Settings className="h-3 w-3 text-gray-400" />
                          Settings
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Projects Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <span>All Projects</span>
              <button
                onClick={onOpenCreateProject}
                className="p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"
                title="Create Project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Project Groups / Folders */}
          {!isCollapsed &&
            projectGroups.map((group) => {
              const isGroupExpanded = expandedGroups[group.id] ?? true;
              const groupProjects = unpinnedProjects.filter((p) => p.groupId === group.id);

              return (
                <div key={group.id} className="space-y-0.5">
                  <button
                    onClick={() => toggleGroupExpand(group.id)}
                    className="flex items-center justify-between w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      {isGroupExpanded ? (
                        <FolderOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{group.name}</span>
                    </div>
                    {isGroupExpanded ? (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                    )}
                  </button>

                  {isGroupExpanded && (
                    <div className="pl-2 space-y-0.5">
                      {groupProjects.map((p) => {
                        const isProjectActive = pathname.startsWith(`/projects/${p.id}`);

                        return (
                          <div key={p.id} className="space-y-0.5">
                            <div
                              className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isProjectActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              onClick={() => router.push(`/projects/${p.id}/board`)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <DynamicIcon name={p.iconValue} className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{p.name}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          <div className="space-y-0.5">
            {unpinnedProjects.filter((p) => !p.groupId || isCollapsed).map((p) => {
              const isProjectActive = pathname.startsWith(`/projects/${p.id}`);
              const isExpanded = expandedProjects[p.id] ?? isProjectActive;

              return (
                <div key={p.id} className="space-y-0.5">
                  <div
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isProjectActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => router.push(`/projects/${p.id}/board`)}
                    title={isCollapsed ? p.name : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <DynamicIcon name={p.iconValue} className="h-3.5 w-3.5 shrink-0" />
                      {!isCollapsed && <span className="truncate">{p.name}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinProject(p.id, false);
                          }}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-amber-500"
                          title="Pin project"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => toggleProjectExpand(p.id, e)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && isExpanded && (
                    <div className="pl-6 pr-2 py-0.5 space-y-0.5 border-l border-gray-100 ml-3">
                      <Link
                        href={`/projects/${p.id}/board`}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                          pathname === `/projects/${p.id}/board`
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Kanban className="h-3 w-3 text-gray-400" />
                        Board
                      </Link>
                      <Link
                        href={`/projects/${p.id}/files`}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                          pathname === `/projects/${p.id}/files`
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <FileText className="h-3 w-3 text-gray-400" />
                        Files
                      </Link>
                      <Link
                        href={`/projects/${p.id}/members`}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                          pathname === `/projects/${p.id}/members`
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Users className="h-3 w-3 text-gray-400" />
                        Members
                      </Link>
                      <Link
                        href={`/projects/${p.id}/settings`}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                          pathname === `/projects/${p.id}/settings`
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Settings className="h-3 w-3 text-gray-400" />
                        Settings
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Fixed Section */}
      <div className="p-2 border-t border-border space-y-0.5">
        <Link
          href="/team"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname.startsWith('/team')
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'Team Members' : undefined}
        >
          <Users className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>People / Team</span>}
        </Link>

        {/* Admin Panel strictly visible only to Admin */}
        {userProfile?.orgRole === 'Admin' && (
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              pathname.startsWith('/admin')
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-primary hover:bg-primary/5'
            }`}
            title={isCollapsed ? 'Admin Panel' : undefined}
          >
            <Shield className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Admin Panel</span>}
          </Link>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
