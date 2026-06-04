'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Modal } from '@/components/ui/modal'

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
  narrative: { narrative_text: string } | null
}

interface MetricRow {
  label: string
  value: string | number
}

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await api.get<MonthlyReport>(`/api/reports/monthly?month=${month}`)
    setReport(data)
    setNarrativeText(data.narrative?.narrative_text ?? '')
  }

  useEffect(() => { load() }, [month])

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
    {
      key: 'metric',
      header: 'Metric',
      render: r => <span className="text-foreground">{r.label}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      mono: true,
      render: r => <span className="font-medium text-foreground">{r.value}</span>,
    },
  ]

  const narrative = report?.narrative?.narrative_text ?? ''

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        description="End-of-month summary for Abigél. Metrics auto-populated from trackers."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!report ? (
          <p className="text-sm text-text-muted font-mono py-8">Loading…</p>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={rows}
            rowKey={r => r.label}
          />
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
