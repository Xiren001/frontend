'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { currentMonth, cn } from '@/lib/utils'
import type { WeeklyReport, WeekData, ReportTargets, ProofQueue } from '@/lib/types'

const TRACKER_LANGS = new Set(['ES', 'DE'])

function computeQueueStats(products: { language: string | null; done: boolean | null }[]): ProofQueue {
  return {
    wave1:    products.filter(p =>  TRACKER_LANGS.has((p.language || '').toUpperCase()) && !p.done).length,
    wave2plus: products.filter(p => !TRACKER_LANGS.has((p.language || '').toUpperCase()) && !p.done).length,
    done:     products.filter(p => !!p.done).length,
  }
}
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = ''): string {
  if (n === null || n === undefined) return '—'
  return `${n}${suffix}`
}

function colorClass(val: number | null | undefined, target: number | null | undefined): string {
  if (val === null || val === undefined || target === null || target === undefined)
    return 'text-text-muted'
  return val <= target ? 'text-green-600' : 'text-red-500'
}

// ─── Metric table ─────────────────────────────────────────────────────────────

interface MetricRow {
  label: string
  avg: number | null | undefined
  targetKey: keyof ReportTargets | null
}

function MetricTable({ rows, targets }: { rows: MetricRow[]; targets: ReportTargets }) {
  return (
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
              <td className={cn('py-1.5 text-right text-sm font-mono font-medium', colorClass(r.avg, target))}>
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
  )
}

// ─── Collapsible product list ─────────────────────────────────────────────────

function ProductList({ products }: { products: { product_name: string; language: string | null }[] }) {
  const [open, setOpen] = useState(false)
  if (products.length === 0) return <p className="text-xs text-text-muted italic mt-3">No products</p>
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xs text-accent font-medium hover:underline focus:outline-none"
      >
        {open ? 'Hide' : 'Show'} {products.length} product{products.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {products.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-sm text-foreground font-medium leading-snug">{p.product_name}</span>
              {p.language && <Badge variant="accent">{p.language}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface px-5 py-4 gap-1">
      <span className="text-2xl font-bold font-mono text-foreground">{value}</span>
      <span className="text-xs text-text-muted font-medium">{label}</span>
    </div>
  )
}

// ─── §1 New Products Built ────────────────────────────────────────────────────

function NewBuildsCard({ week, targets }: { week: WeekData; targets: ReportTargets }) {
  const nb = week.newBuilds
  const mainRows: MetricRow[] = [
    { label: 'Phase 1', avg: nb.avgPhase1Days, targetKey: 'build_target_days' },
    { label: 'Proof', avg: nb.avgProofDays, targetKey: 'proof_target_days' },
    { label: 'Testing', avg: nb.avgTestDays, targetKey: 'test_target_days' },
    { label: 'Total', avg: nb.avgTotalDays, targetKey: 'total_target_days' },
  ]
  const detailRows: MetricRow[] = [
    { label: 'Proofreader Turnaround', avg: nb.avgProofreadTurnaround, targetKey: 'proofread_turnaround_target_days' },
    { label: 'Web Revision', avg: nb.avgWebRevisionDays, targetKey: 'web_revision_target_days' },
    { label: 'Ads Revision', avg: nb.avgAdsRevisionDays, targetKey: 'ads_revision_target_days' },
  ]
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm font-semibold text-foreground">New Products Built</p>
          <Badge variant="accent">{nb.count}</Badge>
        </div>
        <MetricTable rows={mainRows} targets={targets} />
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mt-5 mb-2">Detailed Breakdown</p>
        <MetricTable rows={detailRows} targets={targets} />
        <ProductList products={nb.products} />
      </CardBody>
    </Card>
  )
}

// ─── §2 Expanding Products ────────────────────────────────────────────────────

function ExpandingProductsCard({ week, targets }: { week: WeekData; targets: ReportTargets }) {
  const ep = week.expandingProducts
  const mainRows: MetricRow[] = [
    { label: 'Proof', avg: ep.avgProofDays, targetKey: 'proof_target_days' },
  ]
  const detailRows: MetricRow[] = [
    { label: 'Proofreader Turnaround', avg: ep.avgProofreadTurnaround, targetKey: 'proofread_turnaround_target_days' },
    { label: 'Web Revision', avg: ep.avgWebRevisionDays, targetKey: 'web_revision_target_days' },
    { label: 'Ads Revision', avg: ep.avgAdsRevisionDays, targetKey: 'ads_revision_target_days' },
  ]
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm font-semibold text-foreground">Expanding Products</p>
          <Badge variant="accent">{ep.count}</Badge>
        </div>
        <MetricTable rows={mainRows} targets={targets} />
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mt-5 mb-2">Detailed Breakdown</p>
        <MetricTable rows={detailRows} targets={targets} />
        <ProductList products={ep.products} />
      </CardBody>
    </Card>
  )
}

// ─── §3 In Testing ────────────────────────────────────────────────────────────

