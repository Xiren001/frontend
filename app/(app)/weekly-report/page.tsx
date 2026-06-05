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
import { TrendingUp, FlaskConical } from 'lucide-react'

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

export default function WeeklyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [weekStats, setWeekStats] = useState<WeekStats[]>([])
  const [narratives, setNarratives] = useState<ReportNarrative[]>([])
  const [editWeek, setEditWeek] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await api.get<{ weekStats: WeekStats[]; narratives: ReportNarrative[] }>(`/api/reports/weekly?month=${month}`)
    setWeekStats(data.weekStats)
    setNarratives(data.narratives)
  }

  useRealtimeRefresh(['builds', 'mistakes', 'report_narratives'], load)
  useEffect(() => { load() }, [month])

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

  const METRICS: { key: keyof WeekStats; label: string }[] = [
    { key: 'logged', label: 'Builds logged' },
    { key: 'completed', label: 'Completed (live)' },
    { key: 'winners', label: 'Expanding' },
    { key: 'killed', label: 'Stopped' },
    { key: 'mistakes', label: 'Issues' },
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

  const hasAnyExpanding = weekStats.some(w => (w.expandingBuilds?.length ?? 0) > 0)
  const hasAnyTesting   = weekStats.some(w => (w.testingBuilds?.length ?? 0) > 0)

  return (
    <div>
      <PageHeader
        title="Weekly Report"
        description="Auto counts from trackers. Fill narrative cells each Friday — send by 2pm."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
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

      {/* ── Expanding products by week ── */}
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
                  <BuildList
                    builds={w.expandingBuilds ?? []}
                    emptyText="None this week"
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Products still testing by week ── */}
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
                  <BuildList
                    builds={w.testingBuilds ?? []}
                    emptyText="None this week"
                  />
                </CardBody>
              </Card>
            ))}
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
