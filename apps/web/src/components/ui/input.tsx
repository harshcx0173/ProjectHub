import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={twMerge(
            clsx(
              'flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-subtle placeholder:text-gray-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )
          )}
          {...props}
        />
        {helperText && !error && <p className="text-xs text-gray-500">{helperText}</p>}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
