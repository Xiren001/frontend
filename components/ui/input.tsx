import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted',
        'focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent-border',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        mono && 'font-mono text-xs',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
