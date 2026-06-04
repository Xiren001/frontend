'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { WeekStats } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ReportNarrative { id: string; week_number: number; narrative_text: string }

export default function WeeklyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [weekStats, setWeekStats] = useState<WeekStats[]>([])
  const [narratives, setNarratives] = useState<ReportNarrative[]>([])
  const [saving, setSaving] = useState<number | null>(null)

  async function load() {
    const data = await api.get<{ weekStats: WeekStats[]; narratives: ReportNarrative[] }>(`/api/reports/weekly?month=${month}`)
    setWeekStats(data.weekStats)
    setNarratives(data.narratives)
  }

  useEffect(() => { load() }, [month])

  function getNarrative(week: number) {
    return narratives.find(n => n.week_number === week)?.narrative_text ?? ''
  }

  async function saveNarrative(week: number, text: string) {
    setSaving(week)
    await api.put('/api/reports/narrative', {
      type: 'weekly',
      week_number: week,
      month_year: `${month}-01`,
      narrative_text: text,
    })
    setSaving(null)
    load()
  }

  const METRICS: { key: keyof WeekStats; label: string }[] = [
    { key: 'logged', label: 'Builds logged' },
    { key: 'completed', label: 'Completed (live)' },
    { key: 'winners', label: 'Winners' },
    { key: 'killed', label: 'Killed' },
    { key: 'avgBuildDays', label: 'Avg build (days)' },
    { key: 'avgTotalDays', label: 'Avg total: approved → live (days)' },
  ]

  const monthTotal = (key: keyof WeekStats) => {
    const vals = weekStats.map(w => w[key] as number | null).filter((v): v is number => v !== null)
    if (vals.length === 0) return '—'
    if (key === 'avgBuildDays' || key === 'avgTotalDays') {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return Math.round(avg * 10) / 10
    }
    return vals.reduce((a, b) => a + b, 0)
  }

  return (
    <div>
      <PageHeader
        title="Weekly Report"
        description="Auto counts from trackers. Fill narrative cells each Friday — send by 2pm."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
        }
      />

      <Table className="mb-10">
        <TableHead>
          <TableRow>
            <TableHeader>Metric</TableHeader>
            {[1,2,3,4].map(w => <TableHeader key={w} className="text-center">Week {w}</TableHeader>)}
            <TableHeader className="text-center">Month</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {METRICS.map(m => (
            <TableRow key={m.key}>
              <TableCell className="text-foreground">{m.label}</TableCell>
              {weekStats.map(w => (
                <TableCell key={w.week} mono className="text-center text-foreground">
                  {w[m.key] ?? '—'}
                </TableCell>
              ))}
              <TableCell mono className="text-center font-medium text-foreground">{monthTotal(m.key)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1,2,3,4].map(w => (
          <Card key={w}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Week {w} — narrative</p>
              <NarrativeField
                value={getNarrative(w)}
                onSave={text => saveNarrative(w, text)}
                saving={saving === w}
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

function NarrativeField({ value, onSave, saving }: { value: string; onSave: (t: string) => void; saving: boolean }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <div>
      <textarea
        rows={4}
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
        placeholder="Notes for Abigél…"
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onSave(text)}
        disabled={saving}
        className="mt-2"
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
