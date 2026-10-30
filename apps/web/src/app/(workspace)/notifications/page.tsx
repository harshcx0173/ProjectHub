'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, MessageSquare, CheckSquare, UserPlus, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try {
      await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingRead(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <CheckSquare className="h-4 w-4 text-blue-600" />;
      case 'task_comment':
      case 'mention':
        return <MessageSquare className="h-4 w-4 text-indigo-600" />;
      case 'project_invite':
        return <UserPlus className="h-4 w-4 text-emerald-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Notifications</h1>
            <p className="text-xs text-gray-500">Activity and task assignments</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={markingRead || notifications.every((n) => n.is_read)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-subtle transition-colors disabled:opacity-50 cursor-pointer"
        >
          {markingRead ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <CheckCheck className="h-3.5 w-3.5 text-primary" />
          )}
          <span>{markingRead ? 'Updating...' : 'Mark all as read'}</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="rounded-2xl border border-border bg-white shadow-subtle divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
            <Bell className="h-8 w-8 text-gray-300" />
            <span className="font-semibold text-gray-700">No notifications</span>
            <span>You are completely caught up!</span>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                !n.is_read ? 'bg-primary/5' : 'hover:bg-gray-50/70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-gray-100 border border-gray-200 shrink-0 mt-0.5">
                  {getNotificationIcon(n.type)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">{n.title}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {format(new Date(n.created_at), 'PPP p')}
                  </span>
                </div>
              </div>

              {n.link_url && (
                <Link
                  href={n.link_url}
                  className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-primary hover:text-white text-xs font-medium text-gray-700 transition-colors shrink-0"
                >
                  View
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
