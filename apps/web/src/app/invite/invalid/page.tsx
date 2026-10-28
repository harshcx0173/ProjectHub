'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, Clock, Ban, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';

function InvalidInvitationContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'INVALID';
  const customMessage = searchParams.get('message');

  const getReasonConfig = () => {
    switch (reason) {
      case 'INVITATION_EXPIRED':
        return {
          icon: <Clock className="h-8 w-8 text-amber-600" />,
          title: 'Invitation Link Expired',
          description:
            'This invitation link has passed its expiration window (7 days). For security reasons, expired links cannot be used.',
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'INVITATION_REVOKED':
        return {
          icon: <Ban className="h-8 w-8 text-red-600" />,
          title: 'Invitation Revoked',
          description:
            'An organization administrator has revoked this invitation. If you believe this is an error, please reach out to your team lead.',
          badgeColor: 'bg-red-50 text-red-800 border-red-200',
        };
      case 'INVITATION_ALREADY_USED':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-blue-600" />,
          title: 'Invitation Already Accepted',
          description:
            'This invitation has already been accepted and the account has been activated. Please sign in directly with your credentials.',
          badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      default:
        return {
          icon: <ShieldX className="h-8 w-8 text-gray-600" />,
          title: 'Invalid Invitation Link',
          description:
            customMessage ||
            'The invitation token was not recognized, is malformed, or has been removed from the system.',
          badgeColor: 'bg-gray-50 text-gray-800 border-gray-200',
        };
    }
  };

  const config = getReasonConfig();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Project Hub</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Hydrated Studio</p>
        </div>

        <Card className="border border-border bg-white shadow-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 border border-border">
              {config.icon}
            </div>
            <CardTitle>{config.title}</CardTitle>
            <CardDescription className="pt-2">{config.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-lg border border-border bg-gray-50 p-3 text-xs text-gray-600">
              <span className="font-semibold text-gray-800">What should you do?</span>
              <p className="mt-1">
                Contact your organization administrator to receive a fresh invitation link.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login" className="w-full">
                <Button variant="primary" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InvalidInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <InvalidInvitationContent />
    </Suspense>
  );
}
