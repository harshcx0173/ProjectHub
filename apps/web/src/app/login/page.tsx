'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, ShieldAlert, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    errorParam === 'deactivated'
      ? 'Your account has been deactivated. Please contact your organization administrator.'
      : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setErrorMessage('Unable to retrieve user session.');
        setIsLoading(false);
        return;
      }

      // Check profile status and role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status, org_role, is_totp_enabled')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setErrorMessage('User profile not found. Please contact support.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (profile.status === 'disabled') {
        setErrorMessage('Your account has been deactivated.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // If user has 2FA enabled, redirect to 2FA challenge
      if (profile.is_totp_enabled) {
        router.push('/auth/2fa');
        return;
      }

      // Mandatory 2FA for Admin
      if (profile.org_role === 'Admin' && !profile.is_totp_enabled) {
        router.push('/auth/setup-2fa');
        return;
      }

      // Standard redirect
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during sign in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header / Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-subtle">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Project Hub</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Hydrated Studio</p>
        </div>

        {/* Login Card */}
        <Card className="border border-border bg-white shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Invitation-only access. Enter your authorized credentials below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <div className="space-y-1">
                <Input
                  id="password"
                  type="password"
                  label="Password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <div className="flex justify-end pt-1">
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-primary hover:text-primary-hover hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Sign In
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <ShieldAlert className="h-3.5 w-3.5 text-gray-400" />
          <span>Single-tenant enterprise workspace. Public signup disabled.</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
