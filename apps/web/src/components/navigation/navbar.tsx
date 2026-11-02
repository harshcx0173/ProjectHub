'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project, UserProfile, OrgSettings } from '@project-hub/shared';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Shield,
  User,
  Plus,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface NavbarProps {
  userProfile: UserProfile | null;
  orgSettings: OrgSettings | null;
  projects: Project[];
  activeProjectId?: string;
  onOpenSearch: () => void;
  onOpenCreateProject?: () => void;
}

export function Navbar({
  userProfile,
  orgSettings,
  projects,
  activeProjectId,
  onOpenSearch,
  onOpenCreateProject,
}: NavbarProps) {
  const router = useRouter();
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const lastKnownNotifIdRef = React.useRef<string | null>(null);

  // Poll for notifications and trigger desktop push
  React.useEffect(() => {
    let isMounted = true;

    // Ask for Notification permission on first load if default
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const checkNotifications = async () => {
      try {
        const res = await fetch('/api/v1/notifications');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const count = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
        setUnreadCount(count);

        const list = Array.isArray(data.notifications) ? data.notifications : [];
        if (list.length > 0) {
          const newest = list[0];
          if (
            lastKnownNotifIdRef.current &&
            newest.id !== lastKnownNotifIdRef.current &&
            !newest.is_read
          ) {
            // New notification arrived! Trigger Desktop push if permitted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                const pushNotif = new Notification(newest.title, {
                  body: newest.body,
                  icon: '/favicon.ico',
                });
                pushNotif.onclick = () => {
                  window.focus();
                  if (newest.link_url) router.push(newest.link_url);
                };
              } catch {}
            }
          }
          lastKnownNotifIdRef.current = newest.id;
        }
      } catch {}
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 15000);

    // Instant Realtime notification push delivery
    const supabase = createClient();
    let notifChannel: any = null;

    if (userProfile?.id) {
      notifChannel = supabase
        .channel(`realtime_user_notifications_${userProfile.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`,
          },
          (payload) => {
            const newNotif = payload.new as any;
            if (newNotif) {
              setUnreadCount((prev) => prev + 1);
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  const pushNotif = new Notification(newNotif.title, {
                    body: newNotif.body,
                    icon: '/favicon.ico',
                  });
                  pushNotif.onclick = () => {
                    window.focus();
                    if (newNotif.link_url) router.push(newNotif.link_url);
                  };
                } catch {}
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
    };
  }, [router]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-border bg-white px-4 flex items-center justify-between shadow-subtle z-30 select-none">
      {/* Left: Brand & Project Switcher */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shadow-subtle">
            PH
          </div>
          <div className="hidden sm:block">
            <span className="font-semibold text-sm text-gray-900 leading-none">
              {orgSettings?.appName || 'Project Hub'}
            </span>
            <span className="block text-[11px] text-gray-400 leading-tight">
              {orgSettings?.companyName || 'Hydrated Studio'}
            </span>
          </div>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Project Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-800 transition-colors"
          >
            {activeProject ? (
              <>
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeProject.color }}
                />
                <DynamicIcon name={activeProject.iconValue} className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{activeProject.name}</span>
              </>
            ) : (
              <span className="text-gray-500">Select Project...</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-1" />
          </button>

          {isProjectDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-border bg-white p-1.5 shadow-elevated z-50">
              <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Projects ({projects.length})
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      router.push(`/projects/${p.id}/board`);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      p.id === activeProjectId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <DynamicIcon name={p.iconValue} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.id === activeProjectId && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                ))}
              </div>

              {onOpenCreateProject && (
                <div className="pt-1 mt-1 border-t border-border">
                  <button
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      onOpenCreateProject();
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Project...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Global Search Trigger Button */}
      <div className="hidden md:flex flex-1 max-w-sm mx-6">
        <button
          onClick={onOpenSearch}
          className="flex items-center justify-between w-full h-8 px-3 rounded-lg border border-border bg-gray-50 hover:bg-gray-100 text-xs text-gray-400 transition-colors shadow-subtle"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <span>Search workspace...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white rounded border border-gray-200 text-gray-500">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Notifications & Profile Dropdown */}
      <div className="flex items-center gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications Bell */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission().catch(() => {});
            }
            router.push('/notifications');
          }}
          className="relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              {userProfile?.fullName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <span className="block text-xs font-medium text-gray-800 leading-none">
                {userProfile?.fullName || 'User'}
              </span>
              <span className="block text-[10px] text-gray-400 mt-0.5 leading-none">
                {userProfile?.orgRole || 'Member'}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-border bg-white p-1.5 shadow-elevated z-50">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-xs font-semibold text-gray-900 truncate">{userProfile?.fullName}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge variant={userProfile?.orgRole === 'Admin' ? 'default' : 'secondary'}>
                    {userProfile?.orgRole}
                  </Badge>
                </div>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="h-3.5 w-3.5 text-gray-400" />
                Profile & Settings
              </Link>

              {userProfile?.orgRole === 'Admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-primary font-medium hover:bg-primary/5 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </Link>
              )}

              <div className="pt-1 mt-1 border-t border-border">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
