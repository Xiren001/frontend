'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { currentMonth } from '@/lib/utils'
import type { MonthlyReport, WeekData, ReportTargets } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Card, CardBody } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = ''): string {
  if (n === null || n === undefined) return '—'
  return `${n}${suffix}`
}

function colorClass(val: number | null | undefined, target: number | null | undefined): string {
  if (val === null || val === undefined || target === null || target === undefined) return 'text-text-muted'
  return val <= target ? 'text-green-600' : 'text-red-500'
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">{label}</p>
        <p className="text-2xl font-bold font-mono text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </CardBody>
    </Card>
  )
}

// ─── Metric avg table (New Products / Expanding Products) ────────────────────

interface MetricAvgRow {
  label: string
  avg: number | null | undefined
  targetKey: keyof ReportTargets | null
}

function MetricAvgTable({
  heading,
  rows,
  targets,
}: {
  heading: string
  rows: MetricAvgRow[]
  targets: ReportTargets
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">{heading}</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left pb-2 text-xs text-text-muted font-medium">Metric</th>
              <th className="text-right pb-2 text-xs text-text-muted font-medium">Avg</th>
              <th className="text-right pb-2 text-xs text-text-muted font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const target = r.targetKey ? (targets[r.targetKey] as number) : null
              return (
                <tr key={r.label} className="border-t border-border-subtle">
                  <td className="py-1.5 text-sm text-foreground">{r.label}</td>
                  <td className={`py-1.5 text-right text-sm font-mono font-medium ${colorClass(r.avg, target)}`}>
                    {fmt(r.avg, 'd')}
                  </td>
                  <td className="py-1.5 text-right text-sm font-mono text-text-muted">
                    {target !== null && target !== undefined ? `${target}d` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  )
}

// ─── Proof queue section ──────────────────────────────────────────────────────

function ProofQueueSection({ report }: { report: MonthlyReport }) {
  const { wave1, wave2plus, done } = report.proofQueue
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Proofreading Queue</p>
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Wave 1" value={wave1} />
        <SummaryCard label="Wave 2–7" value={wave2plus} />
        <SummaryCard label="Done" value={done} />
      </div>
    </div>
  )
}

// ─── Payment status section ───────────────────────────────────────────────────

function PaymentStatusSection({ report }: { report: MonthlyReport }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Payment Status</p>
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Paid" value={report.paymentStatus.paid} />
        <SummaryCard label="Unpaid" value={report.paymentStatus.unpaid} />
      </div>
    </div>
  )
}

// ─── Translation times section ────────────────────────────────────────────────

