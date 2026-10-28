import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx('rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card', className)
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx('flex flex-col space-y-1.5 pb-4', className))} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={twMerge(clsx('text-lg font-semibold leading-none tracking-tight text-foreground', className))}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={twMerge(clsx('text-sm text-muted-foreground', className))} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx('pt-0', className))} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx('flex items-center pt-4 border-t border-border mt-4', className))} {...props} />;
}
