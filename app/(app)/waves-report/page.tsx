'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

interface WavesWeeklyReport {
  weekStart: string
  weekEnd: string
  productsTestedFullSet: number
  avgSpotToEnLaunch: number | null
  avgDaysProofread: number | null
  avgEnToOthersLaunch: number | null
  wave1ProofreadQueue: number
  wave2to7ProofreadQueue: number
  pctTestedToWave2: number | null
  avgDaysWaveToAllDone: number | null
  newLangsThisWeek: number
  avgLangsPerActive: number | null
  deepestWinner: { name: string; count: number } | null
  smallWinners: number
  mediumWinners: number
  bigWinners: number
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatWeekRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n * 7)
  return toDateStr(getMondayOfWeek(d))
}

const PRESETS = [
  { label: 'This week', offset: 0 },
  { label: 'Last week', offset: -1 },
  { label: '2 weeks ago', offset: -2 },
  { label: '3 weeks ago', offset: -3 },
  { label: '4 weeks ago', offset: -4 },
  { label: '6 weeks ago', offset: -6 },
  { label: '8 weeks ago', offset: -8 },
]

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function WeekPicker({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (weekStart: string) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(selected + 'T00:00:00')
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selected + 'T00:00:00')
    return d.getMonth()
  })

  const todayMonday = toDateStr(getMondayOfWeek(today))

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1)
  // Monday-first: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // Fill grid to complete weeks
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null)
    else cells.push(new Date(viewYear, viewMonth, dayNum))
  }

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  function getWeekMonday(weekRow: (Date | null)[]): string | null {
    const firstReal = weekRow.find(d => d !== null)
    if (!firstReal) return null
    return toDateStr(getMondayOfWeek(firstReal))
  }

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="w-[260px]">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground">{monthName}</span>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-text-muted py-1">{d}</div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const weekMonday = getWeekMonday(week)
        const isSelected = weekMonday === selected
        const isFuture = weekMonday ? weekMonday > todayMonday : false

        return (
          <button
            key={wi}
            disabled={isFuture || !weekMonday}
            onClick={() => weekMonday && onSelect(weekMonday)}
            className={[
              'grid grid-cols-7 w-full rounded-lg mb-0.5 transition-colors',
              isFuture
                ? 'opacity-30 cursor-not-allowed'
                : isSelected
                  ? 'bg-foreground text-background'
                  : 'hover:bg-surface-hover',
            ].join(' ')}
          >
            {week.map((day, di) => (
              <div
                key={di}
                className={[
                  'text-center text-sm py-1.5',
                  !day ? 'text-transparent' : isSelected ? 'text-background' : 'text-foreground',
                ].join(' ')}
              >
                {day?.getDate() ?? '·'}
              </div>
            ))}
          </button>
        )
      })}
    </div>
  )
}