function InTestingCard({ week }: { week: WeekData }) {
  const it = week.inTesting
  return (
    <Card className="h-full">
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">In Testing</p>
        <p className="text-4xl font-bold font-mono text-foreground mb-3">{it.count}</p>
        {it.products.length > 0 && (
          <ul className="space-y-1 mt-2">
            {it.products.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-xs text-foreground leading-snug">{p.product_name}</span>
                {p.language && <Badge variant="accent" className="text-[10px] px-1.5 py-0">{p.language}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

// ─── §4 In Expanding ─────────────────────────────────────────────────────────

function InExpandingCard({ week }: { week: WeekData }) {
  const ie = week.inExpanding
  return (
    <Card className="h-full">
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">In Expanding</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Wave 1</span>
            <span className="text-xl font-bold font-mono text-foreground">{ie.wave1Count}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Wave 2+</span>
            <span className="text-xl font-bold font-mono text-foreground">{ie.wave2plusCount}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── §5 Winning Products ──────────────────────────────────────────────────────

function WinningCard({ week }: { week: WeekData }) {
  const w = week.winning
  const pctNum = parseFloat(w.pct)
  const pctColor = isNaN(pctNum) ? 'text-text-muted' : pctNum >= 50 ? 'text-green-600' : 'text-red-500'
  return (
    <Card className="h-full">
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Winning Products</p>
        <p className="text-4xl font-bold font-mono text-foreground leading-tight">
          {w.count}
          <span className="text-base font-normal text-text-muted font-sans"> / {w.totalTested}</span>
        </p>
        <p className={cn('text-2xl font-bold font-mono mt-1', pctColor)}>{w.pct}</p>
      </CardBody>
    </Card>
  )
}

// ─── Week panel ───────────────────────────────────────────────────────────────

function WeekPanel({ week, targets }: { week: WeekData; targets: ReportTargets }) {
  return (
    <div className="space-y-4">
      {/* §1 + §2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NewBuildsCard week={week} targets={targets} />
        <ExpandingProductsCard week={week} targets={targets} />
      </div>
      {/* §3 + §4 + §5 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InTestingCard week={week} />
        <InExpandingCard week={week} />
        <WinningCard week={week} />
      </div>
      {/* §8 Translation */}
      <TranslationCard week={week} targets={targets} />
    </div>
  )
}

// ─── §6 Proof Queue ───────────────────────────────────────────────────────────

function ProofQueueCard({ queue }: { queue: ProofQueue | null }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Proofreading Queue</p>
        <div className="grid grid-cols-3 gap-3">
          <StatPill label="Wave 1" value={queue?.wave1 ?? 0} />
          <StatPill label="Wave 2–7" value={queue?.wave2plus ?? 0} />
          <StatPill label="Done" value={queue?.done ?? 0} />
        </div>
      </CardBody>
    </Card>
  )
}

// ─── §7 Payment Status ────────────────────────────────────────────────────────

function PaymentStatusCard({ report }: { report: WeeklyReport }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Payment Status</p>
        <div className="grid grid-cols-2 gap-3">
          <StatPill label="Paid" value={report.paymentStatus.paid} />
          <StatPill label="Unpaid" value={report.paymentStatus.unpaid} />
        </div>
      </CardBody>
    </Card>
  )
}

// ─── §8 Translation Times ─────────────────────────────────────────────────────

function TranslationCard({ week, targets }: { week: WeekData; targets: ReportTargets }) {
  const { en, esDe, total } = week.translation
  const rows: MetricRow[] = [
    { label: 'EN', avg: en.avgDays, targetKey: 'en_completion_target_days' },
    { label: 'ES+DE', avg: esDe.avgDays, targetKey: 'es_de_translation_target_days' },
    { label: 'Total', avg: total.avgDays, targetKey: 'total_translation_target_days' },
  ]
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Translation Times</p>
        <MetricTable rows={rows} targets={targets} />
      </CardBody>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeeklyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [queue, setQueue] = useState<ProofQueue | null>(null)
  const [activeWeek, setActiveWeek] = useState(1)

  async function load() {
    const data = await api.get<WeeklyReport>('/api/reports/weekly?month=' + month)
    setReport(data)
  }

  async function loadQueue() {
    const products = await api.get<{ language: string | null; done: boolean | null }[]>('/api/proof-corrections/products')
    setQueue(computeQueueStats(products))
  }

  useRealtimeRefresh(['builds', 'proof_products'], load)
  useRealtimeRefresh('proof_products', loadQueue)
  useEffect(() => { load() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadQueue() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const s = report?.settings ?? null
  const weeks = report?.weeks ?? []
  const activeWeekData = weeks.find(w => w.week === activeWeek) ?? null

  return (
    <div>
      <PageHeader
        title="Weekly Report"
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
          {/* Week tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-border-subtle">
            {[1, 2, 3, 4].map(w => (
              <button
                key={w}
                onClick={() => setActiveWeek(w)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t transition-colors focus:outline-none',
                  activeWeek === w
                    ? 'text-accent border-b-2 border-accent -mb-px bg-transparent'
                    : 'text-text-muted hover:text-foreground hover:bg-surface',
                )}
              >
                Week {w}
              </button>
            ))}
          </div>

          {/* Active week panel */}
          {activeWeekData && s ? (
            <div className="mb-8">
              <WeekPanel week={activeWeekData} targets={s} />
            </div>
          ) : (
            <p className="text-sm text-text-muted italic mb-8">No data for Week {activeWeek}.</p>
          )}

          {/* Global sections §6–§7 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProofQueueCard queue={queue} />
            <PaymentStatusCard report={report} />
          </div>
        </>
      )}
    </div>
  )
}
