'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'

type Track = 'ads' | 'web_dev'

interface PersonRow {
  name: string
  counts: Record<string, number>
  total: number
}

interface TeamPerformanceData {
  weeks: string[]
  people: PersonRow[]
}

const WEEKS_SHOWN = 10

function fmtWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function Sheet({ data, emptyLabel }: { data: TeamPerformanceData | null; emptyLabel: string }) {
  if (!data) return <div className="flex items-center justify-center h-64 text-text-muted text-sm">Loading…</div>
  if (!data.people.length) return <p className="text-sm text-text-muted">{emptyLabel}</p>

  return (
    <Table containerClassName="max-h-[70vh]">
      <TableHead>
        <TableRow>
          <TableHeader className="sticky left-0 z-20 bg-surface border-r border-border-subtle min-w-[160px]">Name</TableHeader>
          {data.weeks.map(w => (
            <TableHeader key={w} className="text-center border-r border-border-subtle whitespace-nowrap">{fmtWeek(w)}</TableHeader>
          ))}
          <TableHeader className="text-center font-semibold">Total</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.people.map(person => (
          <TableRow key={person.name}>
            <TableCell className="sticky left-0 z-10 bg-surface-elevated border-r border-border-subtle font-medium">
              {person.name}
            </TableCell>
            {data.weeks.map(w => (
              <TableCell key={w} mono className={cn('text-center border-r border-border-subtle tabular-nums', !person.counts[w] && 'text-text-muted')}>
                {person.counts[w] ?? 0}
              </TableCell>
            ))}
            <TableCell mono className="text-center font-semibold tabular-nums">{person.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function TeamPerformancePage() {
  const [track, setTrack] = useState<Track>('ads')
  const [data, setData] = useState<TeamPerformanceData | null>(null)

  const load = useCallback((t: Track) => {
    setData(null)
    api.get<TeamPerformanceData>(`/api/monday/team-performance?track=${t}&weeks=${WEEKS_SHOWN}`)
      .then(setData)
      .catch(() => setData({ weeks: [], people: [] }))
  }, [])

  useEffect(() => { load(track) }, [track, load])

  return (
    <div>
      <PageHeader
        title="Team Performance"
        description="Weekly output per person — ads editors by subitems produced under their assigned items, web dev by subitems built. Counts start from when this page went live."
      />

      <Tabs
        tabs={[
          { id: 'ads', label: 'Ads Editors' },
          { id: 'web_dev', label: 'Web Dev' },
        ]}
        active={track}
        onChange={id => setTrack(id as Track)}
        className="mb-4"
      />

      <Sheet
        data={data}
        emptyLabel={track === 'ads'
          ? 'No ads performance logged yet — counts appear once new ad subitems are created under an assigned item.'
          : 'No web dev performance logged yet — counts appear once a subitem’s Website Status changes to "Building - <name>".'}
      />
    </div>
  )
}
