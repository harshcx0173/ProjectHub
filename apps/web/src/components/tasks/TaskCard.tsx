'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, MessageSquare, AlertCircle, GripVertical } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

export interface TaskItem {
  id: string;
  statusId: string;
  taskKey: string;
  taskNumber: number;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string | null;
  position: number;
  version: number;
  creatorId?: string | null;
  assignees?: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  checklistTotal?: number;
  checklistCompleted?: number;
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskCardProps {
  task: TaskItem;
  onClick: () => void;
  isOverlay?: boolean;
}

const PRIORITY_STYLES: Record<string, { label: string; text: string; bg: string }> = {
  low: { label: 'Low', text: 'text-gray-600', bg: 'bg-gray-100 border-gray-200' },
  medium: { label: 'Medium', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  high: { label: 'High', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  urgent: { label: 'Urgent', text: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

export function TaskCard({ task, onClick, isOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityMeta = PRIORITY_STYLES[task.priority] ?? {
    label: 'Medium',
    text: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  };
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border border-border bg-white p-3.5 shadow-subtle hover:shadow-card hover:border-gray-300 transition-all cursor-pointer ${
        isOverlay ? 'shadow-lg border-primary rotate-1 scale-105' : ''
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Task ${task.taskKey}: ${task.title}`}
    >
      {/* Top Row: Task Key & Priority */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag task"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-tight">
            {task.taskKey}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${priorityMeta.bg} ${priorityMeta.text}`}
        >
          {task.priority === 'urgent' && <AlertCircle className="h-3 w-3" />}
          {priorityMeta.label}
        </span>
      </div>

      {/* Task Title */}
      <h3 className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 mb-2.5">
        {task.title}
      </h3>

      {/* Bottom Row: Metadata & Assignees */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
        <div className="flex items-center gap-2.5 text-gray-400 text-[11px]">
          {/* Due Date */}
          {dueDateObj && (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
              }`}
              title={format(dueDateObj, 'PPP')}
            >
              <Calendar className="h-3 w-3" />
              {format(dueDateObj, 'MMM d')}
            </span>
          )}

          {/* Checklist Counter */}
          {Boolean(task.checklistTotal && task.checklistTotal > 0) && (
            <span className="flex items-center gap-1 text-gray-500 font-medium">
              <CheckSquare className="h-3 w-3" />
              {task.checklistCompleted}/{task.checklistTotal}
            </span>
          )}

          {/* Comments Count */}
          {Boolean(task.commentsCount && task.commentsCount > 0) && (
            <span className="flex items-center gap-1 text-gray-500 font-medium">
              <MessageSquare className="h-3 w-3" />
              {task.commentsCount}
            </span>
          )}
        </div>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0">
            {task.assignees.slice(0, 3).map((assignee) => (
              <div
                key={assignee.id}
                title={assignee.full_name}
                className="h-5 w-5 rounded-full border border-white bg-primary text-white text-[9px] font-medium flex items-center justify-center uppercase overflow-hidden shadow-xs"
              >
                {assignee.avatar_url ? (
                  <img src={assignee.avatar_url} alt={assignee.full_name} className="h-full w-full object-cover" />
                ) : (
                  assignee.full_name.charAt(0)
                )}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="h-5 w-5 rounded-full border border-white bg-gray-200 text-gray-600 text-[9px] font-medium flex items-center justify-center">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
