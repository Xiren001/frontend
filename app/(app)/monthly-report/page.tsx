'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { currentMonth } from '@/lib/utils'
import type { BuildSummary } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Modal } from '@/components/ui/modal'
import { TrendingUp, FlaskConical, Trophy, Download, Target } from 'lucide-react'

interface MonthlyReport {
  totalCompleted: number
  jewelryCompleted: number
  funnelCompleted: number
  byWeek: number[]
  winners: number
  killed: number
  winRate: string
  testWinRate: string
  avgBuildDays: number | null
  avgTotalDays: number | null
  mistakesTotal: number
  mistakesRepeating: number
  mistakesByCategory: Record<string, number>
  sopUpdated: number
  expandingList: BuildSummary[]
  testingList: BuildSummary[]
  narrative: { narrative_text: string } | null
}

interface MetricRow { label: string; value: string | number; description: string }

interface CsvProduct { title: string; unitsSold?: number; unitGrowthPct?: number }

function normTitle(s: string) { return s.toLowerCase().trim() }

function isWinnerMatch(name: string, titles: Set<string>): boolean {
  const n = normTitle(name)
  for (const t of titles) {
    if (n === t || n.includes(t) || t.includes(n)) return true
  }
  return false
}

function loadTitleSet(filteredKey: string, rawKey: string): Set<string> {
  const s = new Set<string>()
  try {
    const raw = localStorage.getItem(filteredKey) || localStorage.getItem(rawKey)
    if (!raw) return s
    const stored = JSON.parse(raw) as { rows: { title: string }[] }
    for (const r of stored.rows ?? []) if (r.title) s.add(normTitle(r.title))
  } catch {}
  return s
}

function loadWinningTitles(): Set<string> {
  const demand   = loadTitleSet('wp-demand-filtered',   'wp-demand')
  const momentum = loadTitleSet('wp-momentum-filtered', 'wp-momentum')
  if (demand.size === 0 || momentum.size === 0) return new Set()
  const result = new Set<string>()
  for (const t of demand) if (momentum.has(t)) result.add(t)
  return result
}

function loadCsvWinners(): { demand: CsvProduct[]; momentum: CsvProduct[] } {
  const parse = (filteredKey: string, rawKey: string): CsvProduct[] => {
    try {
      // Prefer the filtered snapshot saved by the Winning Products tab
      const filtered = localStorage.getItem(filteredKey)
      if (filtered) {
        const stored = JSON.parse(filtered) as { rows: CsvProduct[] }
        if (stored.rows?.length) return stored.rows
      }
      // Fall back to raw data if filtered snapshot isn't available
      const raw = localStorage.getItem(rawKey)
      if (!raw) return []
      const stored = JSON.parse(raw) as { rows: CsvProduct[] }
      return stored.rows ?? []
    } catch { return [] }
  }
  return {
    demand:   parse('wp-demand-filtered',   'wp-demand'),
    momentum: parse('wp-momentum-filtered', 'wp-momentum'),
  }
}

