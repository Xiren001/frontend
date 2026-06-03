'use client'
import { cn } from '@/lib/utils'
import type { BuildPhase } from '@/lib/types'

const PHASE_STYLES: Record<BuildPhase, string> = {
  pending:   'bg-gray-100 text-gray-500',
  building:  'bg-blue-100 text-blue-700',
  proofread: 'bg-yellow-100 text-yellow-700',
  testing:   'bg-purple-100 text-purple-700',
  expanding: 'bg-indigo-100 text-indigo-700',
  live:      'bg-green-100 text-green-700',
  killed:    'bg-red-100 text-red-500',
}

export function PhaseBadge({ phase }: { phase: BuildPhase }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PHASE_STYLES[phase])}>
      {phase}
    </span>
  )
}
