import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-background font-medium hover:bg-accent-bright active:opacity-90 disabled:opacity-40',
  secondary:
    'bg-surface-elevated text-foreground border border-border hover:bg-surface-hover active:opacity-90 disabled:opacity-40',
  ghost:
    'text-text-secondary hover:text-foreground hover:bg-surface-hover active:opacity-90 disabled:opacity-40',
  danger:
    'bg-danger-muted text-danger border border-danger/20 hover:bg-danger/20 active:opacity-90 disabled:opacity-40',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
