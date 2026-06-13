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

// ─── HTML Export ──────────────────────────────────────────────────────────────

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function htmlVal(val: number | null | undefined, tgt: number | null | undefined): string {
  if (val == null) return '<span class="muted">—</span>'
  if (tgt == null) return `<span class="mono">${val}d</span>`
  const cls = val <= tgt ? 'green' : 'red'
  return `<span class="mono ${cls}">${val}d</span>`
}

function htmlStatus(val: number | null | undefined, tgt: number | null | undefined): string {
  if (val == null || tgt == null) return '<span class="muted">—</span>'
  return val <= tgt
    ? '<span class="green status-pill">On target</span>'
    : '<span class="red status-pill">Over target</span>'
}

function htmlProducts(products: { product_name: string; language: string | null }[]): string {
  if (products.length === 0) return '<p class="empty">No products this week.</p>'
  return `<ul class="product-list">${products.map(p =>
    `<li><span class="product-name">${p.product_name}</span>${p.language ? ` <span class="lang-badge">${p.language}</span>` : ''}</li>`
  ).join('')}</ul>`
}

function htmlMetricRow(
  label: string,
  val: number | null | undefined,
  tgt: number | null | undefined,
  desc: string,
  sub = false,
): string {
  return `<tr${sub ? ' class="sub"' : ''}>
    <td class="metric-label">${label}</td>
    <td>${htmlVal(val, tgt)}</td>
    <td class="mono muted">${tgt != null ? `${tgt}d` : '—'}</td>
    <td>${htmlStatus(val, tgt)}</td>
    <td class="desc">${desc}</td>
  </tr>`
}

