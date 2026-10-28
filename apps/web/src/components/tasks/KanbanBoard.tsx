'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { KanbanColumn, TaskStatus } from './KanbanColumn';
import { TaskCard, TaskItem } from './TaskCard';

interface KanbanBoardProps {
  statuses: TaskStatus[];
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
  onAddTaskClick: (statusId: string) => void;
  onTasksChange: (updatedTasks: TaskItem[]) => void;
}

export function KanbanBoard({
  statuses,
  tasks,
  onTaskClick,
  onAddTaskClick,
  onTasksChange,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Determine target column and position
    let targetStatusId: string;
    let newPosition: number;

    const overStatus = statuses.find((s) => s.id === overId);
    if (overStatus) {
      // Dropped directly onto the column background
      targetStatusId = overStatus.id;
      const tasksInTarget = tasks.filter((t) => t.statusId === targetStatusId && t.id !== activeId);
      newPosition = tasksInTarget.length;
    } else {
      // Dropped onto another task
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;

      targetStatusId = overTask.statusId;
      const tasksInTarget = tasks
        .filter((t) => t.statusId === targetStatusId && t.id !== activeId)
        .sort((a, b) => a.position - b.position);

      const overIndex = tasksInTarget.findIndex((t) => t.id === overId);
      newPosition = overIndex >= 0 ? overIndex : tasksInTarget.length;
    }

    if (draggedTask.statusId === targetStatusId && draggedTask.position === newPosition) {
      return; // No change
    }

    // Optimistic UI update
    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) => {
      if (t.id === activeId) {
        return {
          ...t,
          statusId: targetStatusId,
          position: newPosition,
          version: t.version + 1,
        };
      }
      return t;
    });

    onTasksChange(updatedTasks);

    // Call API to sync
    try {
      const res = await fetch(`/api/v1/tasks/${activeId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatusId,
          newPosition,
          currentVersion: draggedTask.version,
        }),
      });

      if (!res.ok) {
        // Rollback on conflict or error
        onTasksChange(previousTasks);
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || 'Failed to move task. Reverting changes.');
      }
    } catch {
      onTasksChange(previousTasks);
      alert('Network error while moving task. Reverted.');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex gap-4 overflow-x-auto p-4 pb-6 min-h-0">
        {statuses.map((status) => {
          const columnTasks = tasks
            .filter((t) => t.statusId === status.id)
            .sort((a, b) => a.position - b.position);

          return (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={columnTasks}
              onTaskClick={onTaskClick}
              onAddTaskClick={onAddTaskClick}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
