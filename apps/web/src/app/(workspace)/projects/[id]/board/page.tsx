'use client';

import React, { useState, useEffect, use } from 'react';
import { Kanban, List, Plus, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskDrawer } from '@/components/tasks/TaskDrawer';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { TaskItem } from '@/components/tasks/TaskCard';
import { TaskStatus } from '@/components/tasks/KanbanColumn';
import { ProjectChatPanel } from '@/components/chat/ProjectChatPanel';

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultCreateStatusId, setDefaultCreateStatusId] = useState<string | undefined>();

  // Fetch tasks and statuses
  const fetchTasksAndStatuses = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load task board');
      }
      const data = await res.json();
      setStatuses(data.statuses || []);
      setTasks(data.tasks || []);
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

  const handleOpenCreateTask = (statusId?: string) => {
    setDefaultCreateStatusId(statusId);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-background">
      {/* Center Zone: Kanban Board or List View Container */}
      <div className="flex-1 flex flex-col rounded-xl border border-border bg-white shadow-subtle overflow-hidden min-w-0">
        {/* Toolbar Header */}
        <div className="p-3 border-b border-border flex items-center justify-between gap-3 bg-white shrink-0">
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

            <button
              type="button"
              onClick={() => handleOpenCreateTask()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
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
            tasks={tasks}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
            onAddTaskClick={(sId) => handleOpenCreateTask(sId)}
            onTasksChange={(newTasks) => setTasks(newTasks)}
          />
        ) : (
          <TaskListView
            tasks={tasks}
            statuses={statuses}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
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
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={projectId}
        defaultStatusId={defaultCreateStatusId}
        statuses={statuses}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={fetchTasksAndStatuses}
      />
    </div>
  );
}