function htmlWeekSection(wd: WeekData, t: ReportTargets | null): string {
  const nb = wd.newBuilds
  const ep = wd.expandingProducts
  const it = wd.inTesting
  const ie = wd.inExpanding
  const win = wd.winning
  const pctNum = parseFloat(win.pct)
  const winCls = isNaN(pctNum) ? 'muted' : pctNum >= 50 ? 'green' : 'red'

  const expandingProducts = [
    ...ie.wave1Products.map(p => ({ ...p, wave: 'W1' })),
    ...ie.wave2plusProducts.map(p => ({ ...p, wave: 'W2+' })),
  ]

  return `
  <section class="week-section">
    <div class="week-title">Week ${wd.week}</div>

    <h3>New Products Built <span class="count-badge">${nb.count}</span></h3>
    <table>
      <thead><tr><th>Metric</th><th>Avg</th><th>Target</th><th>Status</th><th>What it measures</th></tr></thead>
      <tbody>
        ${htmlMetricRow('Phase 1', nb.avgPhase1Days, t?.build_target_days, 'Days from phase 1 start to end of building')}
        ${htmlMetricRow('Proof', nb.avgProofDays, t?.proof_target_days, 'Days the product spent in proofreading')}
        ${htmlMetricRow('Testing', nb.avgTestDays, t?.test_target_days, 'Days in testing before an outcome was decided')}
        ${htmlMetricRow('Total', nb.avgTotalDays, t?.total_target_days, 'Phase 1 start to final outcome decision')}
        ${htmlMetricRow('Proofreader Turnaround', nb.avgProofreadTurnaround, t?.proofread_turnaround_target_days, 'From submitting to proofreader to receiving it back', true)}
        ${htmlMetricRow('Web Revision', nb.avgWebRevisionDays, t?.web_revision_target_days, 'Days for website / web content revisions', true)}
        ${htmlMetricRow('Ads Revision', nb.avgAdsRevisionDays, t?.ads_revision_target_days, 'Days for ads revisions after proofread', true)}
      </tbody>
    </table>
    ${nb.products.length > 0 ? `<p class="list-label">Products built this week</p>${htmlProducts(nb.products)}` : ''}

    <h3>Expanding Products <span class="count-badge">${ep.count}</span></h3>
    <table>
      <thead><tr><th>Metric</th><th>Avg</th><th>Target</th><th>Status</th><th>What it measures</th></tr></thead>
      <tbody>
        ${htmlMetricRow('Proof', ep.avgProofDays, t?.proof_target_days, 'Days in proofreading for expanding products')}
        ${htmlMetricRow('Proofreader Turnaround', ep.avgProofreadTurnaround, t?.proofread_turnaround_target_days, 'From submit to received back', true)}
        ${htmlMetricRow('Web Revision', ep.avgWebRevisionDays, t?.web_revision_target_days, 'Days for web revisions', true)}
        ${htmlMetricRow('Ads Revision', ep.avgAdsRevisionDays, t?.ads_revision_target_days, 'Days for ads revisions', true)}
      </tbody>
    </table>
    ${ep.products.length > 0 ? `<p class="list-label">Products expanding this week</p>${htmlProducts(ep.products)}` : ''}

    <h3>Status</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-val">${it.count}</div><div class="stat-lbl">In Testing</div></div>
      <div class="stat-card"><div class="stat-val">${ie.wave1Count}</div><div class="stat-lbl">Expanding W1</div></div>
      <div class="stat-card"><div class="stat-val">${ie.wave2plusCount}</div><div class="stat-lbl">Expanding W2+</div></div>
      <div class="stat-card"><div class="stat-val ${winCls}">${win.pct}</div><div class="stat-lbl">Win Rate</div></div>
      <div class="stat-card"><div class="stat-val">${win.count} <span class="stat-of">/ ${win.totalTested}</span></div><div class="stat-lbl">Won / Tested</div></div>
      <div class="stat-card"><div class="stat-val">${wd.stoppedCount}</div><div class="stat-lbl">Stopped</div></div>
    </div>

    ${it.products.length > 0 ? `<p class="list-label">Products in testing</p>${htmlProducts(it.products)}` : ''}
    ${expandingProducts.length > 0 ? `<p class="list-label">Products in expanding</p><ul class="product-list">${expandingProducts.map(p =>
      `<li><span class="product-name">${p.product_name}</span>${p.language ? ` <span class="lang-badge">${p.language}</span>` : ''} <span class="wave-badge">${p.wave}</span></li>`
    ).join('')}</ul>` : ''}

    <h3>Translation Times</h3>
    <table>
      <thead><tr><th>Metric</th><th>Avg</th><th>Target</th><th>Status</th><th>What it measures</th></tr></thead>
      <tbody>
        ${htmlMetricRow('EN Completion', wd.translation.en.avgDays, t?.en_completion_target_days, 'Days for English content to be fully complete')}
        ${htmlMetricRow('ES + DE Translation', wd.translation.esDe.avgDays, t?.es_de_translation_target_days, 'Days for Spanish + German translation')}
        ${htmlMetricRow('Total Translation', wd.translation.total.avgDays, t?.total_translation_target_days, 'Full translation pipeline from start to finish')}
      </tbody>
    </table>
  </section>`
}

function htmlSummaryMetricRow(
  label: string,
  weeks: (WeekData | null)[],
  fn: (w: WeekData) => number | null | undefined,
  tgt: number | null | undefined,
  sub = false,
): string {
  const cells = weeks.map(w => `<td>${htmlVal(w ? fn(w) : undefined, tgt)}</td>`).join('')
  return `<tr${sub ? ' class="sub"' : ''}>
    <td class="metric-label">${label}</td>${cells}
    <td class="mono muted">${tgt != null ? `${tgt}d` : '—'}</td>
  </tr>`
}

function htmlSummaryCountRow(
  label: string,
  weeks: (WeekData | null)[],
  fn: (w: WeekData) => string | number,
): string {
  const cells = weeks.map(w => `<td class="mono">${w ? fn(w) : '—'}</td>`).join('')
  return `<tr><td class="metric-label">${label}</td>${cells}<td class="muted">—</td></tr>`
}

