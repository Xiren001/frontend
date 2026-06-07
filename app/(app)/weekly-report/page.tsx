'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { currentMonth } from '@/lib/utils'
import type { WeekStats, BuildSummary } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MobileDataCard, MobileDataRow, ResponsiveCardList, ResponsiveDesktopTable } from '@/components/ui/responsive-table'
import { Modal } from '@/components/ui/modal'
import { TrendingUp, FlaskConical, Download, Target, Trophy } from 'lucide-react'
import {
  type WinningStore,
  loadStores,
  loadActiveStoreId,
  saveActiveStoreId,
  loadWinningTitles,
  loadCsvWinners,
  isWinnerMatch,
} from '@/lib/winning-products'

interface ReportNarrative { id: string; week_number: number; narrative_text: string }

function BuildList({ builds, emptyText }: { builds: BuildSummary[]; emptyText: string }) {
  if (builds.length === 0) return <p className="text-xs text-text-muted italic">{emptyText}</p>
  return (
    <ul className="space-y-1.5">
      {builds.map((b, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="text-sm text-foreground font-medium leading-snug">{b.product_name}</span>
          {b.language && <Badge variant="accent">{b.language}</Badge>}
          <Badge variant={b.type === 'jewelry' ? 'default' : 'muted'}>{b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}</Badge>
        </li>
      ))}
    </ul>
  )
}

