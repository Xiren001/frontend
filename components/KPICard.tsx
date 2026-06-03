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
  const statusColor = {
    ok:      'border-green-200 bg-green-50',
    warn:    'border-yellow-200 bg-yellow-50',
    bad:     'border-red-200 bg-red-50',
    neutral: 'border-gray-200 bg-white',
  }[status]

  const valueColor = {
    ok:      'text-green-700',
    warn:    'text-yellow-700',
    bad:     'text-red-600',
    neutral: 'text-gray-900',
  }[status]

  return (
    <div className={cn('rounded-lg border p-4', statusColor)}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold', valueColor)}>
        {value ?? '—'}{value !== null && value !== '—' ? unit : ''}
      </p>
      {target !== undefined && (
        <p className="mt-1 text-xs text-gray-400">Target: {target}{unit}</p>
      )}
    </div>
  )
}