function generateHtml(report: WeeklyReport, queue: ProofQueue | null, month: string): string {
  const t = report.settings
  const weeks = [1, 2, 3, 4].map(n => report.weeks.find(w => w.week === n) ?? null)
  const weekHeaders = ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map(w => `<th>${w}</th>`).join('')

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 13.5px; line-height: 1.6; color: #111827;
      background: #f3f4f6;
    }
    .page {
      max-width: 980px; margin: 0 auto; background: #fff;
      padding: 52px 60px; min-height: 100vh;
    }

    /* ── Header ── */
    .report-header {
      display: flex; align-items: flex-end; justify-content: space-between;
      padding-bottom: 18px; border-bottom: 3px solid #111827; margin-bottom: 6px;
    }
    .report-title { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
    .report-month { font-size: 30px; font-weight: 300; color: #6b7280; margin-left: 10px; }
    .report-meta { font-size: 11.5px; color: #9ca3af; text-align: right; line-height: 1.5; }

    /* ── Section headings ── */
    h2 {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; color: #9ca3af;
      margin: 40px 0 14px; padding-bottom: 7px; border-bottom: 1px solid #e5e7eb;
    }
    h3 {
      font-size: 14px; font-weight: 600; color: #111827;
      margin: 26px 0 10px; display: flex; align-items: center; gap: 8px;
    }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
    th {
      text-align: left; padding: 7px 11px;
      font-size: 10.5px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: #9ca3af;
      background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    }
    td { padding: 7px 11px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.sub td.metric-label { padding-left: 24px; color: #6b7280; font-size: 12.5px; }
    .metric-label { color: #374151; }
    .desc { color: #9ca3af; font-size: 12px; }
    .mono { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace; }
    .muted { color: #9ca3af; }

    /* ── Summary table section rows ── */
    tr.section-row td {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #374151;
      background: #f3f4f6; padding: 9px 11px 6px;
      border-top: 2px solid #e5e7eb;
    }

    /* ── Colors ── */
    .green { color: #16a34a; }
    .red   { color: #dc2626; }

    /* ── Status pill ── */
    .status-pill {
      font-size: 11px; font-weight: 600;
      padding: 1px 8px; border-radius: 999px; display: inline-block;
    }
    .green.status-pill { background: #f0fdf4; }
    .red.status-pill   { background: #fef2f2; }

    /* ── Count badge ── */
    .count-badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: #1d4ed8; color: #fff;
      font-size: 11px; font-weight: 700; font-family: ui-monospace, monospace;
      padding: 1px 9px; border-radius: 999px;
    }

    /* ── Stat grid ── */
    .stat-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px; margin: 12px 0 16px;
    }
    .stat-card {
      border: 1px solid #e5e7eb; border-radius: 10px;
      padding: 16px 12px; text-align: center;
    }
    .stat-val {
      font-size: 30px; font-weight: 700;
      font-family: ui-monospace, monospace;
      line-height: 1.1; margin-bottom: 5px;
    }
    .stat-of { font-size: 14px; font-weight: 400; color: #9ca3af; }
    .stat-lbl { font-size: 10.5px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

    /* ── Product list ── */
    .list-label {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: #9ca3af; margin: 14px 0 8px;
    }
    .product-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .product-list li {
      display: flex; align-items: center; gap: 5px; font-size: 12.5px;
      background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 6px; padding: 3px 10px;
    }
    .product-name { color: #111827; }
    .lang-badge {
      font-size: 10px; font-weight: 700; color: #1d4ed8;
      background: #eff6ff; padding: 1px 5px; border-radius: 4px;
      font-family: ui-monospace, monospace;
    }
    .wave-badge {
      font-size: 10px; font-weight: 600; color: #7c3aed;
      background: #f5f3ff; padding: 1px 5px; border-radius: 4px;
      font-family: ui-monospace, monospace;
    }
    .empty { color: #9ca3af; font-style: italic; font-size: 12px; margin-bottom: 12px; }

    /* ── Global grid (queue + payment) ── */
    .global-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }

    /* ── Week section separator ── */
    .week-section { margin-top: 48px; }
    .week-title {
      font-size: 20px; font-weight: 800; letter-spacing: -0.01em;
      padding: 10px 0 10px; border-bottom: 3px solid #1d4ed8;
      color: #1d4ed8; margin-bottom: 4px;
    }

    /* ── Metric Guide ── */
    .guide-group { margin-bottom: 4px; }
    .guide-section-label {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #374151;
      background: #f3f4f6; padding: 8px 14px; margin: 16px 0 0;
      border-left: 3px solid #1d4ed8;
    }
    .guide-row {
      display: grid; grid-template-columns: 210px 1fr; gap: 20px;
      padding: 10px 14px; border-bottom: 1px solid #f3f4f6;
    }
    .guide-metric { font-weight: 600; font-size: 13px; color: #111827; }
    .guide-desc { font-size: 13px; color: #374151; margin-bottom: 3px; }
    .guide-note { font-size: 12px; color: #6b7280; }

    /* ── Legend ── */
    .legend {
      display: flex; gap: 16px; font-size: 11.5px;
      margin-top: 6px; color: #6b7280;
    }
    .legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }

    /* ── Footer ── */
    footer {
      margin-top: 60px; padding-top: 16px; border-top: 1px solid #e5e7eb;
      font-size: 11.5px; color: #9ca3af; text-align: center;
    }

    /* ── Print ── */
    @media print {
      body { background: #fff; }
      .page { padding: 24px 32px; }
      .week-section { break-before: page; }
      .stat-grid { break-inside: avoid; }
      tr { break-inside: avoid; }
    }
  `

  const tgt = (key: keyof ReportTargets) => t ? `${t[key]}d` : 'see settings'

  const guideHtml = `
    <div class="guide-section-label">New Products Built</div>
    <div class="guide-row"><div><div class="guide-metric">Count</div></div><div><div class="guide-desc">Number of new products that completed the full build pipeline this week.</div><div class="guide-note">Higher = more output. Compare week-over-week for velocity trends.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Phase 1 Avg</div></div><div><div class="guide-desc">Average days from phase 1 start to phase 1 completion (the building phase).</div><div class="guide-note">Target: ${tgt('build_target_days')}. Lower is better. Measures how fast products are built.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Proof Avg</div></div><div><div class="guide-desc">Average days a product spent in the proofreading phase (submission to end).</div><div class="guide-note">Target: ${tgt('proof_target_days')}. Lower is better. Includes turnaround + revision time.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Testing Avg</div></div><div><div class="guide-desc">Average days from a product entering testing to its outcome being decided.</div><div class="guide-note">Target: ${tgt('test_target_days')}. Lower is better. Reflects testing cycle speed.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Total Avg</div></div><div><div class="guide-desc">Average total days from phase 1 start to final outcome decision (end-to-end).</div><div class="guide-note">Target: ${tgt('total_target_days')}. The key overall efficiency metric.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Proofreader Turnaround</div></div><div><div class="guide-desc">Average days from submitting a product to the proofreader to receiving it back.</div><div class="guide-note">Target: ${tgt('proofread_turnaround_target_days')}. Measures proofreader responsiveness.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Web Revision</div></div><div><div class="guide-desc">Average days for website / web content revisions after proofreading.</div><div class="guide-note">Target: ${tgt('web_revision_target_days')}. Measures web team revision speed.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Ads Revision</div></div><div><div class="guide-desc">Average days for ads revisions after the proofreading phase.</div><div class="guide-note">Target: ${tgt('ads_revision_target_days')}. Measures ads team revision speed.</div></div></div>

    <div class="guide-section-label">Expanding Products</div>
    <div class="guide-row"><div><div class="guide-metric">Count</div></div><div><div class="guide-desc">Number of products that went through the expanding phase this week.</div><div class="guide-note">Higher = more products moving into the expansion pipeline.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Proof Avg</div></div><div><div class="guide-desc">Average days expanding products spent in proofreading.</div><div class="guide-note">Target: ${tgt('proof_target_days')}. Same target as new builds.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Proofreader / Web / Ads</div></div><div><div class="guide-desc">Same breakdown metrics as new builds, scoped to expanding products.</div><div class="guide-note">Targets are identical — see New Products Built above.</div></div></div>

    <div class="guide-section-label">Status Counts</div>
    <div class="guide-row"><div><div class="guide-metric">In Testing</div></div><div><div class="guide-desc">Number of products currently in the testing phase at the end of the week.</div><div class="guide-note">Snapshot of testing pipeline depth. No direct target — context-dependent.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">In Expanding — Wave 1</div></div><div><div class="guide-desc">Products currently in expanding classified as Wave 1 (ES / DE languages).</div><div class="guide-note">Wave 1 = Spanish and German language products.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">In Expanding — Wave 2+</div></div><div><div class="guide-desc">Products currently in expanding beyond Wave 1 (all other languages).</div><div class="guide-note">Wave 2+ = all non-ES/DE language products.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Winning</div></div><div><div class="guide-desc">Products that completed testing with a positive (winning) outcome, shown as count / total tested.</div><div class="guide-note">More winners is better. Win rate target: ≥ 50%.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Stopped</div></div><div><div class="guide-desc">Products whose testing was stopped (did not achieve a winning outcome).</div><div class="guide-note">Stopping quickly is healthy — it frees up testing budget for better products.</div></div></div>

    <div class="guide-section-label">Translation Times</div>
    <div class="guide-row"><div><div class="guide-metric">EN Completion</div></div><div><div class="guide-desc">Average days for English content to be fully completed.</div><div class="guide-note">Target: ${tgt('en_completion_target_days')}. Lower is better.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">ES + DE Translation</div></div><div><div class="guide-desc">Average days for Spanish and German translation after English is done.</div><div class="guide-note">Target: ${tgt('es_de_translation_target_days')}. Lower is better.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Total Translation</div></div><div><div class="guide-desc">Average days for the full translation pipeline from start to all languages done.</div><div class="guide-note">Target: ${tgt('total_translation_target_days')}. Key localization efficiency metric.</div></div></div>

    <div class="guide-section-label">Proofreading Queue</div>
    <div class="guide-row"><div><div class="guide-metric">Wave 1 Pending</div></div><div><div class="guide-desc">ES / DE products currently waiting to be proofread.</div><div class="guide-note">Lower is better. A high number means the proofreader is the bottleneck.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Wave 2+ Pending</div></div><div><div class="guide-desc">Non-ES/DE products currently waiting to be proofread.</div><div class="guide-note">Lower is better.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Done</div></div><div><div class="guide-desc">Products that have completed proofreading (snapshot for current month).</div><div class="guide-note">Tracks proofreading throughput for the month.</div></div></div>

    <div class="guide-section-label">Payment Status</div>
    <div class="guide-row"><div><div class="guide-metric">Paid</div></div><div><div class="guide-desc">Total products in this month with payment already processed.</div><div class="guide-note">Should grow through the month as products are completed and invoiced.</div></div></div>
    <div class="guide-row"><div><div class="guide-metric">Unpaid</div></div><div><div class="guide-desc">Total products in this month still awaiting payment.</div><div class="guide-note">Should approach 0 as the month closes.</div></div></div>
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Report — ${formatMonthLabel(month)}</title>
  <style>${css}</style>
</head>
<body>
<div class="page">

  <header class="report-header">
    <div>
      <span class="report-title">Weekly Report</span>
      <span class="report-month">${formatMonthLabel(month)}</span>
    </div>
    <div class="report-meta">
      Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
      <span class="legend">
        <span><span class="legend-dot" style="background:#16a34a"></span>At or below target</span>
        <span><span class="legend-dot" style="background:#dc2626"></span>Exceeds target</span>
      </span>
    </div>
  </header>

  <!-- ── All-Week Summary ── -->
  <h2>All-Week Summary</h2>
  <table>
    <thead>
      <tr><th>Metric</th>${weekHeaders}<th>Target</th></tr>
    </thead>
    <tbody>
      <tr class="section-row"><td colspan="6">New Products Built</td></tr>
      ${htmlSummaryCountRow('Count', weeks, w => w.newBuilds.count)}
      ${htmlSummaryMetricRow('Phase 1 Avg', weeks, w => w.newBuilds.avgPhase1Days, t?.build_target_days)}
      ${htmlSummaryMetricRow('Proof Avg', weeks, w => w.newBuilds.avgProofDays, t?.proof_target_days)}
      ${htmlSummaryMetricRow('Testing Avg', weeks, w => w.newBuilds.avgTestDays, t?.test_target_days)}
      ${htmlSummaryMetricRow('Total Avg', weeks, w => w.newBuilds.avgTotalDays, t?.total_target_days)}
      ${htmlSummaryMetricRow('Proofreader Turnaround', weeks, w => w.newBuilds.avgProofreadTurnaround, t?.proofread_turnaround_target_days, true)}
      ${htmlSummaryMetricRow('Web Revision', weeks, w => w.newBuilds.avgWebRevisionDays, t?.web_revision_target_days, true)}
      ${htmlSummaryMetricRow('Ads Revision', weeks, w => w.newBuilds.avgAdsRevisionDays, t?.ads_revision_target_days, true)}

      <tr class="section-row"><td colspan="6">Expanding Products</td></tr>
      ${htmlSummaryCountRow('Count', weeks, w => w.expandingProducts.count)}
      ${htmlSummaryMetricRow('Proof Avg', weeks, w => w.expandingProducts.avgProofDays, t?.proof_target_days)}
      ${htmlSummaryMetricRow('Proofreader Turnaround', weeks, w => w.expandingProducts.avgProofreadTurnaround, t?.proofread_turnaround_target_days, true)}
      ${htmlSummaryMetricRow('Web Revision', weeks, w => w.expandingProducts.avgWebRevisionDays, t?.web_revision_target_days, true)}
      ${htmlSummaryMetricRow('Ads Revision', weeks, w => w.expandingProducts.avgAdsRevisionDays, t?.ads_revision_target_days, true)}

      <tr class="section-row"><td colspan="6">Status Counts</td></tr>
      ${htmlSummaryCountRow('In Testing', weeks, w => w.inTesting.count)}
      ${htmlSummaryCountRow('In Expanding — Wave 1', weeks, w => w.inExpanding.wave1Count)}
      ${htmlSummaryCountRow('In Expanding — Wave 2+', weeks, w => w.inExpanding.wave2plusCount)}
      ${htmlSummaryCountRow('Winning', weeks, w => `${w.winning.count} / ${w.winning.totalTested}`)}
      ${htmlSummaryCountRow('Win Rate', weeks, w => w.winning.pct)}
      ${htmlSummaryCountRow('Stopped', weeks, w => w.stoppedCount)}

      <tr class="section-row"><td colspan="6">Translation Times</td></tr>
      ${htmlSummaryMetricRow('EN Completion', weeks, w => w.translation.en.avgDays, t?.en_completion_target_days)}
      ${htmlSummaryMetricRow('ES + DE Translation', weeks, w => w.translation.esDe.avgDays, t?.es_de_translation_target_days)}
      ${htmlSummaryMetricRow('Total Translation', weeks, w => w.translation.total.avgDays, t?.total_translation_target_days)}
    </tbody>
  </table>

  <!-- ── Queue & Payment ── -->
  <h2>Proofreading Queue &amp; Payment Status</h2>
  <div class="global-grid">
    <div>
      <h3>Proofreading Queue</h3>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-val">${queue?.wave1 ?? 0}</div><div class="stat-lbl">Wave 1 Pending</div></div>
        <div class="stat-card"><div class="stat-val">${queue?.wave2plus ?? 0}</div><div class="stat-lbl">Wave 2+ Pending</div></div>
        <div class="stat-card"><div class="stat-val">${queue?.done ?? 0}</div><div class="stat-lbl">Done</div></div>
      </div>
      <p style="font-size:12px;color:#9ca3af">Wave 1 = ES / DE products. Wave 2+ = all other languages.</p>
    </div>
    <div>
      <h3>Payment Status</h3>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-val green">${report.paymentStatus.paid}</div><div class="stat-lbl">Paid</div></div>
        <div class="stat-card"><div class="stat-val">${report.paymentStatus.unpaid}</div><div class="stat-lbl">Unpaid</div></div>
      </div>
      <p style="font-size:12px;color:#9ca3af">Month-to-date totals across all products.</p>
    </div>
  </div>

  <!-- ── Per-Week Detail ── -->
  <h2>Week-by-Week Detail</h2>
  ${weeks.filter((w): w is WeekData => w !== null).map(w => htmlWeekSection(w, t)).join('\n')}

  <!-- ── Metric Guide ── -->
  <section style="margin-top:56px">
    <h2>Metric Guide</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:4px">Plain-language explanation of every metric in this report, including targets and how to interpret them.</p>
    ${guideHtml}
  </section>

  <footer>Weekly Report &middot; ${formatMonthLabel(month)} &middot; Myko Hub &middot; Print this page to save as PDF</footer>

</div>
</body>
</html>`
}

function handleExport(report: WeeklyReport, queue: ProofQueue | null, month: string): void {
  const html = generateHtml(report, queue, month)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
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
              Export
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
