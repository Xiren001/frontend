'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { KPICard } from '@/components/KPICard'
import type { KPI } from '@/lib/types'
import { currentMonth } from '@/lib/utils'

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">KPI Dashboard</h1>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {!kpi ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Cycle Times (avg days)</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPICard label="Build" value={kpi.buildCycleAvg} target={kpi.targets.build_target_days} unit="d"
                status={kpiStatus(kpi.buildCycleAvg, kpi.targets.build_target_days)} />
              <KPICard label="Proofread" value={kpi.proofCycleAvg} target={kpi.targets.proof_target_days} unit="d"
                status={kpiStatus(kpi.proofCycleAvg, kpi.targets.proof_target_days)} />
              <KPICard label="Testing" value={kpi.testCycleAvg} target={kpi.targets.test_target_days} unit="d"
                status={kpiStatus(kpi.testCycleAvg, kpi.targets.test_target_days)} />
              <KPICard label="Expanding" value={kpi.expandCycleAvg} target={kpi.targets.expand_target_days} unit="d"
                status={kpiStatus(kpi.expandCycleAvg, kpi.targets.expand_target_days)} />
              <KPICard label="Total Pipeline" value={kpi.totalCycleAvg} target={kpi.targets.total_target_days} unit="d"
                status={kpiStatus(kpi.totalCycleAvg, kpi.targets.total_target_days)} />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Quality</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Proofread Queue" value={kpi.proofreadQueueDepth} status={kpi.proofreadQueueDepth === 0 ? 'ok' : 'neutral'} />
              <KPICard label="Flagged Red" value={kpi.proofreadFlagged} status={kpi.proofreadFlagged === 0 ? 'ok' : 'bad'} />
              <KPICard label="Mistakes This Month" value={kpi.mistakesCount} status={kpi.mistakesCount === 0 ? 'ok' : kpi.mistakesCount < 3 ? 'warn' : 'bad'} />
              <KPICard label="Translation Flags" value={kpi.translationFlags} status={kpi.translationFlags === 0 ? 'ok' : 'bad'} />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Pipeline Now</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Building" value={kpi.phaseBreakdown.building} />
              <KPICard label="Proofread" value={kpi.phaseBreakdown.proofread} />
              <KPICard label="Testing" value={kpi.phaseBreakdown.testing} />
              <KPICard label="Expanding" value={kpi.phaseBreakdown.expanding} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
