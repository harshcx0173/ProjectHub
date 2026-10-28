'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Copy, Check, AlertCircle, ArrowRight, KeyRound, Loader2 } from 'lucide-react';

export default function SetupTotpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    async function loadSetup() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/v1/auth/totp/setup', { method: 'POST' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}: Failed to initialize 2FA setup.` }));
          setErrorMessage(errData.message || 'Failed to initialize 2FA setup.');
          return;
        }
        const data = await res.json();
        setQrCodeUrl(data.qrCodeDataUrl);
        setSecretKey(data.secret);
      } catch (err: any) {
        setErrorMessage(err.message || 'Network error initializing 2FA.');
      } finally {
        setIsLoading(false);
      }
    }

    loadSetup();
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyRecoveryCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Verification failed.' }));
        setErrorMessage(errData.message || 'Failed to verify 2FA code.');
        setIsVerifying(false);
        return;
      }

      const data = await res.json();
      setRecoveryCodes(data.recoveryCodes);
      setIsVerifying(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unexpected verification error.');
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-gray-600">Configuring two-factor authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-subtle">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Two-Factor Authentication</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700 bg-amber-50 inline-block px-2.5 py-1 rounded-full border border-amber-200">
            Mandatory Security Step for Administrators
          </p>
        </div>

        {recoveryCodes ? (
          /* Step 2: Show Recovery Codes */
          <Card className="border border-border bg-white shadow-card">
            <CardHeader>
              <CardTitle>Save Your Recovery Codes</CardTitle>
              <CardDescription>
                Store these 10 one-time backup codes in a secure location (e.g., password manager).
                If you lose access to your authenticator app, these are the only way to recover your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-gray-800">
                  {recoveryCodes.map((rc, idx) => (
                    <div key={idx} className="bg-white p-2 rounded border border-gray-200 text-center font-bold">
                      {rc}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleCopyRecoveryCodes}
                className="w-full"
              >
                {copiedCodes ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {copiedCodes ? 'Recovery Codes Copied!' : 'Copy All Recovery Codes'}
              </Button>

              <Button
                variant="primary"
                onClick={() => {
                  router.push('/');
                  router.refresh();
                }}
                className="w-full"
              >
                I Have Saved My Codes - Proceed to Workspace
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Step 1: Scan QR Code & Verify */
          <Card className="border border-border bg-white shadow-card">
            <CardHeader>
              <CardTitle>Scan with Authenticator App</CardTitle>
              <CardDescription>
                Open Google Authenticator, 1Password, or Microsoft Authenticator and scan the code below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex flex-col items-center justify-center p-4 bg-white border border-border rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 rounded" />
                </div>
              )}

              {/* Manual Entry Key */}
              <div className="rounded-lg border border-border bg-gray-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Cannot scan? Enter manual secret key:
                </p>
                <div className="flex items-center justify-between bg-white rounded border border-border p-2">
                  <span className="font-mono text-xs text-gray-800 select-all tracking-wider">{secretKey}</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyKey} type="button">
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleVerify} className="space-y-4">
                <Input
                  id="code"
                  label="Enter 6-digit Code from Authenticator"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                  required
                />

                <Button type="submit" variant="primary" className="w-full" isLoading={isVerifying}>
                  <KeyRound className="h-4 w-4 mr-1.5" />
                  Verify & Activate 2FA
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
