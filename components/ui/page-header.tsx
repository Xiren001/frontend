import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-6 mb-8', className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-text-muted max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-xs font-medium uppercase tracking-widest text-text-muted mb-4', className)}>
      {children}
    </h2>
  )
}
