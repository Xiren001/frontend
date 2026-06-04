'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { KPICard } from '@/components/KPICard'
import type { KPI } from '@/lib/types'
import { currentMonth } from '@/lib/utils'
import { PageHeader, SectionHeading } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [month, setMonth] = useState(currentMonth())

  useEffect(() => {
    api.get<KPI>(`/api/kpi?month=${month}`).then(setKpi).catch(console.error)
  }, [month])

  function kpiStatus(actual: number | null, target: number, lowerIsBetter = true): 'ok' | 'warn' | 'bad' | 'neutral' {
    if (actual === null) return 'neutral'
    if (lowerIsBetter) {
      if (actual <= target) return 'ok'
      if (actual <= target * 1.25) return 'warn'
      return 'bad'
    }
    return actual >= target ? 'ok' : 'warn'
  }

  return (
    <div>
      <PageHeader
        title="KPI Dashboard"
        description="Cycle times, quality metrics, and pipeline status at a glance."
        actions={
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-auto"
            mono
          />
        }
      />

      {!kpi ? (
        <p className="text-sm text-text-muted font-mono">Loading…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeading>Cycle Times (avg days)</SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Build" value={kpi.buildCycleAvg} target={kpi.targets.build_target_days} unit="d"
                status={kpiStatus(kpi.buildCycleAvg, kpi.targets.build_target_days)} />
              <KPICard label="Proofread" value={kpi.proofCycleAvg} target={kpi.targets.proof_target_days} unit="d"
                status={kpiStatus(kpi.proofCycleAvg, kpi.targets.proof_target_days)} />
              <KPICard label="Testing" value={kpi.testCycleAvg} target={kpi.targets.test_target_days} unit="d"
                status={kpiStatus(kpi.testCycleAvg, kpi.targets.test_target_days)} />
              <KPICard label="Total Pipeline" value={kpi.totalCycleAvg} target={kpi.targets.total_target_days} unit="d"
                status={kpiStatus(kpi.totalCycleAvg, kpi.targets.total_target_days)} />
            </div>
          </section>

          <section>
            <SectionHeading>Quality</SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Proofread Queue" value={kpi.proofreadQueueDepth} status={kpi.proofreadQueueDepth === 0 ? 'ok' : 'neutral'} />
              <KPICard label="Flagged Red" value={kpi.proofreadFlagged} status={kpi.proofreadFlagged === 0 ? 'ok' : 'bad'} />
              <KPICard label="Mistakes This Month" value={kpi.mistakesCount} status={kpi.mistakesCount === 0 ? 'ok' : kpi.mistakesCount < 3 ? 'warn' : 'bad'} />
              <KPICard label="Translation Flags" value={kpi.translationFlags} status={kpi.translationFlags === 0 ? 'ok' : 'bad'} />
            </div>
          </section>

          <section>
            <SectionHeading>Pipeline Now</SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Building" value={kpi.phaseBreakdown.building} />
              <KPICard label="Proofread" value={kpi.phaseBreakdown.proofread} />
              <KPICard label="Testing" value={kpi.phaseBreakdown.testing} />
              <KPICard label="Decided" value={kpi.phaseBreakdown.decided} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
