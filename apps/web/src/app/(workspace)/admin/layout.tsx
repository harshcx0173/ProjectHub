import React from 'react';
import Link from 'next/link';
import { Users, Mail, Shield, History, Settings, ShieldAlert } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Admin Top Navigation */}
      <div className="border-b border-border bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold text-gray-900 tracking-tight">Admin Console</h1>
        </div>

        <nav className="flex items-center gap-1">
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-gray-500" />
            Users
          </Link>
          <Link
            href="/admin/invitations"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-gray-500" />
            Invitations
          </Link>
          <Link
            href="/admin/roles"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Shield className="h-3.5 w-3.5 text-gray-500" />
            Roles & Permissions
          </Link>
          <Link
            href="/admin/audit-logs"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <History className="h-3.5 w-3.5 text-gray-500" />
            Audit Logs
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-gray-500" />
            Settings
          </Link>
        </nav>
      </div>

      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  );
}
