import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'accent' | 'warn' | 'danger' | 'muted'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-secondary border border-border-subtle',
  accent: 'bg-accent-muted text-accent border border-accent-border',
  warn: 'bg-warn-muted text-warn border border-amber-200',
  danger: 'bg-danger-muted text-danger border border-red-200',
  muted: 'bg-surface text-text-muted border border-border-subtle',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