interface CsvProduct { title: string; unitsSold?: number; unitGrowthPct?: number }

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateWeeklyHtml(
  month: string,
  weekStats: WeekStats[],
  narratives: ReportNarrative[],
  testingWinners: (BuildSummary & { week: number })[],
  csvWinners: { demand: CsvProduct[]; momentum: CsvProduct[] },
): string {
  const dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const monthLabel = (() => {
    const [y, m] = month.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  })()

  const totalLogged    = weekStats.reduce((s, w) => s + w.logged, 0)
  const totalCompleted = weekStats.reduce((s, w) => s + w.completed, 0)
  const totalWinners   = weekStats.reduce((s, w) => s + w.winners, 0)
  const totalKilled    = weekStats.reduce((s, w) => s + w.killed, 0)
  const totalMistakes  = weekStats.reduce((s, w) => s + w.mistakes, 0)
  const totalTested    = weekStats.reduce((s, w) => s + (w.testedCount ?? 0), 0)
  const totalTestedWon = weekStats.reduce((s, w) => s + (w.testedWon ?? 0), 0)
  const monthTestWinRate = totalTested > 0 ? `${Math.round(totalTestedWon / totalTested * 100)}%` : '—'
  const winRate = totalCompleted > 0 ? `${Math.round(totalWinners / totalCompleted * 100)}%` : '—'

  const avgOf = (key: 'avgBuildDays' | 'avgTotalDays') => {
    const vals = weekStats.map(w => w[key]).filter((v): v is number => v !== null && v !== undefined)
    if (!vals.length) return '—'
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
  }

  const sum = (key: 'logged' | 'completed' | 'winners' | 'killed' | 'mistakes') =>
    weekStats.reduce((s, w) => s + w[key], 0)

  const METRICS: { key: keyof WeekStats; label: string; description: string; total: string | number }[] = [
    { key: 'logged',       label: 'Builds logged',             description: 'Total build entries tracked in the Jewelry Tracker this week.',             total: sum('logged') },
    { key: 'completed',    label: 'Completed (live)',          description: 'Builds that reached a final decision — either expanding or stopped.',       total: sum('completed') },
    { key: 'winners',      label: 'Expanding',                 description: 'Products approved for scale-up after a successful testing outcome.',        total: sum('winners') },
    { key: 'killed',       label: 'Stopped',                   description: 'Products discontinued after testing did not meet performance targets.',     total: sum('killed') },
    { key: 'mistakes',     label: 'Issues logged',             description: 'Quality issues or mistakes recorded in the Issue Log this week.',           total: sum('mistakes') },
    { key: 'avgBuildDays', label: 'Avg build cycle (days)',    description: 'Average number of days from build start to live (Phase 1 complete).',       total: avgOf('avgBuildDays') },
    { key: 'avgTotalDays', label: 'Avg total pipeline (days)', description: 'Average days from approval through testing to a final outcome decision.',    total: avgOf('avgTotalDays') },
    { key: 'testWinRate',  label: 'Test → Winner (%)',         description: 'Of all products that entered the testing phase, the percentage that were decided as expanding.',  total: monthTestWinRate },
  ]

  const getNarrative = (week: number) =>
    narratives.find(n => n.week_number === week)?.narrative_text ?? ''

  const allExpanding = weekStats.flatMap(w =>
    (w.expandingBuilds ?? []).map(b => ({ ...b, week: w.week }))
  )
  const allTesting = weekStats.flatMap(w =>
    (w.testingBuilds ?? []).map(b => ({ ...b, week: w.week }))
  )

  const productBadges = (b: BuildSummary) => `
    ${b.language ? `<span class="badge badge-lang">${esc(b.language)}</span>` : ''}
    <span class="badge ${b.type === 'jewelry' ? 'badge-jewelry' : 'badge-funnel'}">${b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}</span>
  `

  const productsByWeek = (list: (BuildSummary & { week: number })[]) =>
    [1, 2, 3, 4].map(w => {
      const items = list.filter(b => b.week === w)
      return `
        <div class="week-col">
          <div class="week-col-label">Week ${w}</div>
          ${items.length === 0
            ? `<p class="empty-note">None this week</p>`
            : items.map(b => `
                <div class="product-item">
                  <span class="product-name">${esc(b.product_name)}</span>
                  <span class="badges">${productBadges(b)}</span>
                </div>`).join('')}
        </div>`
    }).join('')

  const metricRows = METRICS.map(m => `
    <tr>
      <td class="td-label">
        <div class="ml">${esc(m.label)}</div>
        <div class="md">${esc(m.description)}</div>
      </td>
      ${weekStats.map(w => `<td>${(w[m.key] as string | number | null) ?? '—'}</td>`).join('')}
      <td class="td-total">${m.total}</td>
    </tr>`).join('')

  const narrativeCards = [1, 2, 3, 4].map(w => {
    const text = getNarrative(w)
    return `
      <div class="nar-card">
        <div class="nar-label">Week ${w}</div>
        ${text
          ? `<div class="nar-text">${esc(text)}</div>`
          : `<div class="nar-empty">No narrative recorded for this week.</div>`}
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly Performance Report — ${esc(monthLabel)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;background:#f1f5f9;line-height:1.5}
.page{max-width:900px;margin:0 auto;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 16px 48px rgba(0,0,0,.08)}
/* toolbar */
.toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
.toolbar-brand{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}
.toolbar-actions{display:flex;gap:8px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;border:none;font-family:inherit}
.btn-primary{background:#6366f1;color:#fff}
.btn-ghost{background:#fff;color:#475569;border:1px solid #e2e8f0}
/* header */
.rh{padding:40px 48px 36px;border-bottom:1px solid #e2e8f0}
.rh-top{display:flex;justify-content:space-between;align-items:flex-start}
.rh-left{}
.rh-brand{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
.rh-title{font-size:30px;font-weight:700;letter-spacing:-.02em;color:#0f172a}
.rh-period{font-size:14px;color:#64748b;margin-top:4px}
.rh-right{text-align:right}
.rh-date{font-size:11px;color:#94a3b8}
.rh-note{font-size:10px;color:#cbd5e1;margin-top:3px}
/* content */
.content{padding:40px 48px}
/* section */
.section{margin-bottom:44px}
.sec-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
.sec-desc{font-size:12px;color:#94a3b8;margin-bottom:16px;line-height:1.5}
/* KPI */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px}
.kpi-lbl{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.kpi-val{font-size:26px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;line-height:1}
.kpi-sub{font-size:11px;color:#94a3b8;margin-top:4px}
/* table */
table{width:100%;border-collapse:collapse;font-size:13px}
thead{background:#f8fafc}
th{text-align:left;padding:10px 14px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0}
th:not(:first-child){text-align:right}
td{padding:10px 14px;color:#334155;border-bottom:1px solid #f8fafc}
td:not(:first-child){text-align:right;font-variant-numeric:tabular-nums;color:#1e293b;font-weight:500}
.td-label{min-width:240px;max-width:300px}
.ml{font-size:13px;color:#334155}
.md{font-size:11px;color:#94a3b8;margin-top:2px;line-height:1.4}
.td-total{font-weight:700;color:#0f172a}
tr:nth-child(even) td{background:#fafbfd}
/* narratives */
.nar-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.nar-card{border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px}
.nar-label{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px}
.nar-text{font-size:13px;line-height:1.65;color:#475569;white-space:pre-wrap}
.nar-empty{font-size:12px;color:#cbd5e1;font-style:italic}
/* products */
.week-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.week-col{}
.week-col-label{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px}
.product-item{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #f8fafc}
.product-item:last-child{border-bottom:none}
.product-name{font-size:13px;font-weight:500;color:#0f172a;flex:1;line-height:1.4}
.badges{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}
.badge{font-size:10px;font-weight:600;letter-spacing:.03em;padding:2px 8px;border-radius:999px;white-space:nowrap}
.badge-lang{background:#ede9fe;color:#6d28d9}
.badge-jewelry{background:#e0e7ff;color:#4338ca}
.badge-funnel{background:#f0fdf4;color:#166534}
.badge-week{background:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0}
.empty-note{font-size:12px;color:#cbd5e1;font-style:italic;padding:6px 0}
.csv-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px}
/* footer */
.rfoot{padding:20px 48px;border-top:1px solid #f1f5f9;background:#f8fafc;display:flex;justify-content:space-between;align-items:center}
.rfoot-brand{font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em}
.rfoot-note{font-size:10px;color:#cbd5e1}
@media print{
  body{background:#fff}
  .page{box-shadow:none;max-width:100%}
  .toolbar{display:none}
  @page{margin:15mm 18mm;size:A4}
}
</style>
</head>
<body>
<div class="page">

  <div class="toolbar">
    <span class="toolbar-brand">Myko Hub · Weekly Report</span>
    <div class="toolbar-actions">
      <button class="btn btn-ghost" onclick="window.close()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">&#x1F5A8;&nbsp; Print / Save PDF</button>
    </div>
  </div>

  <div class="rh">
    <div class="rh-top">
      <div class="rh-left">
        <div class="rh-brand">Myko Hub &middot; Build &amp; Product Tracker</div>
        <div class="rh-title">Weekly Performance Report</div>
        <div class="rh-period">${esc(monthLabel)}</div>
      </div>
      <div class="rh-right">
        <div class="rh-date">Generated ${esc(dateLabel)}</div>
        <div class="rh-note">Auto-populated from Jewelry Tracker &amp; Issue Log</div>
      </div>
    </div>
  </div>

  <div class="content">

    <!-- KPI summary -->
    <div class="section">
      <div class="sec-label">Month at a Glance</div>
      <div class="sec-desc">High-level totals across all four weeks. Use these as the headline numbers in your report email.</div>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-lbl">Total Builds</div>
          <div class="kpi-val">${totalLogged}</div>
          <div class="kpi-sub">tracked this month</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Expanding</div>
          <div class="kpi-val">${totalWinners}</div>
          <div class="kpi-sub">of ${totalCompleted} decided</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Win Rate</div>
          <div class="kpi-val">${winRate}</div>
          <div class="kpi-sub">decided builds only</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Test → Winner</div>
          <div class="kpi-val">${monthTestWinRate}</div>
          <div class="kpi-sub">${totalTested} entered testing</div>
        </div>
      </div>
    </div>

    <!-- Metrics table -->
    <div class="section">
      <div class="sec-label">Performance by Week</div>
      <div class="sec-desc">
        Each column represents one week of the month. The <strong>Month</strong> column shows the aggregate.
        <em>Avg build</em> and <em>Avg total pipeline</em> are averaged across weeks; all other numeric columns are summed.
        <em>Test → Winner (%)</em> is computed from the monthly totals, not a simple average of weekly percentages.
      </div>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th>
            <th>Month</th>
          </tr>
        </thead>
        <tbody>${metricRows}</tbody>
      </table>
    </div>

    <!-- Narratives -->
    <div class="section">
      <div class="sec-label">Weekly Narratives</div>
      <div class="sec-desc">Written summaries for each week. These are sent to Abigél every Friday by 2 pm.</div>
      <div class="nar-grid">${narrativeCards}</div>
    </div>

    <!-- Expanding products -->
    ${allExpanding.length > 0 ? `
    <div class="section">
      <div class="sec-label">Expanding Products (${allExpanding.length})</div>
      <div class="sec-desc">Products that passed testing and were approved for scaling up. These are the wins of the month.</div>
      <div class="week-grid">${productsByWeek(allExpanding)}</div>
    </div>` : ''}

    <!-- Still testing -->
    ${allTesting.length > 0 ? `
    <div class="section">
      <div class="sec-label">Still in Testing (${allTesting.length})</div>
      <div class="sec-desc">Products currently in the testing phase. A decision (expanding or stopped) is pending for these builds.</div>
      <div class="week-grid">${productsByWeek(allTesting)}</div>
    </div>` : ''}

    <!-- Testing × Winning Products cross-reference -->
    ${testingWinners.length > 0 ? `
    <div class="section">
      <div class="sec-label">In Testing — Qualified &amp; Momentum Match <span class="sec-count">(${testingWinners.length})</span></div>
      <div class="sec-desc">Products currently in testing whose names match products highlighted in the Winning Products tab. These are proven market sellers actively being tested — they deserve the closest attention and fastest decision-making.</div>
      <div>
        ${testingWinners.map(b => `
          <div class="product-item">
            <span class="badge badge-week" style="margin-right:4px">W${b.week}</span>
            <span class="product-name">${esc(b.product_name)}</span>
            <span class="badges">${productBadges(b)}</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Winning Products -->
    ${(csvWinners.demand.length > 0 || csvWinners.momentum.length > 0) ? `
    <div class="section">
      <div class="sec-label">Winning Products from Analysis</div>
      <div class="sec-desc">Products from the Winning Products CSV upload that passed the demand and momentum thresholds.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${csvWinners.demand.length > 0 ? `
        <div>
          <div class="csv-lbl">Qualified Demand (${csvWinners.demand.length})</div>
          ${csvWinners.demand.map(p => `
            <div class="product-item">
              <span class="product-name">${esc(p.title)}</span>
              ${p.unitsSold != null ? `<span class="mono" style="color:#94a3b8;font-size:11px">${p.unitsSold} sold/wk</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
        ${csvWinners.momentum.length > 0 ? `
        <div>
          <div class="csv-lbl">Momentum (${csvWinners.momentum.length})</div>
          ${csvWinners.momentum.map(p => `
            <div class="product-item">
              <span class="product-name">${esc(p.title)}</span>
              ${p.unitGrowthPct != null ? `<span class="mono" style="color:#6366f1;font-size:11px">+${p.unitGrowthPct}%</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Stopped -->
    ${totalKilled > 0 ? `
    <div class="section">
      <div class="sec-label">Quick Stats</div>
      <div class="sec-desc">Additional context for the reporting period.</div>
      <table style="max-width:400px">
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td class="td-label"><div class="ml">Stopped builds</div><div class="md">Products discontinued after testing</div></td><td>${totalKilled}</td></tr>
          <tr><td class="td-label"><div class="ml">Issues logged</div><div class="md">Quality issues recorded in Issue Log</div></td><td>${totalMistakes}</td></tr>
        </tbody>
      </table>
    </div>` : ''}

  </div><!-- /content -->

  <div class="rfoot">
    <span class="rfoot-brand">MYKO HUB</span>
    <span class="rfoot-note">Auto-generated &middot; ${esc(dateLabel)} &middot; Data from Build &amp; Product Tracker</span>
  </div>

</div>
</body>
</html>`
}

export default function WeeklyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [weekStats, setWeekStats] = useState<WeekStats[]>([])
  const [narratives, setNarratives] = useState<ReportNarrative[]>([])
  const [editWeek, setEditWeek] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [winningTitles, setWinningTitles] = useState<Set<string>>(new Set())
  const [csvWinners, setCsvWinners] = useState<{ demand: CsvProduct[]; momentum: CsvProduct[] }>({ demand: [], momentum: [] })
  const [stores, setStores] = useState<WinningStore[]>([])
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null)

  async function load() {
    const data = await api.get<{ weekStats: WeekStats[]; narratives: ReportNarrative[] }>(`/api/reports/weekly?month=${month}`)
    setWeekStats(data.weekStats)
    setNarratives(data.narratives)
  }

  useRealtimeRefresh(['builds', 'mistakes', 'report_narratives'], load)
  useEffect(() => { load() }, [month])

  useEffect(() => {
    const s = loadStores()
    setStores(s)
    setActiveStoreId(loadActiveStoreId(s))
  }, [])

  useEffect(() => {
    if (activeStoreId === null) return
    setWinningTitles(loadWinningTitles(activeStoreId))
    setCsvWinners(loadCsvWinners(activeStoreId))
  }, [activeStoreId])

  function getNarrative(week: number) {
    return narratives.find(n => n.week_number === week)?.narrative_text ?? ''
  }

  function openEdit(week: number) {
    setEditWeek(week)
    setEditText(getNarrative(week))
  }

  async function saveNarrative() {
    if (editWeek === null) return
    setSaving(true)
    try {
      await api.put('/api/reports/narrative', {
        type: 'weekly',
        week_number: editWeek,
        month_year: `${month}-01`,
        narrative_text: editText,
      })
      setEditWeek(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    const html = generateWeeklyHtml(month, weekStats, narratives, testingWinnersAll, csvWinners)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  const METRICS: { key: keyof WeekStats; label: string }[] = [
    { key: 'logged',       label: 'Builds logged' },
    { key: 'completed',    label: 'Completed (live)' },
    { key: 'winners',      label: 'Expanding' },
    { key: 'killed',       label: 'Stopped' },
    { key: 'mistakes',     label: 'Issues' },
    { key: 'avgBuildDays', label: 'Avg build (days)' },
    { key: 'avgTotalDays', label: 'Avg total: approved → live (days)' },
    { key: 'testWinRate',  label: 'Tested → winner (%)' },
  ]

  const monthTotal = (key: keyof WeekStats) => {
    if (key === 'testWinRate') {
      const totalTested    = weekStats.reduce((s, w) => s + (w.testedCount ?? 0), 0)
      const totalTestedWon = weekStats.reduce((s, w) => s + (w.testedWon ?? 0), 0)
      return totalTested > 0 ? `${Math.round(totalTestedWon / totalTested * 100)}%` : '—'
    }
    const vals = weekStats.map(w => w[key] as number | null).filter((v): v is number => v !== null)
    if (vals.length === 0) return '—'
    if (key === 'avgBuildDays' || key === 'avgTotalDays') {
      const a = vals.reduce((a, b) => a + b, 0) / vals.length
      return Math.round(a * 10) / 10
    }
    return vals.reduce((a, b) => a + b, 0)
  }

  const hasAnyExpanding = weekStats.some(w => (w.expandingBuilds?.length ?? 0) > 0)
  const hasAnyTesting   = weekStats.some(w => (w.testingBuilds?.length ?? 0) > 0)

  // Testing builds that also match a winning product — across all weeks
  const testingWinnersAll = winningTitles.size > 0
    ? weekStats.flatMap(w =>
        (w.testingBuilds ?? [])
          .filter(b => isWinnerMatch(b.product_name, winningTitles))
          .map(b => ({ ...b, week: w.week }))
      )
    : []

  return (
    <div>
      <PageHeader
        title="Weekly Report"
        description="Auto counts from trackers. Fill narrative cells each Friday — send by 2pm."
        actions={
          <div className="flex items-center gap-2">
            {stores.length > 1 && activeStoreId && (
              <select
                value={activeStoreId}
                onChange={e => {
                  setActiveStoreId(e.target.value)
                  saveActiveStoreId(e.target.value)
                }}
                className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent-border"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        }
      />

      {/* Mobile: one card per metric */}
      <ResponsiveCardList className="mb-10">
        {METRICS.map(m => (
          <MobileDataCard key={m.key}>
            <p className="font-medium text-sm text-foreground mb-3">{m.label}</p>
            <div className="space-y-2">
              {weekStats.map(w => (
                <MobileDataRow key={w.week} label={`Week ${w.week}`} mono>
                  {(w[m.key] as string | number | null) ?? '—'}
                </MobileDataRow>
              ))}
              <MobileDataRow label="Month" mono>
                <span className="font-medium">{monthTotal(m.key)}</span>
              </MobileDataRow>
            </div>
          </MobileDataCard>
        ))}
      </ResponsiveCardList>

      {/* Desktop: matrix table */}
      <ResponsiveDesktopTable className="mb-10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Metric</TableHeader>
              {[1, 2, 3, 4].map(w => <TableHeader key={w} className="text-center">Week {w}</TableHeader>)}
              <TableHeader className="text-center">Month</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {METRICS.map(m => (
              <TableRow key={m.key}>
                <TableCell className="text-foreground">{m.label}</TableCell>
                {weekStats.map(w => (
                  <TableCell key={w.week} mono className="text-center text-foreground">
                    {(w[m.key] as string | number | null) ?? '—'}
                  </TableCell>
                ))}
                <TableCell mono className="text-center font-medium text-foreground">{monthTotal(m.key)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveDesktopTable>

      {/* Narratives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[1, 2, 3, 4].map(w => {
          const text = getNarrative(w)
          return (
            <Card key={w}>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Week {w} — narrative</p>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                    {text ? 'Edit' : 'Add'}
                  </Button>
                </div>
                {text ? (
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{text}</p>
                ) : (
                  <p className="text-sm text-text-muted italic">No narrative yet.</p>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Expanding products by week */}
      {hasAnyExpanding && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Expanding Products</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {weekStats.map(w => (
              <Card key={w.week}>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Week {w.week}</p>
                  <BuildList builds={w.expandingBuilds ?? []} emptyText="None this week" />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Products still testing by week */}
      {hasAnyTesting && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Still in Testing</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {weekStats.map(w => (
              <Card key={w.week}>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Week {w.week}</p>
                  <BuildList builds={w.testingBuilds ?? []} emptyText="None this week" />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Testing × Winning Products cross-reference */}
      {testingWinnersAll.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              In Testing — Qualified & Momentum Match
              <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">({testingWinnersAll.length})</span>
            </h2>
          </div>
          <Card>
            <CardBody>
              <p className="text-xs text-text-muted mb-3 leading-relaxed">
                Products currently in testing that also appear in the Winning Products tab. Highest priority to watch.
              </p>
              <ul className="space-y-1.5">
                {testingWinnersAll.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-mono shrink-0">W{b.week}</span>
                    <span className="text-sm text-foreground font-medium leading-snug">{b.product_name}</span>
                    {b.language && <Badge variant="accent">{b.language}</Badge>}
                    <Badge variant={b.type === 'jewelry' ? 'default' : 'muted'}>{b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Winning Products from CSV */}
      {(csvWinners.demand.length > 0 || csvWinners.momentum.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Winning Products from Analysis</h2>
            <span className="text-xs text-text-muted">(from Winning Products CSV upload)</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {csvWinners.demand.length > 0 && (
              <Card>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Qualified Demand ({csvWinners.demand.length})</p>
                  <div className="space-y-1.5">
                    {csvWinners.demand.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
                        <span className="text-sm text-foreground font-medium">{p.title}</span>
                        {p.unitsSold != null && (
                          <span className="text-xs text-text-muted font-mono shrink-0 ml-2">{p.unitsSold} sold/wk</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
            {csvWinners.momentum.length > 0 && (
              <Card>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Momentum ({csvWinners.momentum.length})</p>
                  <div className="space-y-1.5">
                    {csvWinners.momentum.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
                        <span className="text-sm text-foreground font-medium">{p.title}</span>
                        {p.unitGrowthPct != null && (
                          <span className="text-xs text-accent font-mono shrink-0 ml-2">+{p.unitGrowthPct}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal
        open={editWeek !== null}
        onClose={() => setEditWeek(null)}
        title={`Week ${editWeek} narrative`}
        description="Notes for Abigél — send by Friday 2pm."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditWeek(null)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={saveNarrative} disabled={saving}>
              {saving ? 'Saving…' : 'Save narrative'}
            </Button>
          </>
        }
      >
        <textarea
          rows={8}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
          placeholder="Notes for Abigél…"
        />
      </Modal>
    </div>
  )
}
