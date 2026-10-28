import React from 'react';
import { Kanban, MessageSquare, Layers } from 'lucide-react';

export default async function ProjectBoardPage() {

  return (
    <div className="flex-1 flex overflow-hidden p-6 gap-6">
      {/* Center Zone: Kanban Task Board container */}
      <div className="flex-1 flex flex-col rounded-xl border border-border bg-white shadow-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Kanban className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-gray-900">Task Board</h2>
          </div>
          <span className="text-xs text-gray-400">Milestone 3 Task Pipeline</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 text-center bg-gray-50/50">
          <div className="max-w-md space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Ready for Milestone 3 Task Board</h3>
            <p className="text-xs text-gray-500">
              Interactive Kanban columns (To Do, In Progress, Review, Done), dnd-kit drag-and-drop, and side drawer task details will render here.
            </p>
          </div>
        </div>
      </div>

      {/* Right Zone: Project Chat Panel placeholder */}
      <div className="w-80 hidden lg:flex flex-col rounded-xl border border-border bg-white shadow-card overflow-hidden shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-gray-900">Project Chat</h2>
          </div>
          <span className="text-xs text-gray-400">Milestone 4</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 text-center bg-gray-50/50">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Side-by-Side Realtime Chat</p>
            <p className="text-[11px] text-gray-400">
              Collapsible and resizable realtime channel for this project.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
