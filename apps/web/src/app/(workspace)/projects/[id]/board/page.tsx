'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { Kanban, List, Plus, Layers, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskDrawer } from '@/components/tasks/TaskDrawer';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { TaskItem } from '@/components/tasks/TaskCard';
import { TaskStatus } from '@/components/tasks/KanbanColumn';
import { ProjectChatPanel } from '@/components/chat/ProjectChatPanel';
import { createClient } from '@/lib/supabase/client';
import { isUserMentioned } from '@/lib/mentions';

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string; email?: string } | null>(null);
  const [userPermissions, setUserPermissions] = useState<{
    canAssign?: boolean;
    canSelfAssign?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  }>({ canAssign: true, canSelfAssign: true, canCreate: true, canEdit: true, canDelete: true });
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultCreateStatusId, setDefaultCreateStatusId] = useState<string | undefined>();

  const selectedTaskIdRef = useRef<string | null>(selectedTaskId);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  const currentUserIdRef = useRef<string | undefined>(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const currentUserRef = useRef<{ id: string; fullName: string; email?: string } | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Fetch current user details
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setCurrentUser({
              id: data.user.id,
              fullName: profile?.full_name || '',
              email: data.user.email || '',
            });
          });
      }
    });
  }, []);

  // Fetch tasks, statuses and user permissions
  const fetchTasksAndStatuses = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load task board');
      }
      const data = await res.json();
      setStatuses(data.statuses || []);
      const formattedTasks: TaskItem[] = (data.tasks || []).map((t: any) => {
        const lastRead = typeof window !== 'undefined' ? localStorage.getItem(`task_read_${t.id}`) : null;
        const isNew = Boolean(
          t.commentsCount &&
          t.commentsCount > 0 &&
          t.latestCommentAt &&
          t.latestCommentAuthorId !== data.currentUserId &&
          (!lastRead || new Date(t.latestCommentAt) > new Date(lastRead))
        );
        return {
          ...t,
          hasNewComments: isNew,
          hasUnreadMention: isNew && t.hasUnreadMention,
        };
      });
      setTasks(formattedTasks);
      if (data.currentUserId) setCurrentUserId(data.currentUserId);
      if (data.userPermissions) setUserPermissions(data.userPermissions);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndStatuses();
  }, [projectId]);

  // Realtime subscription for comments on this project board
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board_task_comments_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
        },
        (payload) => {
          const newComment = payload.new as any;
          if (!newComment?.task_id) return;

          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === newComment.task_id) {
                const isCurrentlyOpen = selectedTaskIdRef.current === t.id;
                const isFromSelf = Boolean(
                  currentUserIdRef.current && newComment.author_id === currentUserIdRef.current
                );
                const isMentioned = currentUserRef.current
                  ? isUserMentioned(newComment.content, currentUserRef.current)
                  : false;
                return {
                  ...t,
                  commentsCount: (t.commentsCount || 0) + 1,
                  latestCommentAt: newComment.created_at,
                  hasNewComments: !isCurrentlyOpen && !isFromSelf ? true : t.hasNewComments,
                  hasUnreadMention: !isCurrentlyOpen && !isFromSelf && isMentioned ? true : t.hasUnreadMention,
                };
              }
              return t;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleTaskClick = (t: TaskItem) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`task_read_${t.id}`, new Date().toISOString());
    }
    setTasks((prev) =>
      prev.map((item) =>
        item.id === t.id ? { ...item, hasNewComments: false, hasUnreadMention: false } : item
      )
    );
    setSelectedTaskId(t.id);
  };

  const handleOpenCreateTask = (statusId?: string) => {
    setDefaultCreateStatusId(statusId);
    setIsCreateModalOpen(true);
  };

  // Filter tasks if "Assigned to me" is toggled
  const displayedTasks = useMemo(() => {
    if (!assignedToMeOnly || !currentUserId) return tasks;
    return tasks.filter((t) =>
      (t.assignees || []).some((a) => a.id === currentUserId)
    );
  }, [tasks, assignedToMeOnly, currentUserId]);

  const handleTasksChange = (updatedDisplayedTasks: TaskItem[]) => {
    if (!assignedToMeOnly) {
      setTasks(updatedDisplayedTasks);
    } else {
      // Merge updated displayed tasks back into full tasks array
      const updatedMap = new Map(updatedDisplayedTasks.map((t) => [t.id, t]));
      setTasks((prev) => prev.map((t) => updatedMap.get(t.id) || t));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-background">
      {/* Center Zone: Kanban Board or List View Container */}
      <div className="flex-1 flex flex-col rounded-xl border border-border bg-white shadow-subtle overflow-hidden min-w-0">
        {/* Toolbar Header */}
        <div className="p-3 border-b border-border flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Board vs List */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'board'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>

            {/* "Assigned to me" Filter Toggle */}
            <button
              type="button"
              onClick={() => setAssignedToMeOnly(!assignedToMeOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                assignedToMeOnly
                  ? 'bg-primary/10 border-primary text-primary shadow-2xs'
                  : 'border-border text-gray-600 hover:bg-gray-100'
              }`}
              title="Filter tasks assigned to me"
              aria-pressed={assignedToMeOnly}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Assigned to me</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTasksAndStatuses}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Refresh tasks"
              aria-label="Refresh tasks"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {userPermissions.canCreate && (
              <button
                type="button"
                onClick={() => handleOpenCreateTask()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Task
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
            <p className="text-xs text-gray-500">Loading project task board...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Failed to load tasks</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">{error}</p>
            <button
              type="button"
              onClick={fetchTasksAndStatuses}
              className="mt-4 px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No columns defined</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              Columns for this project haven&apos;t been generated yet.
            </p>
          </div>
        ) : viewMode === 'board' ? (
          <KanbanBoard
            statuses={statuses}
            tasks={displayedTasks}
            onTaskClick={handleTaskClick}
            onAddTaskClick={(sId) => handleOpenCreateTask(sId)}
            onTasksChange={handleTasksChange}
          />
        ) : (
          <TaskListView
            tasks={displayedTasks}
            statuses={statuses}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* Right Zone: Project Chat Panel (Milestone 4) */}
      <ProjectChatPanel projectId={projectId} />

      {/* Side Drawer for Task Details */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchTasksAndStatuses}
        statuses={statuses}
        currentUserId={currentUserId}
        currentUserName={currentUser?.fullName}
        userPermissions={userPermissions}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={projectId}
        defaultStatusId={defaultCreateStatusId}
        statuses={statuses}
        currentUserId={currentUserId}
        userPermissions={userPermissions}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={fetchTasksAndStatuses}
      />
    </div>
  );
}
