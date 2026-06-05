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
    'bg-accent text-white font-medium shadow-sm hover:bg-accent-bright active:opacity-95 disabled:opacity-40',
  secondary:
    'bg-surface-elevated text-foreground border border-border shadow-sm hover:bg-surface-hover active:opacity-95 disabled:opacity-40',
  ghost:
    'text-text-secondary hover:text-foreground hover:bg-surface-hover active:opacity-95 disabled:opacity-40',
  danger:
    'bg-danger-muted text-danger border border-danger/15 hover:bg-red-100 active:opacity-95 disabled:opacity-40',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
