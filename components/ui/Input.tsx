'use client';
import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-gray-400">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500',
          'focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30',
          'transition-all duration-200',
          error && 'border-red-500/60',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
