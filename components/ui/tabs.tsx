'use client'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string | number
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  active: string | number
  onChange: (id: string | number) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-border-subtle overflow-x-auto overflow-y-hidden', className)}>
      {tabs.map(tab => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative shrink-0 px-4 py-3 text-sm transition-colors -mb-px',
              isActive
                ? 'text-accent font-medium'
                : 'text-text-muted hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-md font-medium',
                  isActive
                    ? 'bg-accent-muted text-accent border border-accent-border'
                    : 'bg-surface text-text-muted border border-border-subtle',
                )}>
                  {tab.count}
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
