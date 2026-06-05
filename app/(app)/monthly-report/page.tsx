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
import { TrendingUp, FlaskConical, Trophy } from 'lucide-react'

interface MonthlyReport {
  totalCompleted: number
  jewelryCompleted: number
  funnelCompleted: number
  byWeek: number[]
  winners: number
  killed: number
  winRate: string
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

interface MetricRow { label: string; value: string | number }

interface CsvProduct { title: string; unitsSold?: number; unitGrowthPct?: number }

function loadCsvWinners(): { demand: CsvProduct[]; momentum: CsvProduct[] } {
  const parse = (key: string): CsvProduct[] => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const stored = JSON.parse(raw) as { rows: CsvProduct[] }
      return stored.rows ?? []
    } catch { return [] }
  }
  return { demand: parse('wp-demand'), momentum: parse('wp-momentum') }
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

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)
  const [csvWinners, setCsvWinners] = useState<{ demand: CsvProduct[]; momentum: CsvProduct[] }>({ demand: [], momentum: [] })

  async function load() {
    const data = await api.get<MonthlyReport>(`/api/reports/monthly?month=${month}`)
    setReport(data)
    setNarrativeText(data.narrative?.narrative_text ?? '')
  }

  useRealtimeRefresh(['builds', 'mistakes', 'report_narratives'], load)
  useEffect(() => { load() }, [month])
  useEffect(() => { setCsvWinners(loadCsvWinners()) }, [])

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

  const categoryBreakdown = report
    ? Object.entries(report.mistakesByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ') || '—'
    : '—'

  const rows: MetricRow[] = report ? [
    { label: 'Builds completed (went live)', value: report.totalCompleted },
    { label: '  · Jewelry (Shopify)', value: report.jewelryCompleted },
    { label: '  · Funnel (Funnelish)', value: report.funnelCompleted },
    { label: 'Completed by week — W1/W2/W3/W4', value: report.byWeek.join(' / ') },
    { label: 'Expanding (decided)', value: report.winners },
    { label: 'Stopped', value: report.killed },
    { label: 'Win rate (decided)', value: report.winRate },
    { label: 'Build cycle avg (days)', value: report.avgBuildDays ?? '—' },
    { label: 'Total pipeline avg (days)', value: report.avgTotalDays ?? '—' },
    { label: 'Issues logged', value: report.mistakesTotal },
    { label: '  · Repeating', value: report.mistakesRepeating },
    { label: '  · By category', value: categoryBreakdown },
    { label: '  · SOP updated', value: report.sopUpdated },
  ] : []

  const columns: ResponsiveColumn<MetricRow>[] = [
    { key: 'metric', header: 'Metric', render: r => <span className="text-foreground">{r.label}</span> },
    { key: 'value', header: 'Value', align: 'right', mono: true, render: r => <span className="font-medium text-foreground">{r.value}</span> },
  ]

  const narrative = report?.narrative?.narrative_text ?? ''
  const hasCsv = csvWinners.demand.length > 0 || csvWinners.momentum.length > 0

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        description="End-of-month summary for Abigél. Metrics auto-populated from trackers."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
        }
      />

      {/* ── Metrics + narrative ── */}
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

      {/* ── Expanding products ── */}
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

      {/* ── Products in testing ── */}
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

      {/* ── Winning products from CSV analysis ── */}
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
