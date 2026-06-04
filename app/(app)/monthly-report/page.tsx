'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  narrative: { narrative_text: string } | null
}

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await api.get<MonthlyReport>(`/api/reports/monthly?month=${month}`)
    setReport(data)
    setNarrativeText(data.narrative?.narrative_text ?? '')
  }

  useEffect(() => { load() }, [month])

  async function saveNarrative() {
    setSaving(true)
    await api.put('/api/reports/narrative', {
      type: 'monthly',
      week_number: null,
      month_year: `${month}-01`,
      narrative_text: narrativeText,
    })
    setSaving(false)
  }

  const rows = report ? [
    ['Builds completed (went live)', report.totalCompleted],
    ['  · Jewelry (Shopify)', report.jewelryCompleted],
    ['  · Funnel (Funnelish)', report.funnelCompleted],
    ['Completed by week — W1/W2/W3/W4', report.byWeek.join(' / ')],
    ['Winners decided', report.winners],
    ['Killed', report.killed],
    ['Win rate (decided)', report.winRate],
    ['Build cycle avg (days)', report.avgBuildDays ?? '—'],
    ['Total pipeline avg (days)', report.avgTotalDays ?? '—'],
  ] : []

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
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Metric</TableHeader>
              <TableHeader className="text-right">Value</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(([label, val], i) => (
              <TableRow key={i}>
                <TableCell className="text-foreground">{label}</TableCell>
                <TableCell mono className="text-right font-medium text-foreground">{val}</TableCell>
              </TableRow>
            ))}
            {!report && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-text-muted py-8">Loading…</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Monthly narrative</p>
            <textarea
              rows={10}
              value={narrativeText}
              onChange={e => setNarrativeText(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
              placeholder="End-of-month summary for Abigél…"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={saveNarrative}
              disabled={saving}
              className="mt-3"
            >
              {saving ? 'Saving…' : 'Save narrative'}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