function BuildRow({ b }: { b: BuildSummary }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-sm text-foreground font-medium flex-1 leading-snug">{b.product_name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {b.language && <Badge variant="accent">{b.language}</Badge>}
        <Badge variant={b.type === 'jewelry' ? 'default' : 'muted'}>{b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}</Badge>
        {b.week_number && <span className="text-xs text-text-muted font-mono">W{b.week_number}</span>}
      </div>
    </div>
  )
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateMonthlyHtml(
  month: string,
  report: MonthlyReport,
  csvWinners: { demand: CsvProduct[]; momentum: CsvProduct[] },
  testingWinners: BuildSummary[],
): string {
  const dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const monthLabel = (() => {
    const [y, m] = month.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  })()

  const categoryBreakdown = Object.entries(report.mistakesByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${cat} (${count})`)
    .join(', ') || '—'

  const METRICS: { label: string; value: string | number; description: string }[] = [
    { label: 'Builds completed (went live)',        value: report.totalCompleted,       description: 'Total builds that reached a final decision — expanding or stopped.' },
    { label: '  · Jewelry (Shopify)',               value: report.jewelryCompleted,     description: 'Jewelry builds on Shopify that completed this month.' },
    { label: '  · Funnel (Funnelish)',              value: report.funnelCompleted,      description: 'Funnel builds on Funnelish that completed this month.' },
    { label: 'By week — W1 / W2 / W3 / W4',        value: report.byWeek.join(' / '),   description: 'Distribution of completed builds across the four weeks of the month.' },
    { label: 'Expanding (decided)',                 value: report.winners,              description: 'Products approved for scale-up after passing testing.' },
    { label: 'Stopped',                             value: report.killed,               description: 'Products discontinued after testing did not meet targets.' },
    { label: 'Win rate (all decided)',              value: report.winRate,              description: 'Expanding ÷ all decided builds. Includes products stopped without entering testing.' },
    { label: 'Test → Winner (%)',                   value: report.testWinRate,          description: 'Of all products that entered the testing phase, the percentage that became expanding. This is the true quality signal.' },
    { label: 'Build cycle avg (days)',              value: report.avgBuildDays ?? '—',  description: 'Average days from Phase 1 start to build complete (went live).' },
    { label: 'Total pipeline avg (days)',           value: report.avgTotalDays ?? '—',  description: 'Average days from approval through testing to a final outcome decision.' },
    { label: 'Issues logged',                       value: report.mistakesTotal,        description: 'Total mistakes or quality issues recorded in the Issue Log.' },
    { label: '  · Repeating issues',               value: report.mistakesRepeating,    description: 'Issues that appeared in more than one build — signals a systematic gap.' },
    { label: '  · By category',                    value: categoryBreakdown,           description: 'Issue breakdown by category, sorted by frequency.' },
    { label: '  · SOPs updated',                   value: report.sopUpdated,           description: 'Issues where the SOP was updated to prevent recurrence.' },
  ]

  const metricRows = METRICS.map(m => `
    <tr>
      <td class="td-label">
        <div class="ml">${esc(m.label)}</div>
        <div class="md">${esc(m.description)}</div>
      </td>
      <td class="td-val">${esc(String(m.value))}</td>
    </tr>`).join('')

  const buildRows = (list: BuildSummary[]) =>
    list.map(b => `
      <div class="product-item">
        <span class="product-name">${esc(b.product_name)}</span>
        <span class="badges">
          ${b.language ? `<span class="badge badge-lang">${esc(b.language)}</span>` : ''}
          <span class="badge ${b.type === 'jewelry' ? 'badge-jewelry' : 'badge-funnel'}">${b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}</span>
          ${b.week_number ? `<span class="badge badge-week">W${b.week_number}</span>` : ''}
        </span>
      </div>`).join('')

  const hasCsv = csvWinners.demand.length > 0 || csvWinners.momentum.length > 0

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly Performance Report — ${esc(monthLabel)}</title>
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
/* report header */
.rh{padding:40px 48px 36px;border-bottom:1px solid #e2e8f0}
.rh-top{display:flex;justify-content:space-between;align-items:flex-start}
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
.sec-count{font-weight:normal;color:#cbd5e1;letter-spacing:0}
.sec-desc{font-size:12px;color:#94a3b8;margin-bottom:16px;line-height:1.5}
/* KPI */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px}
.kpi-lbl{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.kpi-val{font-size:26px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;line-height:1}
.kpi-sub{font-size:11px;color:#94a3b8;margin-top:4px}
.kpi-accent .kpi-val{color:#6366f1}
/* metric table */
table{width:100%;border-collapse:collapse;font-size:13px}
thead{background:#f8fafc}
th{text-align:left;padding:10px 14px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0}
th:last-child{text-align:right}
td{padding:10px 14px;color:#334155;border-bottom:1px solid #f8fafc}
.td-label{width:70%}
.td-val{text-align:right;font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums;white-space:nowrap}
.ml{font-size:13px;color:#334155}
.md{font-size:11px;color:#94a3b8;margin-top:2px;line-height:1.4}
tr:nth-child(even) td{background:#fafbfd}
/* narrative */
.nar-card{border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px}
.nar-text{font-size:13px;line-height:1.7;color:#475569;white-space:pre-wrap}
.nar-empty{font-size:12px;color:#cbd5e1;font-style:italic}
/* products */
.product-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc}
.product-item:last-child{border-bottom:none}
.product-name{font-size:13px;font-weight:500;color:#0f172a;flex:1;line-height:1.4}
.badges{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}
.badge{font-size:10px;font-weight:600;letter-spacing:.03em;padding:2px 8px;border-radius:999px;white-space:nowrap}
.badge-lang{background:#ede9fe;color:#6d28d9}
.badge-jewelry{background:#e0e7ff;color:#4338ca}
.badge-funnel{background:#f0fdf4;color:#166534}
.badge-week{background:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0}
.empty-note{font-size:12px;color:#cbd5e1;font-style:italic;padding:8px 0}
/* CSV / winners grid */
.csv-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.csv-card{border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px}
.csv-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px}
.csv-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:13px}
.csv-item:last-child{border-bottom:none}
.csv-name{font-weight:500;color:#0f172a;flex:1}
.csv-stat{font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums;margin-left:8px;white-space:nowrap}
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
    <span class="toolbar-brand">Myko Hub &middot; Monthly Report</span>
    <div class="toolbar-actions">
      <button class="btn btn-ghost" onclick="window.close()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">&#x1F5A8;&nbsp; Print / Save PDF</button>
    </div>
  </div>

  <div class="rh">
    <div class="rh-top">
      <div>
        <div class="rh-brand">Myko Hub &middot; Build &amp; Product Tracker</div>
        <div class="rh-title">Monthly Performance Report</div>
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
      <div class="sec-label">Executive Summary</div>
      <div class="sec-desc">Top-line numbers for the month. Use these in the opening paragraph of your report email to Abigél.</div>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-lbl">Builds Completed</div>
          <div class="kpi-val">${report.totalCompleted}</div>
          <div class="kpi-sub">${report.jewelryCompleted} jewelry · ${report.funnelCompleted} funnel</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Expanding</div>
          <div class="kpi-val">${report.winners}</div>
          <div class="kpi-sub">approved for scale-up</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Win Rate</div>
          <div class="kpi-val">${esc(report.winRate)}</div>
          <div class="kpi-sub">of all decided builds</div>
        </div>
        <div class="kpi kpi-accent">
          <div class="kpi-lbl">Test → Winner</div>
          <div class="kpi-val">${esc(report.testWinRate)}</div>
          <div class="kpi-sub">quality signal</div>
        </div>
      </div>
    </div>

    <!-- Narrative -->
    ${report.narrative?.narrative_text ? `
    <div class="section">
      <div class="sec-label">Monthly Narrative</div>
      <div class="sec-desc">Written summary for Abigél — the qualitative context behind the numbers.</div>
      <div class="nar-card">
        <div class="nar-text">${esc(report.narrative.narrative_text)}</div>
      </div>
    </div>` : ''}

    <!-- Metrics table -->
    <div class="section">
      <div class="sec-label">Full Metrics Breakdown</div>
      <div class="sec-desc">
        Complete data for the month. <em>Test → Winner (%)</em> is the strongest quality signal — it isolates products that actually entered testing and measures how many succeeded.
        <em>Win rate</em> includes all decided builds and can be skewed by early stops before testing.
      </div>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>${metricRows}</tbody>
      </table>
    </div>

    <!-- Expanding products -->
    <div class="section">
      <div class="sec-label">Expanding Products <span class="sec-count">(${report.expandingList.length})</span></div>
      <div class="sec-desc">Products that passed testing and were approved for scale-up. These are the wins of the month — include this list in your report as-is.</div>
      ${report.expandingList.length === 0
        ? `<p class="empty-note">No products decided as expanding this month.</p>`
        : `<div>${buildRows(report.expandingList)}</div>`}
    </div>

    <!-- Still testing -->
    ${report.testingList.length > 0 ? `
    <div class="section">
      <div class="sec-label">Still in Testing <span class="sec-count">(${report.testingList.length})</span></div>
      <div class="sec-desc">Products that entered testing but have not yet received a final decision. Follow up on these in the next cycle.</div>
      <div>${buildRows(report.testingList)}</div>
    </div>` : ''}

    <!-- Testing × Winning Products cross-reference -->
    ${testingWinners.length > 0 ? `
    <div class="section">
      <div class="sec-label">In Testing — Qualified &amp; Momentum Match <span class="sec-count">(${testingWinners.length})</span></div>
      <div class="sec-desc">Products currently in testing whose names match products highlighted in the Winning Products tab. These are the highest-priority testing builds — they are already proven market sellers. Monitor closely and prioritize decision-making.</div>
      <div>${buildRows(testingWinners)}</div>
    </div>` : ''}

    <!-- CSV winners -->
    ${hasCsv ? `
    <div class="section">
      <div class="sec-label">Winning Products from Analysis</div>
      <div class="sec-desc">Products shown in the Winning Products tab after applying the current filter thresholds. <em>Qualified Demand</em> = meets minimum sales volume and gross margin. <em>Momentum</em> = selling well and growing vs. the prior 7 days.</div>
      <div class="csv-grid">
        ${csvWinners.demand.length > 0 ? `
        <div class="csv-card">
          <div class="csv-lbl">Qualified Demand (${csvWinners.demand.length})</div>
          ${csvWinners.demand.map(p => `
            <div class="csv-item">
              <span class="csv-name">${esc(p.title)}</span>
              ${p.unitsSold != null ? `<span class="csv-stat">${p.unitsSold} sold/wk</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
        ${csvWinners.momentum.length > 0 ? `
        <div class="csv-card">
          <div class="csv-lbl">Momentum (${csvWinners.momentum.length})</div>
          ${csvWinners.momentum.map(p => `
            <div class="csv-item">
              <span class="csv-name">${esc(p.title)}</span>
              ${p.unitGrowthPct != null ? `<span class="csv-stat" style="color:#16a34a">+${p.unitGrowthPct}%</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
      </div>
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

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)
  const [csvWinners, setCsvWinners] = useState<{ demand: CsvProduct[]; momentum: CsvProduct[] }>({ demand: [], momentum: [] })
  const [winningTitles, setWinningTitles] = useState<Set<string>>(new Set())

  async function load() {
    const data = await api.get<MonthlyReport>(`/api/reports/monthly?month=${month}`)
    setReport(data)
    setNarrativeText(data.narrative?.narrative_text ?? '')
  }

  useRealtimeRefresh(['builds', 'mistakes', 'report_narratives'], load)
  useEffect(() => { load() }, [month])
  useEffect(() => { setCsvWinners(loadCsvWinners()) }, [])
  useEffect(() => { setWinningTitles(loadWinningTitles()) }, [])

  function openEdit() {
    setNarrativeText(report?.narrative?.narrative_text ?? '')
    setEditOpen(true)
  }

  async function saveNarrative() {
    setSaving(true)
    try {
      await api.put('/api/reports/narrative', {
        type: 'monthly',
        week_number: null,
        month_year: `${month}-01`,
        narrative_text: narrativeText,
      })
      setEditOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    if (!report) return
    const html = generateMonthlyHtml(month, report, csvWinners, testingWinners)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  const categoryBreakdown = report
    ? Object.entries(report.mistakesByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ') || '—'
    : '—'

  const rows: MetricRow[] = report ? [
    { label: 'Builds completed (went live)',      value: report.totalCompleted,      description: 'Total builds that reached a final decision.' },
    { label: '  · Jewelry (Shopify)',             value: report.jewelryCompleted,    description: 'Jewelry builds on Shopify.' },
    { label: '  · Funnel (Funnelish)',            value: report.funnelCompleted,     description: 'Funnel builds on Funnelish.' },
    { label: 'By week — W1/W2/W3/W4',            value: report.byWeek.join(' / '), description: 'Completed builds per week.' },
    { label: 'Expanding (decided)',               value: report.winners,             description: 'Products approved for scale-up.' },
    { label: 'Stopped',                           value: report.killed,              description: 'Products discontinued after testing.' },
    { label: 'Win rate (decided)',                value: report.winRate,             description: 'Expanding ÷ all decided builds.' },
    { label: 'Test → Winner (%)',                 value: report.testWinRate,         description: 'Of builds that entered testing, % that became expanding.' },
    { label: 'Build cycle avg (days)',            value: report.avgBuildDays ?? '—', description: 'Avg days from Phase 1 start to live.' },
    { label: 'Total pipeline avg (days)',         value: report.avgTotalDays ?? '—', description: 'Avg days from approval to decision.' },
    { label: 'Issues logged',                     value: report.mistakesTotal,       description: 'Quality issues in Issue Log.' },
    { label: '  · Repeating',                    value: report.mistakesRepeating,   description: 'Issues appearing in more than one build.' },
    { label: '  · By category',                  value: categoryBreakdown,          description: 'Breakdown by category.' },
    { label: '  · SOP updated',                  value: report.sopUpdated,          description: 'Issues with SOP updates.' },
  ] : []

  const columns: ResponsiveColumn<MetricRow>[] = [
    { key: 'metric', header: 'Metric', render: r => <span className="text-foreground">{r.label}</span> },
    { key: 'value',  header: 'Value',  align: 'right', mono: true, render: r => <span className="font-medium text-foreground">{r.value}</span> },
  ]

  const narrative = report?.narrative?.narrative_text ?? ''
  const hasCsv = csvWinners.demand.length > 0 || csvWinners.momentum.length > 0
  const testingWinners = report && winningTitles.size > 0
    ? report.testingList.filter(b => isWinnerMatch(b.product_name, winningTitles))
    : []

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        description="End-of-month summary for Abigél. Metrics auto-populated from trackers."
        actions={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={!report}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        }
      />

      {/* Metrics + narrative */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {!report ? (
          <p className="text-sm text-text-muted font-mono py-8">Loading…</p>
        ) : (
          <ResponsiveTable columns={columns} data={rows} rowKey={r => r.label} />
        )}

        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Monthly narrative</p>
              <Button variant="ghost" size="sm" onClick={openEdit}>
                {narrative ? 'Edit' : 'Add'}
              </Button>
            </div>
            {narrative ? (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{narrative}</p>
            ) : (
              <p className="text-sm text-text-muted italic">No narrative yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Expanding products */}
      {report && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Expanding Products
              {report.expandingList.length > 0 && (
                <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">({report.expandingList.length})</span>
              )}
            </h2>
          </div>
          <Card>
            <CardBody>
              {report.expandingList.length === 0 ? (
                <p className="text-sm text-text-muted italic">No products decided as expanding this month.</p>
              ) : (
                <div>
                  {report.expandingList.map((b, i) => <BuildRow key={i} b={b} />)}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Products in testing */}
      {report && report.testingList.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Still in Testing
              <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">({report.testingList.length})</span>
            </h2>
          </div>
          <Card>
            <CardBody>
              <div>
                {report.testingList.map((b, i) => <BuildRow key={i} b={b} />)}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Testing × Winning Products cross-reference */}
      {testingWinners.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              In Testing — Qualified & Momentum Match
              <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">({testingWinners.length})</span>
            </h2>
          </div>
          <Card>
            <CardBody>
              <p className="text-xs text-text-muted mb-3 leading-relaxed">
                Products currently in testing whose names match products shown in the Winning Products tab. These are the highest-priority testing builds to watch.
              </p>
              <div>
                {testingWinners.map((b, i) => <BuildRow key={i} b={b} />)}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* CSV winners */}
      {hasCsv && (
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
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Monthly narrative"
        description="End-of-month summary for Abigél."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={saveNarrative} disabled={saving}>
              {saving ? 'Saving…' : 'Save narrative'}
            </Button>
          </>
        }
      >
        <textarea
          rows={10}
          value={narrativeText}
          onChange={e => setNarrativeText(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
          placeholder="End-of-month summary for Abigél…"
        />
      </Modal>
    </div>
  )
}
