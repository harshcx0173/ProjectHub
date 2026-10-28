'use client';

import React, { useState, useMemo } from 'react';
import { TaskItem } from './TaskCard';
import { TaskStatus } from './KanbanColumn';
import { Calendar, CheckSquare, ArrowUpDown, Search, Filter } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

interface TaskListViewProps {
  tasks: TaskItem[];
  statuses: TaskStatus[];
  onTaskClick: (task: TaskItem) => void;
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function TaskListView({ tasks, statuses, onTaskClick }: TaskListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'key' | 'dueDate' | 'priority' | 'title'>('key');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const statusMap = useMemo(() => {
    return new Map(statuses.map((s) => [s.id, s]));
  }, [statuses]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.statusId !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesKey = t.taskKey.toLowerCase().includes(query);
        const matchesTitle = t.title.toLowerCase().includes(query);
        if (!matchesKey && !matchesTitle) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, searchTerm]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'key') {
        cmp = a.taskNumber - b.taskNumber;
      } else if (sortBy === 'priority') {
        cmp = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      } else if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'title') {
        cmp = a.title.localeCompare(b.title);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredTasks, sortBy, sortAsc]);

  const toggleSort = (col: 'key' | 'dueDate' | 'priority' | 'title') => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
      {/* Filters & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border shadow-subtle shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter tasks by key or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Filter className="h-3 w-3" />
            <span className="text-[11px] font-medium">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2 rounded-lg border border-border bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <span className="text-gray-300">|</span>

          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="text-[11px] font-medium">Priority:</span>
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs py-1.5 px-2 rounded-lg border border-border bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-border bg-white shadow-subtle">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-50/80 border-b border-border sticky top-0 z-10 text-gray-600 font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-3 w-28">
                <button
                  type="button"
                  onClick={() => toggleSort('key')}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Key <ArrowUpDown className="h-3 w-3 text-gray-400" />
                </button>
              </th>
              <th className="py-2.5 px-3">
                <button
                  type="button"
                  onClick={() => toggleSort('title')}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Title <ArrowUpDown className="h-3 w-3 text-gray-400" />
                </button>
              </th>
              <th className="py-2.5 px-3 w-36">Status</th>
              <th className="py-2.5 px-3 w-28">
                <button
                  type="button"
                  onClick={() => toggleSort('priority')}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Priority <ArrowUpDown className="h-3 w-3 text-gray-400" />
                </button>
              </th>
              <th className="py-2.5 px-3 w-32">
                <button
                  type="button"
                  onClick={() => toggleSort('dueDate')}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Due Date <ArrowUpDown className="h-3 w-3 text-gray-400" />
                </button>
              </th>
              <th className="py-2.5 px-3 w-28">Progress</th>
              <th className="py-2.5 px-3 w-28 text-right">Assignees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedTasks.map((task) => {
              const status = statusMap.get(task.statusId);
              const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj);

              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-gray-600 uppercase text-[11px]">
                    {task.taskKey}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-gray-900 group-hover:text-primary transition-colors">
                    <span className="line-clamp-1">{task.title}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: status?.color || '#64748B' }}
                      />
                      {status?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                        task.priority === 'urgent'
                          ? 'bg-red-50 text-red-700'
                          : task.priority === 'high'
                          ? 'bg-amber-50 text-amber-700'
                          : task.priority === 'medium'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">
                    {dueDateObj ? (
                      <span
                        className={`flex items-center gap-1 ${
                          isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {format(dueDateObj, 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-gray-500">
                    {Boolean(task.checklistTotal && task.checklistTotal > 0) ? (
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3 text-gray-400" />
                        {task.checklistCompleted}/{task.checklistTotal}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="flex -space-x-1 justify-end">
                        {task.assignees.slice(0, 2).map((a) => (
                          <div
                            key={a.id}
                            title={a.full_name}
                            className="h-5 w-5 rounded-full bg-primary text-white text-[9px] font-medium flex items-center justify-center uppercase border border-white"
                          >
                            {a.full_name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-[11px]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {sortedTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                  No tasks found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