function TranslationSection({ report, targets }: { report: MonthlyReport; targets: ReportTargets }) {
  const { en, esDe, total } = report.translation
  const rows = [
    { label: 'EN completion', avg: en.avgDays, targetKey: 'en_completion_target_days' as keyof ReportTargets },
    { label: 'ES/DE delay after EN', avg: esDe.avgDays, targetKey: 'es_de_translation_target_days' as keyof ReportTargets },
    { label: 'Total (EN start → ES/DE done)', avg: total.avgDays, targetKey: 'total_translation_target_days' as keyof ReportTargets },
  ]
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Translation Times</p>
      <Card>
        <CardBody>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left pb-2 text-xs text-text-muted font-medium">Metric</th>
                <th className="text-right pb-2 text-xs text-text-muted font-medium">Avg</th>
                <th className="text-right pb-2 text-xs text-text-muted font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const target = targets[r.targetKey] as number
                return (
                  <tr key={r.label} className="border-t border-border-subtle">
                    <td className="py-1.5 text-sm text-foreground">{r.label}</td>
                    <td className={`py-1.5 text-right text-sm font-mono font-medium ${colorClass(r.avg, target)}`}>
                      {fmt(r.avg, 'd')}
                    </td>
                    <td className="py-1.5 text-right text-sm font-mono text-text-muted">{target}d</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)

  async function load() {
    const data = await api.get<MonthlyReport>('/api/reports/monthly?month=' + month)
    setReport(data)
  }

  useRealtimeRefresh(['builds', 'proof_products'], load)
  useEffect(() => { load() }, [month])

  const s = report?.settings ?? null

  // Monthly summary totals (derived from byWeek or top-level fields)
  const newProductsCount = report?.newBuilds?.count ?? 0
  const expandingCount = report?.expandingProducts?.count ?? 0
  const inTestingCount = report?.inTesting?.count ?? 0
  const wave1Count = report?.inExpanding?.wave1Count ?? 0
  const wave2plusCount = report?.inExpanding?.wave2plusCount ?? 0
  const winningCount = report?.winning?.count ?? 0
  const winningPct = report?.winning?.pct ?? '—'

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        description="Auto-populated monthly aggregates from the jewelry tracker."
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

      {!report ? (
        <p className="text-sm text-text-muted font-mono py-8">Loading…</p>
      ) : (
        <>
          {/* §1 — Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <SummaryCard label="New Products Built" value={newProductsCount} />
            <SummaryCard label="Expanding Products" value={expandingCount} />
            <SummaryCard label="In Testing" value={inTestingCount} />
            <SummaryCard
              label="In Expanding"
              value={wave1Count + wave2plusCount}
              sub={`W1: ${wave1Count} · W2+: ${wave2plusCount}`}
            />
            <SummaryCard
              label="Winning"
              value={winningCount}
              sub={winningPct}
            />
          </div>

          {/* §2 — Per-week summary table */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Per-Week Breakdown</p>
            <Card>
              <CardBody className="overflow-x-auto p-0">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Metric</TableHeader>
                      {[1, 2, 3, 4].map(w => (
                        <TableHeader key={w} className="text-center">W{w}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(
                      [
                        {
                          label: 'New Built',
                          get: (w: WeekData) => w.newBuilds.count,
                        },
                        {
                          label: 'Expanding',
                          get: (w: WeekData) => w.expandingProducts.count,
                        },
                        {
                          label: 'In Testing',
                          get: (w: WeekData) => w.inTesting.count,
                        },
                        {
                          label: 'In Expanding',
                          get: (w: WeekData) => w.inExpanding.wave1Count + w.inExpanding.wave2plusCount,
                        },
                        {
                          label: 'Winners',
                          get: (w: WeekData) => w.winning.count,
                        },
                      ] as { label: string; get: (w: WeekData) => number }[]
                    ).map(row => (
                      <TableRow key={row.label}>
                        <TableCell className="text-foreground font-medium">{row.label}</TableCell>
                        {report.byWeek.map(w => (
                          <TableCell key={w.week} mono className="text-center text-foreground">
                            {row.get(w)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>

          {/* §3 — Metric averages */}
          {s && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Metric Averages</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MetricAvgTable
                  heading="New Products"
                  targets={s}
                  rows={[
                    { label: 'Phase 1 (Build)', avg: report.newBuilds.avgPhase1Days, targetKey: 'build_target_days' },
                    { label: 'Proof', avg: report.newBuilds.avgProofDays, targetKey: 'proof_target_days' },
                    { label: 'Testing', avg: report.newBuilds.avgTestDays, targetKey: 'test_target_days' },
                    { label: 'Total', avg: report.newBuilds.avgTotalDays, targetKey: 'total_target_days' },
                    { label: 'Proof Turnaround', avg: report.newBuilds.avgProofreadTurnaround, targetKey: 'proofread_turnaround_target_days' },
                    { label: 'Web Revision', avg: report.newBuilds.avgWebRevisionDays, targetKey: 'web_revision_target_days' },
                    { label: 'Ads Revision', avg: report.newBuilds.avgAdsRevisionDays, targetKey: 'ads_revision_target_days' },
                  ]}
                />
                <MetricAvgTable
                  heading="Expanding Products"
                  targets={s}
                  rows={[
                    { label: 'Proof', avg: report.expandingProducts.avgProofDays, targetKey: 'proof_target_days' },
                    { label: 'Proof Turnaround', avg: report.expandingProducts.avgProofreadTurnaround, targetKey: 'proofread_turnaround_target_days' },
                    { label: 'Web Revision', avg: report.expandingProducts.avgWebRevisionDays, targetKey: 'web_revision_target_days' },
                    { label: 'Ads Revision', avg: report.expandingProducts.avgAdsRevisionDays, targetKey: 'ads_revision_target_days' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* §6 — Proofreading Queue */}
          <ProofQueueSection report={report} />

          {/* §7 — Payment Status */}
          <PaymentStatusSection report={report} />

          {/* §8 — Translation Times */}
          {s && <TranslationSection report={report} targets={s} />}
        </>
      )}
    </div>
  )
}
