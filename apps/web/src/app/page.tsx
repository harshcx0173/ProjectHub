import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, User, Building, LogOut, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: orgSettings } = await supabase
    .from('org_settings')
    .select('*')
    .limit(1)
    .single();

  const handleSignOut = async () => {
    'use server';
    const client = await createClient();
    await client.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-white px-6 flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm shadow-subtle">
            PH
          </div>
          <div>
            <span className="font-semibold text-sm text-gray-900">
              {orgSettings?.app_name || 'Project Hub'}
            </span>
            <span className="text-gray-400 mx-2 text-xs">/</span>
            <span className="text-xs text-gray-500 font-medium">
              {orgSettings?.company_name || 'Hydrated Studio'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={profile?.org_role === 'Admin' ? 'default' : 'secondary'}>
            {profile?.org_role || 'Member'}
          </Badge>
          <form action={handleSignOut}>
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign Out
            </Button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Welcome, {profile?.full_name || user.email}
          </h1>
          <p className="text-sm text-gray-500">
            Organization Workspace • Single-Tenant Enterprise System
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <Card className="border border-border bg-white shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Your Profile
                </CardTitle>
                <Badge variant="success">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="font-medium text-gray-900">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-mono text-xs text-gray-700">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Organization Role</p>
                <p className="font-medium text-gray-900">{profile?.org_role}</p>
              </div>
            </CardContent>
          </Card>

          {/* Security & 2FA Status */}
          <Card className="border border-border bg-white shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Two-Factor Authentication</span>
                {profile?.is_totp_enabled ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Session Security</span>
                <span className="text-xs font-medium text-gray-700">HttpOnly / Secure</span>
              </div>
              <div className="pt-2">
                {!profile?.is_totp_enabled && (
                  <Link href="/auth/setup-2fa">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Configure 2FA
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Organization Settings */}
          <Card className="border border-border bg-white shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{orgSettings?.company_name || 'Hydrated Studio'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Access Policy</p>
                <p className="text-xs text-gray-700">Strict Invitation-Only (Public Signups Disabled)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestone 1 Ready Status Card */}
        <Card className="border border-green-200 bg-green-50/50 shadow-subtle">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-green-950">Milestone 1 Authentication & Core Schema Active</p>
              <p className="text-xs text-green-800">
                Invitation token hashing, password complexity policies, last-admin protection, RLS enforcement, and TOTP 2FA are fully configured.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
