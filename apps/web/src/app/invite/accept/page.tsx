'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Shield, UserCheck, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface VerificationData {
  email: string;
  orgRole: string;
  expiresAt: string;
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [tokenData, setTokenData] = useState<VerificationData | null>(null);
  const [tokenError, setTokenError] = useState<{ code: string; message: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Password rules
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (!token) {
      router.replace('/invite/invalid?reason=MISSING');
      return;
    }

    async function verify() {
      setIsLoadingToken(true);
      try {
        const res = await fetch(`/api/v1/invitations/verify?token=${encodeURIComponent(token!)}`);
        const data = await res.json();

        if (!res.ok) {
          router.replace(`/invite/invalid?reason=${data.error || 'INVALID'}&message=${encodeURIComponent(data.message || '')}`);
          return;
        }

        setTokenData(data);
      } catch (err: any) {
        setTokenError({
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to verification server. Please check your network.',
        });
      } finally {
        setIsLoadingToken(false);
      }
    }

    verify();
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setFormError('Please ensure your password meets all complexity requirements.');
      return;
    }

    if (!passwordsMatch) {
      setFormError('Passwords do not match.');
      return;
    }

    if (!fullName.trim()) {
      setFormError('Please provide your full name.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName: fullName.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message || 'Failed to accept invitation.');
        setIsSubmitting(false);
        return;
      }

      // Success: redirect to login
      router.push('/login?status=invite_accepted');
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while processing invitation.');
      setIsSubmitting(false);
    }
  };

  if (isLoadingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-gray-600">Verifying invitation security token...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full border border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-base text-red-800">Verification Error</CardTitle>
            </div>
            <CardDescription className="text-red-700">{tokenError.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
              Retry Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-subtle">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Accept Team Invitation</h1>
          <p className="text-sm text-gray-600">Join the Hydrated Studio workspace</p>
        </div>

        <Card className="border border-border bg-white shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Complete Your Account</CardTitle>
                <CardDescription>Setup your member profile and password</CardDescription>
              </div>
              {tokenData && (
                <Badge variant={tokenData.orgRole === 'Admin' ? 'default' : 'secondary'}>
                  Role: {tokenData.orgRole}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {formError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Read-Only Assigned Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Assigned Email (Locked)
                </label>
                <div className="flex h-10 w-full items-center rounded-lg border border-border bg-gray-100 px-3 text-sm text-gray-700 select-none">
                  {tokenData?.email}
                </div>
                <p className="text-xs text-gray-500">
                  Invitations are bound to this email and cannot be changed.
                </p>
              </div>

              {/* Full Name */}
              <Input
                id="fullName"
                label="Full Name"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              {/* Password */}
              <Input
                id="password"
                type="password"
                label="Create Password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* Password Checklist */}
              <div className="rounded-lg border border-border bg-gray-50 p-3 space-y-1.5 text-xs text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">Password requirements:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasMinLength ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    At least 10 chars
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasUppercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Uppercase letter
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasLowercase ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasLowercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Lowercase letter
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasNumber ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Number (0-9)
                  </span>
                  <span className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasSpecial ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Special symbol (!@#$%^&*)
                  </span>
                </div>
              </div>

              {/* Confirm Password */}
              <Input
                id="confirmPassword"
                type="password"
                label="Confirm Password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting}
                disabled={!isPasswordValid || !passwordsMatch || !fullName.trim()}
              >
                Accept Invitation & Activate Account
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Shield className="h-3.5 w-3.5 text-gray-400" />
          <span>Encrypted enterprise onboarding flow</span>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium text-gray-600">Loading invitation details...</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