function DateFilter({
  weekStart,
  report,
  onChange,
}: {
  weekStart: string
  report: WavesWeeklyReport | null
  onChange: (ws: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(weekStart)
  const ref = useRef<HTMLDivElement>(null)

  const todayMonday = toDateStr(getMondayOfWeek(new Date()))
  const activePreset = PRESETS.find(p => addWeeks(todayMonday, p.offset) === weekStart)

  // Sync pending when parent weekStart changes externally (shouldn't normally happen)
  useEffect(() => { setPending(weekStart) }, [weekStart])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function apply() {
    onChange(pending)
    setOpen(false)
  }

  function cancel() {
    setPending(weekStart)
    setOpen(false)
  }

  const displayLabel = report
    ? formatWeekRange(report.weekStart, report.weekEnd)
    : weekStart

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setPending(weekStart); setOpen(o => !o) }}
        className={[
          'flex items-center gap-2 h-9 pl-3 pr-3 rounded-lg border text-sm font-medium transition-colors',
          open
            ? 'border-foreground bg-surface-elevated text-foreground'
            : 'border-border-subtle bg-surface-elevated text-foreground hover:bg-surface-hover',
        ].join(' ')}
      >
        <CalendarDays className="h-4 w-4 text-text-muted shrink-0" />
        <span className="whitespace-nowrap">{displayLabel}</span>
        {activePreset && activePreset.offset !== 0 && (
          <span className="text-text-muted font-normal">· {activePreset.label}</span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-surface-elevated border border-border-subtle rounded-xl shadow-xl p-4 min-w-max">
          <div className="flex flex-col sm:flex-row gap-0">
            {/* Presets sidebar */}
            <div className="sm:w-44 sm:border-r border-border-subtle sm:pr-4 mb-3 sm:mb-0 sm:mr-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">Quick select</p>
              {PRESETS.map(p => {
                const ws = addWeeks(todayMonday, p.offset)
                const isActive = pending === ws
                return (
                  <button
                    key={p.offset}
                    onClick={() => setPending(ws)}
                    className={[
                      'w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors',
                      isActive
                        ? 'bg-foreground text-background font-medium'
                        : 'text-foreground hover:bg-surface-hover',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Calendar */}
            <WeekPicker selected={pending} onSelect={setPending} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-subtle">
            <button
              onClick={cancel}
              className="px-4 py-1.5 text-sm rounded-lg border border-border-subtle text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={apply}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  dimmed,
}: {
  label: string
  value: string | number | null
  sub?: string
  dimmed?: boolean
}) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 leading-tight">
        {label}
      </p>
      <p className={`text-3xl font-semibold leading-none ${dimmed ? 'text-text-muted' : 'text-foreground'}`}>
        {value === null ? '—' : value}
      </p>
      {sub && <p className="text-xs text-text-muted mt-2 leading-snug">{sub}</p>}
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mt-8 mb-3">
      {title}
    </h2>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 animate-pulse">
      <div className="h-3 w-28 bg-surface-hover rounded mb-3" />
      <div className="h-8 w-16 bg-surface-hover rounded" />
      <div className="h-3 w-36 bg-surface-hover rounded mt-2" />
    </div>
  )
}

export default function WavesReportPage() {
  const [weekStart, setWeekStart] = useState(() => toDateStr(getMondayOfWeek(new Date())))
  const [report, setReport] = useState<WavesWeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<WavesWeeklyReport>(`/api/monday/waves-weekly-report?weekStart=${weekStart}`)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [weekStart])

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Waves Weekly Report</h1>
          <p className="text-sm text-text-muted mt-0.5">Performance metrics across all waves</p>
        </div>
        <DateFilter weekStart={weekStart} report={report} onChange={setWeekStart} />
      </div>

      {error && (
        <div className="mt-4 bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <>
          {[4, 1, 4, 4, 2].map((count, si) => (
            <div key={si}>
              <div className="h-3 w-32 bg-surface-hover rounded mt-8 mb-3 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </>
      ) : report ? (
        <>
          {/* Testing Pipeline */}
          <Section title="Testing Pipeline" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Products Tested"
              value={report.productsTestedFullSet}
              sub="Landing page status: Launched"
            />
            <MetricCard
              label="Avg Days: EN Phase 1 (Wave 1)"
              value={report.avgSpotToEnLaunch !== null ? `${report.avgSpotToEnLaunch}d` : null}
              sub="Phase 1 duration for EN/English subitems"
            />
            <MetricCard
              label="Avg Days in Proofread"
              value={report.avgDaysProofread !== null ? `${report.avgDaysProofread}d` : null}
              sub="Proofread phase duration"
            />
            <MetricCard
              label="Avg Days: Non-EN Phase 1 (Wave 1)"
              value={report.avgEnToOthersLaunch !== null ? `${report.avgEnToOthersLaunch}d` : null}
              sub="Phase 1 duration for DE, ES and other langs"
            />
          </div>

          {/* Proofread Queue */}
          <Section title="Proofread Queue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Waiting in Queue (Wave 1)"
              value={report.wave1ProofreadQueue}
              sub="Wave 1 subitems awaiting proofread"
            />
            <MetricCard
              label="Waiting in Queue (Waves 2–7)"
              value={report.wave2to7ProofreadQueue}
              sub="Waves 2–7 subitems awaiting proofread"
            />
          </div>

          {/* Wave Progression */}
          <Section title="Wave Progression" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Tested → Wave 2+"
              value={report.pctTestedToWave2 !== null ? `${report.pctTestedToWave2}%` : null}
              sub="Of Wave 1+2 launched products"
            />
            <MetricCard
              label="Wave → All 3 Done"
              value={report.avgDaysWaveToAllDone !== null ? `${report.avgDaysWaveToAllDone}d` : null}
              sub="Avg days: arrival → EN+ES+DE live"
            />
            <MetricCard
              label="New Languages This Week"
              value={report.newLangsThisWeek}
              sub="Launched during this week"
            />
            <MetricCard
              label="Avg Languages / Active Product"
              value={report.avgLangsPerActive ?? null}
              sub="Products with ≥1 active language"
            />
          </div>

          {/* Active Winners */}
          <Section title="Active Winners" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Deepest Winner"
              value={report.deepestWinner?.count ?? null}
              sub={report.deepestWinner?.name ?? 'Most languages live'}
            />
            <MetricCard
              label="Small Winners (≥1 lang)"
              value={report.smallWinners}
              sub="Active products, 1+ language"
            />
            <MetricCard
              label="Medium Winners (≥8 langs)"
              value={report.mediumWinners}
              sub="Active products, 8+ languages"
            />
            <MetricCard
              label="Big Winners (≥16 langs)"
              value={report.bigWinners}
              sub="Active products, 16+ languages"
            />
          </div>

          {/* Revenue */}
          <Section title="Revenue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="% Launches Profitable"
              value={null}
              sub="No revenue data available"
              dimmed
            />
            <MetricCard
              label="Avg Revenue / Active Winner"
              value={null}
              sub="No revenue data available"
              dimmed
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
