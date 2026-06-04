'use client'
import { Badge } from '@/components/ui/badge'
import type { BuildPhase } from '@/lib/types'

const PHASE_VARIANT: Record<BuildPhase, 'muted' | 'default' | 'accent' | 'warn' | 'danger'> = {
  pending:  'muted',
  building: 'default',
  proofread:'warn',
  testing:  'default',
  decided:  'accent',
}

export function PhaseBadge({ phase }: { phase: BuildPhase }) {
  return (
    <Badge variant={PHASE_VARIANT[phase]}>
      {phase}
    </Badge>
  )
}
