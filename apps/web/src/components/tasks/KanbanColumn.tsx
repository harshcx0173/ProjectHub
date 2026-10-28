'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { TaskCard, TaskItem } from './TaskCard';

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  is_completed?: boolean;
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
  onAddTaskClick: (statusId: string) => void;
}

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onAddTaskClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { statusId: status.id },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl bg-gray-50/80 border transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-border/80'
      } max-h-full`}
    >
      {/* Column Header */}
      <div className="p-3 pb-2 flex items-center justify-between border-b border-gray-200/60 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: status.color || '#64748B' }}
          />
          <h3 className="text-xs font-semibold text-gray-800 tracking-tight">{status.name}</h3>
          <span className="text-[11px] font-medium text-gray-400 bg-white px-1.5 py-0.2 rounded border border-gray-200 shadow-2xs">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAddTaskClick(status.id)}
          className="h-6 w-6 rounded-md hover:bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
          title={`Add task to ${status.name}`}
          aria-label={`Add task to ${status.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Task List Container */}
      <div className="flex-1 p-2 space-y-2.5 overflow-y-auto min-h-[140px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-24 rounded-lg border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-3">
            <p className="text-[11px] text-gray-400 font-medium">No tasks in this column</p>
            <button
              type="button"
              onClick={() => onAddTaskClick(status.id)}
              className="mt-1 text-[11px] text-primary hover:underline font-medium"
            >
              + Create task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
