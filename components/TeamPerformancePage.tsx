'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { cn } from '@/lib/utils'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/modal'

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

interface SubitemDetail {
  monday_subitem_id: string
  product_name: string
  days: number | null
}

interface WeekDetail {
  subitems: SubitemDetail[]
  averageDays: number | null
}

const WEEKS_SHOWN = 10

function fmtWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function Sheet({ data, emptyLabel, onCellClick }: {
  data: TeamPerformanceData | null
  emptyLabel: string
  onCellClick: (person: string, week: string) => void
}) {
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
            {data.weeks.map(w => {
              const count = person.counts[w] ?? 0
              return (
                <TableCell
                  key={w}
                  mono
                  onClick={count ? () => onCellClick(person.name, w) : undefined}
                  className={cn(
                    'text-center border-r border-border-subtle tabular-nums',
                    !count && 'text-text-muted',
                    count > 0 && 'cursor-pointer hover:bg-surface-hover transition-colors',
                  )}
                >
                  {count}
                </TableCell>
              )
            })}
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
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  const [detailFor, setDetailFor] = useState<{ person: string; week: string } | null>(null)
  const [detail, setDetail] = useState<WeekDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const load = useCallback((t: Track) => {
    setData(null)
    api.get<TeamPerformanceData>(`/api/monday/team-performance?track=${t}&weeks=${WEEKS_SHOWN}`)
      .then(setData)
      .catch(() => setData({ weeks: [], people: [] }))
  }, [])

  useEffect(() => { load(track) }, [track, load])

  useRealtimeRefresh('team_performance_events', () => load(track))

  function openDetail(person: string, week: string) {
    setDetailFor({ person, week })
    setDetail(null)
    setDetailError(null)
    api.get<WeekDetail>(`/api/monday/team-performance/detail?track=${track}&person=${encodeURIComponent(person)}&week=${week}`)
      .then(setDetail)
      .catch(err => setDetailError(err instanceof Error ? err.message : 'Failed to load'))
  }

  async function scanExistingData() {
    setScanning(true)
    setScanMsg(null)
    try {
      const result = await api.post<{ alreadyRan: boolean; ads?: number; webDev?: number }>('/api/monday/team-performance/backfill', {})
      setScanMsg(result.alreadyRan
        ? 'Already scanned once before — this only runs the first time.'
        : `Seeded ${result.ads ?? 0} ads and ${result.webDev ?? 0} web dev events into this week.`)
      load(track)
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Team Performance"
        description="Weekly output per person — ads editors by subitems produced under their assigned items, web dev by subitems built. Counts start from when this page went live."
        actions={
          <button
            onClick={scanExistingData}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
            title="One-time: seed this week's counts from Monday's current state"
          >
            <RefreshCw size={11} className={cn(scanning && 'animate-spin')} />
            {scanning ? 'Scanning…' : 'Scan Existing Data'}
          </button>
        }
      />

      {scanMsg && <p className="text-xs text-text-muted mb-4">{scanMsg}</p>}

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
        onCellClick={openDetail}
      />

      <Modal
        open={!!detailFor}
        onClose={() => setDetailFor(null)}
        title={detailFor ? `${detailFor.person} — week of ${fmtWeek(detailFor.week)}` : ''}
        description={track === 'ads'
          ? 'Ad variants made this week, and how long each took from creation to concluded.'
          : 'Subitems built this week, and how long each took from building to launched.'}
      >
        {detailError && <p className="text-sm text-red-500">{detailError}</p>}
        {!detailError && !detail && <p className="text-sm text-text-muted">Loading…</p>}
        {!detailError && detail && !detail.subitems.length && (
          <p className="text-sm text-text-muted">Nothing found for this week.</p>
        )}
        {!detailError && detail && !!detail.subitems.length && (
          <div className="space-y-3">
            <ul className="divide-y divide-border-subtle">
              {detail.subitems.map(s => (
                <li key={s.monday_subitem_id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-foreground">{s.product_name}</span>
                  <span className={cn('font-mono text-xs whitespace-nowrap', s.days === null ? 'text-text-muted' : 'text-text-secondary')}>
                    {s.days === null ? 'In progress' : `${s.days} day${s.days === 1 ? '' : 's'}`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-sm font-medium">
              <span>Average</span>
              <span className="font-mono text-xs">
                {detail.averageDays === null ? 'No completed items yet' : `${detail.averageDays} day${detail.averageDays === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
