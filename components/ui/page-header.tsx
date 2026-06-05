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
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10', className)}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-text-muted max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-sm font-semibold text-foreground mb-4', className)}>
      {children}
    </h2>
  )
}
