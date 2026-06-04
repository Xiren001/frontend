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
    ok:      'border-accent-border/40 bg-accent-muted/50',
    warn:    'border-warn/20 bg-warn-muted',
    bad:     'border-danger/20 bg-danger-muted',
    neutral: 'border-border-subtle bg-surface',
  }[status]

  const valueColor = {
    ok:      'text-accent-bright',
    warn:    'text-warn',
    bad:     'text-danger',
    neutral: 'text-foreground',
  }[status]

  return (
    <div className={cn('rounded-lg border p-5', statusStyles)}>
      <p className="text-xs text-text-muted font-medium uppercase tracking-widest">{label}</p>
      <p className={cn('mt-2 text-2xl font-medium font-mono tabular-nums', valueColor)}>
        {value ?? '—'}{value !== null && value !== '—' ? unit : ''}
      </p>
      {target !== undefined && (
        <p className="mt-1.5 text-xs text-text-muted font-mono">target: {target}{unit}</p>
      )}
    </div>
  )
}
