'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while sending password reset email.');
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
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-center">Reset Your Password</CardTitle>
            <CardDescription className="text-center">
              Enter your registered email address to receive password reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSuccess ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-4 border border-green-200 text-xs font-medium text-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span>
                    If an active account exists for {email}, password recovery instructions have been dispatched.
                  </span>
                </div>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <Input
                  id="email"
                  type="email"
                  label="Registered Email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                  Send Password Reset Instructions
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-xs font-medium text-gray-600 hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
