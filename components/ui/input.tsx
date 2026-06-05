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
        'w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent-border',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface',
        mono && 'font-mono text-xs',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
