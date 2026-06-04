import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'accent' | 'warn' | 'danger' | 'muted'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-elevated text-text-secondary border border-border-subtle',
  accent: 'bg-accent-muted text-accent-bright border border-accent-border',
  warn: 'bg-warn-muted text-warn border border-warn/20',
  danger: 'bg-danger-muted text-danger border border-danger/20',
  muted: 'bg-surface-elevated text-text-muted border border-border-subtle',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium font-mono',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
