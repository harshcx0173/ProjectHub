'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Check, X, AlertCircle, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !passwordsMatch) {
      setErrorMessage('Please ensure passwords match and fulfill all complexity requirements.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      router.push('/login?status=password_updated');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating your password.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Project Hub</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Hydrated Studio</p>
        </div>

        <Card className="border border-border bg-white shadow-card">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-center">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Enter and confirm your new secure password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="password"
                type="password"
                label="New Password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="rounded-lg border border-border bg-gray-50 p-3 space-y-1.5 text-xs text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">Requirements:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasMinLength ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    10+ characters
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasUppercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Uppercase
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasLowercase ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasLowercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Lowercase
                  </span>
                  <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasNumber ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Number
                  </span>
                  <span className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {hasSpecial ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Special symbol
                  </span>
                </div>
              </div>

              <Input
                id="confirmPassword"
                type="password"
                label="Confirm New Password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                disabled={!isPasswordValid || !passwordsMatch}
              >
                Update Password
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
