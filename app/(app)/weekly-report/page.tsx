'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { currentMonth, cn } from '@/lib/utils'
import type { WeeklyReport, WeekData, ReportTargets, ProofQueue } from '@/lib/types'

const TRACKER_LANGS = new Set(['ES', 'DE'])

function computeQueueStats(products: { language: string | null; done: boolean }[]): ProofQueue {
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
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'

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

// ─── Stopped ─────────────────────────────────────────────────────────────────

function StoppedCard({ week }: { week: WeekData }) {
  return (
    <Card className="h-full">
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Stopped</p>
        <p className="text-4xl font-bold font-mono text-foreground">{week.stoppedCount}</p>
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
      {/* §3 + §4 + §5 + stopped */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InTestingCard week={week} />
        <InExpandingCard week={week} />
        <WinningCard week={week} />
        <StoppedCard week={week} />
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

// ─── Excel Export ─────────────────────────────────────────────────────────────

function fmtExport(val: number | null | undefined, target: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  const d = `${val}d`
  if (target === null || target === undefined) return d
  return val <= target ? `${d} ✓` : `${d} ✗`
}

function buildSummarySheet(report: WeeklyReport, queue: ProofQueue | null, month: string): unknown[][] {
  const t = report.settings
  const ws = [1, 2, 3, 4].map(n => report.weeks.find(w => w.week === n) ?? null)

  function row(
    metric: string,
    valFn: (w: WeekData | null) => string | number,
    target = '—',
    note = '',
  ): unknown[] {
    return [metric, valFn(ws[0]), valFn(ws[1]), valFn(ws[2]), valFn(ws[3]), target, note]
  }

  const v = (fn: (w: WeekData) => number | null | undefined, tgt: number | null | undefined) =>
    (w: WeekData | null) => w ? fmtExport(fn(w), tgt) : '—'

  return [
    [`WEEKLY REPORT — ${month.toUpperCase()}`, '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['METRIC', 'WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4', 'TARGET', 'NOTES'],
    ['', '', '', '', '', '', ''],

    ['── NEW PRODUCTS BUILT ──', '', '', '', '', '', ''],
    row('Count', w => w?.newBuilds.count ?? '—'),
    row('Phase 1 Avg', v(w => w.newBuilds.avgPhase1Days, t?.build_target_days), t ? `${t.build_target_days}d` : '—', 'Phase 1 start → phase 1 end'),
    row('Proof Avg', v(w => w.newBuilds.avgProofDays, t?.proof_target_days), t ? `${t.proof_target_days}d` : '—', 'Days spent in proofreading'),
    row('Testing Avg', v(w => w.newBuilds.avgTestDays, t?.test_target_days), t ? `${t.test_target_days}d` : '—', 'Days in testing before outcome'),
    row('Total Avg', v(w => w.newBuilds.avgTotalDays, t?.total_target_days), t ? `${t.total_target_days}d` : '—', 'Phase 1 start → outcome decision'),
    ['  Breakdown', '', '', '', '', '', ''],
    row('  Proofreader Turnaround', v(w => w.newBuilds.avgProofreadTurnaround, t?.proofread_turnaround_target_days), t ? `${t.proofread_turnaround_target_days}d` : '—', 'Submit to proofreader → returned'),
    row('  Web Revision', v(w => w.newBuilds.avgWebRevisionDays, t?.web_revision_target_days), t ? `${t.web_revision_target_days}d` : '—', 'Days for web revisions post-proof'),
    row('  Ads Revision', v(w => w.newBuilds.avgAdsRevisionDays, t?.ads_revision_target_days), t ? `${t.ads_revision_target_days}d` : '—', 'Days for ads revisions post-proof'),
    ['', '', '', '', '', '', ''],

    ['── EXPANDING PRODUCTS ──', '', '', '', '', '', ''],
    row('Count', w => w?.expandingProducts.count ?? '—'),
    row('Proof Avg', v(w => w.expandingProducts.avgProofDays, t?.proof_target_days), t ? `${t.proof_target_days}d` : '—', 'Days in proofreading'),
    ['  Breakdown', '', '', '', '', '', ''],
    row('  Proofreader Turnaround', v(w => w.expandingProducts.avgProofreadTurnaround, t?.proofread_turnaround_target_days), t ? `${t.proofread_turnaround_target_days}d` : '—'),
    row('  Web Revision', v(w => w.expandingProducts.avgWebRevisionDays, t?.web_revision_target_days), t ? `${t.web_revision_target_days}d` : '—'),
    row('  Ads Revision', v(w => w.expandingProducts.avgAdsRevisionDays, t?.ads_revision_target_days), t ? `${t.ads_revision_target_days}d` : '—'),
    ['', '', '', '', '', '', ''],

    ['── STATUS COUNTS ──', '', '', '', '', '', ''],
    row('In Testing', w => w?.inTesting.count ?? '—', '', 'Products in testing at end of week'),
    row('In Expanding — Wave 1', w => w?.inExpanding.wave1Count ?? '—', '', 'Wave 1 products in expanding phase'),
    row('In Expanding — Wave 2+', w => w?.inExpanding.wave2plusCount ?? '—', '', 'Wave 2 and beyond in expanding'),
    row('Winning', w => w ? `${w.winning.count} / ${w.winning.totalTested}` : '—', '', 'Won / total tested'),
    row('Win Rate', w => w?.winning.pct ?? '—', '≥ 50%', '% of tested products that won'),
    row('Stopped', w => w?.stoppedCount ?? '—', '', 'Products stopped this week'),
    ['', '', '', '', '', '', ''],

    ['── TRANSLATION TIMES ──', '', '', '', '', '', ''],
    row('EN Completion', v(w => w.translation.en.avgDays, t?.en_completion_target_days), t ? `${t.en_completion_target_days}d` : '—', 'Days for English content completion'),
    row('ES + DE Translation', v(w => w.translation.esDe.avgDays, t?.es_de_translation_target_days), t ? `${t.es_de_translation_target_days}d` : '—', 'Days for Spanish + German translation'),
    row('Total Translation', v(w => w.translation.total.avgDays, t?.total_translation_target_days), t ? `${t.total_translation_target_days}d` : '—', 'Full translation pipeline duration'),
    ['', '', '', '', '', '', ''],

    ['── PROOFREADING QUEUE (Current) ──', '', '', '', '', '', ''],
    ['Wave 1 Pending', queue?.wave1 ?? 0, '', '', '', '', 'ES / DE products awaiting proofread'],
    ['Wave 2+ Pending', queue?.wave2plus ?? 0, '', '', '', '', 'Other languages awaiting proofread'],
    ['Done', queue?.done ?? 0, '', '', '', '', 'Products with proofreading complete'],
    ['', '', '', '', '', '', ''],

    ['── PAYMENT STATUS (Month Total) ──', '', '', '', '', '', ''],
    ['Paid', report.paymentStatus.paid, '', '', '', '', 'Products with payment processed'],
    ['Unpaid', report.paymentStatus.unpaid, '', '', '', '', 'Products awaiting payment'],
    ['', '', '', '', '', '', ''],
    ['✓ = at or below target   ✗ = exceeds target   — = no data', '', '', '', '', '', ''],
  ]
}

function buildWeekSheet(weekData: WeekData | null, targets: ReportTargets | null, weekNum: number): unknown[][] {
  if (!weekData) return [[`WEEK ${weekNum}`, 'No data for this week.', '', '', '']]

  const t = targets
  const data: unknown[][] = []

  function mRow(label: string, val: number | null | undefined, tgt: number | null | undefined, desc: string): unknown[] {
    const status = val != null && tgt != null ? (val <= tgt ? '✓ On target' : '✗ Over target') : '—'
    return [label, val != null ? `${val}d` : '—', tgt != null ? `${tgt}d` : '—', status, desc]
  }

  data.push([`WEEK ${weekNum} — DETAIL REPORT`, '', '', '', ''])
  data.push(['', '', '', '', ''])

  data.push([`NEW PRODUCTS BUILT: ${weekData.newBuilds.count}`, '', '', '', ''])
  data.push(['METRIC', 'AVG', 'TARGET', 'STATUS', 'DESCRIPTION'])
  data.push(mRow('Phase 1', weekData.newBuilds.avgPhase1Days, t?.build_target_days, 'Days from phase 1 start to end of building'))
  data.push(mRow('Proof', weekData.newBuilds.avgProofDays, t?.proof_target_days, 'Days the product spent in proofreading'))
  data.push(mRow('Testing', weekData.newBuilds.avgTestDays, t?.test_target_days, 'Days in testing before an outcome was decided'))
  data.push(mRow('Total', weekData.newBuilds.avgTotalDays, t?.total_target_days, 'Phase 1 start to final outcome decision'))
  data.push(['Detailed Breakdown', '', '', '', ''])
  data.push(mRow('Proofreader Turnaround', weekData.newBuilds.avgProofreadTurnaround, t?.proofread_turnaround_target_days, 'Time from submitting to proofreader to receiving it back'))
  data.push(mRow('Web Revision', weekData.newBuilds.avgWebRevisionDays, t?.web_revision_target_days, 'Days for website / web content revisions'))
  data.push(mRow('Ads Revision', weekData.newBuilds.avgAdsRevisionDays, t?.ads_revision_target_days, 'Days for ads revisions after proofread'))
  if (weekData.newBuilds.products.length > 0) {
    data.push(['', '', '', '', ''])
    data.push(['Products Built This Week:', '', '', '', ''])
    data.push(['#', 'Product Name', 'Language', '', ''])
    weekData.newBuilds.products.forEach((p, i) => data.push([i + 1, p.product_name, p.language ?? 'EN', '', '']))
  }
  data.push(['', '', '', '', ''])

  data.push([`EXPANDING PRODUCTS: ${weekData.expandingProducts.count}`, '', '', '', ''])
  data.push(['METRIC', 'AVG', 'TARGET', 'STATUS', 'DESCRIPTION'])
  data.push(mRow('Proof', weekData.expandingProducts.avgProofDays, t?.proof_target_days, 'Days in proofreading for expanding products'))
  data.push(['Detailed Breakdown', '', '', '', ''])
  data.push(mRow('Proofreader Turnaround', weekData.expandingProducts.avgProofreadTurnaround, t?.proofread_turnaround_target_days, 'Time from submit to proofreader to received back'))
  data.push(mRow('Web Revision', weekData.expandingProducts.avgWebRevisionDays, t?.web_revision_target_days, 'Days for web revisions'))
  data.push(mRow('Ads Revision', weekData.expandingProducts.avgAdsRevisionDays, t?.ads_revision_target_days, 'Days for ads revisions'))
  if (weekData.expandingProducts.products.length > 0) {
    data.push(['', '', '', '', ''])
    data.push(['Products Expanding This Week:', '', '', '', ''])
    data.push(['#', 'Product Name', 'Language', '', ''])
    weekData.expandingProducts.products.forEach((p, i) => data.push([i + 1, p.product_name, p.language ?? 'EN', '', '']))
  }
  data.push(['', '', '', '', ''])

  data.push(['STATUS COUNTS', '', '', '', ''])
  data.push(['Category', 'Count', '', 'Notes', ''])
  data.push(['In Testing', weekData.inTesting.count, '', 'Products currently in testing at end of week', ''])
  data.push(['In Expanding — Wave 1', weekData.inExpanding.wave1Count, '', 'Wave 1 products in expanding phase', ''])
  data.push(['In Expanding — Wave 2+', weekData.inExpanding.wave2plusCount, '', 'Wave 2 and beyond in expanding', ''])
  data.push(['Winning', `${weekData.winning.count} / ${weekData.winning.totalTested}`, '', `${weekData.winning.pct} win rate`, ''])
  data.push(['Stopped', weekData.stoppedCount, '', 'Products whose testing was stopped', ''])
  if (weekData.inTesting.products.length > 0) {
    data.push(['', '', '', '', ''])
    data.push(['Products in Testing:', '', '', '', ''])
    data.push(['#', 'Product Name', 'Language', '', ''])
    weekData.inTesting.products.forEach((p, i) => data.push([i + 1, p.product_name, p.language ?? 'EN', '', '']))
  }
  if (weekData.inExpanding.wave1Products.length > 0 || weekData.inExpanding.wave2plusProducts.length > 0) {
    data.push(['', '', '', '', ''])
    data.push(['Products in Expanding:', '', '', '', ''])
    data.push(['#', 'Product Name', 'Language', 'Wave', ''])
    weekData.inExpanding.wave1Products.forEach((p, i) =>
      data.push([i + 1, p.product_name, p.language ?? 'EN', 'Wave 1', '']))
    weekData.inExpanding.wave2plusProducts.forEach((p, i) =>
      data.push([weekData.inExpanding.wave1Products.length + i + 1, p.product_name, p.language ?? 'EN', 'Wave 2+', '']))
  }
  data.push(['', '', '', '', ''])

  data.push(['TRANSLATION TIMES', '', '', '', ''])
  data.push(['METRIC', 'AVG', 'TARGET', 'STATUS', 'DESCRIPTION'])
  data.push(mRow('EN Completion', weekData.translation.en.avgDays, t?.en_completion_target_days, 'Days for English content to be fully complete'))
  data.push(mRow('ES + DE Translation', weekData.translation.esDe.avgDays, t?.es_de_translation_target_days, 'Days for Spanish + German translation'))
  data.push(mRow('Total Translation', weekData.translation.total.avgDays, t?.total_translation_target_days, 'Full translation pipeline from start to finish'))

  return data
}

function buildGuideSheet(targets: ReportTargets | null): unknown[][] {
  const t = targets
  const tgt = (key: keyof ReportTargets) => t ? `${t[key]}d` : 'see settings'

  return [
    ['METRIC GUIDE — Weekly Report', '', ''],
    ['This sheet explains every metric shown in the Summary and Week detail sheets.', '', ''],
    ['', '', ''],
    ['METRIC', 'WHAT IT MEASURES', 'TARGET & HOW TO INTERPRET'],
    ['', '', ''],
    ['── NEW PRODUCTS BUILT ──', '', ''],
    ['Count', 'Number of new products that completed the full build pipeline this week.', 'Higher = more output. Compare week-over-week for velocity trends.'],
    ['Phase 1 Avg', 'Average days from phase 1 start to phase 1 completion (the building phase).', `Target: ${tgt('build_target_days')}. Lower is better. Measures build speed.`],
    ['Proof Avg', 'Average days a product spent in the proofreading phase (submission to end).', `Target: ${tgt('proof_target_days')}. Lower is better. Includes turnaround + revision time.`],
    ['Testing Avg', 'Average days from a product entering testing to its outcome being decided.', `Target: ${tgt('test_target_days')}. Lower is better. Reflects testing cycle speed.`],
    ['Total Avg', 'Average total days from phase 1 start to final outcome decision (end-to-end).', `Target: ${tgt('total_target_days')}. Lower is better. The key overall efficiency metric.`],
    ['Proofreader Turnaround', 'Average days from submitting a product to the proofreader to receiving it back.', `Target: ${tgt('proofread_turnaround_target_days')}. Lower is better. Measures proofreader responsiveness.`],
    ['Web Revision', 'Average days for website / web content revisions after proofreading.', `Target: ${tgt('web_revision_target_days')}. Lower is better. Measures web team revision speed.`],
    ['Ads Revision', 'Average days for ads revisions after the proofreading phase.', `Target: ${tgt('ads_revision_target_days')}. Lower is better. Measures ads team revision speed.`],
    ['', '', ''],
    ['── EXPANDING PRODUCTS ──', '', ''],
    ['Count', 'Number of products that went through the expanding phase this week.', 'Higher = more products moving into the expansion pipeline.'],
    ['Proof Avg', 'Average days expanding products spent in proofreading.', `Target: ${tgt('proof_target_days')}. Same target as new builds.`],
    ['Proofreader Turnaround', 'Same metric as above but scoped to expanding products specifically.', `Target: ${tgt('proofread_turnaround_target_days')}.`],
    ['Web Revision', 'Days for website revisions on expanding products.', `Target: ${tgt('web_revision_target_days')}.`],
    ['Ads Revision', 'Days for ads revisions on expanding products.', `Target: ${tgt('ads_revision_target_days')}.`],
    ['', '', ''],
    ['── STATUS COUNTS ──', '', ''],
    ['In Testing', 'Number of products currently in the testing phase at the end of the week.', 'Snapshot of testing pipeline depth. No single target — context-dependent.'],
    ['In Expanding — Wave 1', 'Products currently in expanding, classified as Wave 1 (ES / DE language products).', 'Wave 1 = Spanish and German language products.'],
    ['In Expanding — Wave 2+', 'Products currently in expanding beyond Wave 1 (all other languages).', 'Wave 2+ = all non-ES/DE language products.'],
    ['Winning', 'Products that completed testing with a positive (winning) outcome.', 'Expressed as count won / total tested. More winners is better.'],
    ['Win Rate', 'Percentage of tested products that resulted in a win.', 'Target: ≥ 50%. Low win rate may indicate poor product selection or test quality.'],
    ['Stopped', 'Products whose testing was stopped (did not achieve a winning outcome).', 'Stopping quickly is healthy — it frees up testing budget for better products.'],
    ['', '', ''],
    ['── TRANSLATION TIMES ──', '', ''],
    ['EN Completion', 'Average days for English content to be fully completed.', `Target: ${tgt('en_completion_target_days')}. Lower is better.`],
    ['ES + DE Translation', 'Average days for Spanish and German translation after English is done.', `Target: ${tgt('es_de_translation_target_days')}. Lower is better.`],
    ['Total Translation', 'Average days for the full translation pipeline from start to all languages done.', `Target: ${tgt('total_translation_target_days')}. Lower is better. Key localization efficiency metric.`],
    ['', '', ''],
    ['── PROOFREADING QUEUE ──', '', ''],
    ['Wave 1 Pending', 'ES / DE products currently waiting to be proofread.', 'Lower is better. A high number means the proofreader is the bottleneck.'],
    ['Wave 2+ Pending', 'Non-ES/DE products currently waiting to be proofread.', 'Lower is better.'],
    ['Done', 'Products that have completed proofreading (snapshot for current month).', 'Tracks proofreading throughput for the month.'],
    ['', '', ''],
    ['── PAYMENT STATUS ──', '', ''],
    ['Paid', 'Total products in this month with payment already processed.', 'Should grow through the month as products are completed and invoiced.'],
    ['Unpaid', 'Total products in this month still awaiting payment.', 'Should approach 0 as the month closes.'],
  ]
}

function handleExport(report: WeeklyReport, queue: ProofQueue | null, month: string): void {
  const wb = XLSX.utils.book_new()

  const summaryWs = XLSX.utils.aoa_to_sheet(buildSummarySheet(report, queue, month))
  summaryWs['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 44 },
  ]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  for (let w = 1; w <= 4; w++) {
    const weekData = report.weeks.find(wd => wd.week === w) ?? null
    const weekWs = XLSX.utils.aoa_to_sheet(buildWeekSheet(weekData, report.settings, w))
    weekWs['!cols'] = [
      { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 52 },
    ]
    XLSX.utils.book_append_sheet(wb, weekWs, `Week ${w}`)
  }

  const guideWs = XLSX.utils.aoa_to_sheet(buildGuideSheet(report.settings))
  guideWs['!cols'] = [{ wch: 28 }, { wch: 64 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, guideWs, 'Metric Guide')

  XLSX.writeFile(wb, `weekly-report-${month}.xlsx`)
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
    const products = await api.get<{ language: string | null; done: boolean }[]>(`/api/builds/proofread-queue?month=${month}`)
    setQueue(computeQueueStats(products))
  }

  useRealtimeRefresh(['builds', 'proof_products'], load)
  useRealtimeRefresh(['builds', 'proof_products'], loadQueue)
  useEffect(() => { load() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadQueue() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = report?.settings ?? null
  const weeks = report?.weeks ?? []
  const activeWeekData = weeks.find(w => w.week === activeWeek) ?? null

  return (
    <div>
      <PageHeader
        title="Weekly Report"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!report}
              onClick={() => { if (report) handleExport(report, queue, month) }}
            >
              Export .xlsx
            </Button>
            <Input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-auto"
              mono
            />
          </div>
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
