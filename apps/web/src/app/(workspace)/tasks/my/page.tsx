'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckSquare, Calendar, Search, AlertCircle, ArrowRight } from 'lucide-react';
import { format, isPast, isToday, isThisWeek } from 'date-fns';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'overdue' | 'today' | 'week'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/v1/tasks/my')
      .then((res) => res.json())
      .then((data) => {
        if (data.tasks) {
          setTasks(data.tasks);
        } else {
          setError(data.message || 'Failed to load assigned tasks');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.taskKey.toLowerCase().includes(q)) {
        return false;
      }
    }

    if (filterPeriod === 'all') return true;

    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);

    if (filterPeriod === 'overdue') {
      return isPast(d) && !isToday(d);
    }
    if (filterPeriod === 'today') {
      return isToday(d);
    }
    if (filterPeriod === 'week') {
      return isThisWeek(d);
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Tasks</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            All tasks assigned to you across your active projects.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setFilterPeriod('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterPeriod === 'all'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterPeriod('today')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterPeriod === 'today'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Due Today
          </button>
          <button
            type="button"
            onClick={() => setFilterPeriod('week')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterPeriod === 'week'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setFilterPeriod('overdue')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterPeriod === 'overdue'
                ? 'bg-red-50 text-red-700 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Overdue
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by title or key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-white shadow-subtle">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading your assigned tasks...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
            <CheckSquare className="h-8 w-8 text-gray-300" />
            <span>No tasks found for the selected period.</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((t) => {
              const dueDateObj = t.dueDate ? new Date(t.dueDate) : null;
              const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj);

              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}/board?task=${t.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.project?.color || '#2563EB' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-gray-500 uppercase">
                          {t.taskKey}
                        </span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {t.project?.name}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
                        {t.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    {/* Status */}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {t.status?.name || 'In Progress'}
                    </span>

                    {/* Priority */}
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        t.priority === 'urgent'
                          ? 'bg-red-50 text-red-700'
                          : t.priority === 'high'
                          ? 'bg-amber-50 text-amber-700'
                          : t.priority === 'medium'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.priority}
                    </span>

                    {/* Due Date */}
                    {dueDateObj ? (
                      <span
                        className={`flex items-center gap-1 text-[11px] ${
                          isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {format(dueDateObj, 'MMM d')}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[11px]">-</span>
                    )}

                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
