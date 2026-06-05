'use client'
import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string | number | null
  target?: number | string
  unit?: string
  status?: 'ok' | 'warn' | 'bad' | 'neutral'
}

export function KPICard({ label, value, target, unit = '', status = 'neutral' }: KPICardProps) {
  const statusStyles = {
    ok:      'border-accent-border bg-accent-muted/60',
    warn:    'border-amber-200 bg-warn-muted',
    bad:     'border-red-200 bg-danger-muted',
    neutral: 'border-border-subtle bg-surface-elevated',
  }[status]

  const valueColor = {
    ok:      'text-accent',
    warn:    'text-warn',
    bad:     'text-danger',
    neutral: 'text-foreground',
  }[status]

  return (
    <div className={cn('rounded-xl border p-5 shadow-sm', statusStyles)}>
      <p className="text-sm text-text-muted font-medium">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tabular-nums tracking-tight', valueColor)}>
        {value ?? '—'}{value !== null && value !== '—' ? unit : ''}
      </p>
      {target !== undefined && (
        <p className="mt-2 text-xs text-text-muted">Target: {target}{unit}</p>
      )}
    </div>
  )
}
