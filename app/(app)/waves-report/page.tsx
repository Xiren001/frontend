'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

interface WavesWeeklyReport {
  weekStart: string
  weekEnd: string
  wave1Total: number
  wave1ToWave2Count: number
  pctWave1ToWave2: number | null
  productsTested: number
  avgDaysSpotToEnTest: number | null
  avgDaysProofread: number | null
  avgDaysEnToOthers: number | null
  proofreadQueue: number
  newWaveCampaignAvgDays: { wave: number; avg: number | null }[]
  avgLangsPerProduct: number | null
  mostLangsProduct: { name: string; count: number } | null
  activeWinners: { small: number; medium: number; big: number }
  proofreadQueueWaves27: number
  profitableLaunchPct: number | null
  profitableLaunches: number
  totalLaunches: number
  salesDataUpdatedAt: string | null
  avgRevenuePerWinner: number | null
  activeWinnerCount: number
  productSalesUpdatedAt: string | null
  teamQueue: {
    wave1:   { ad: Record<string, number>; web: Record<string, number> }
    waves27: { ad: Record<string, number>; web: Record<string, number> }
  }
  newLanguagesLaunchedThisWeek: number
  newLanguagesLaunchedList: { product: string; language: string }[]
  isSnapshot: boolean
}

const WAVE_LANG_LABELS: Record<number, { code: string; name: string }[]> = {
  2: [{ code: 'FR', name: 'French' }, { code: 'NL', name: 'Dutch' }, { code: 'IT', name: 'Italian' }],
  3: [{ code: 'FI', name: 'Finnish' }, { code: 'SE', name: 'Swedish' }, { code: 'NO', name: 'Norwegian' }],
  4: [{ code: 'IL', name: 'Hebrew' }, { code: 'BR', name: 'Portuguese' }, { code: 'JP', name: 'Japanese' }],
  5: [{ code: 'DK', name: 'Danish' }, { code: 'CZ', name: 'Czech' }, { code: 'PL', name: 'Polish' }],
  6: [{ code: 'TR', name: 'Turkish' }, { code: 'LT', name: 'Lithuanian' }, { code: 'EE', name: 'Estonian' }],
  7: [{ code: 'SK', name: 'Slovak' }, { code: 'SI', name: 'Slovenian' }, { code: 'RO', name: 'Romanian' }],
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}K`
  return `€${n.toLocaleString()}`
}

function formatRelativeDate(isoStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
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

function monthStartOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(monthStartStr: string, n: number): string {
  const d = new Date(monthStartStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return toDateStr(monthStartOf(d))
}

function formatMonthRange(monthStartISO: string): string {
  const d = new Date(monthStartISO)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
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

const MONTH_PRESETS = [
  { label: 'This month', offset: 0 },
  { label: 'Last month', offset: -1 },
  { label: '2 months ago', offset: -2 },
  { label: '3 months ago', offset: -3 },
  { label: '6 months ago', offset: -6 },
]

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
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

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-text-muted py-1">{d}</div>
        ))}
      </div>

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

function MonthPicker({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (monthStart: string) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(() => new Date(selected + 'T00:00:00').getFullYear())

  const todayMonthStart = toDateStr(monthStartOf(today))

  return (
    <div className="w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewYear(y => y - 1)}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground">{viewYear}</span>
        <button
          onClick={() => setViewYear(y => y + 1)}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_NAMES.map((name, i) => {
          const ms = `${viewYear}-${String(i + 1).padStart(2, '0')}-01`
          const isSelected = ms === selected
          const isFuture = ms > todayMonthStart

          return (
            <button
              key={name}
              disabled={isFuture}
              onClick={() => onSelect(ms)}
              className={[
                'text-center text-sm py-1.5 rounded-lg transition-colors',
                isFuture
                  ? 'opacity-30 cursor-not-allowed text-foreground'
                  : isSelected
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-surface-hover',
              ].join(' ')}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateFilter({
  period,
  selected,
  report,
  onChange,
}: {
  period: 'week' | 'month'
  selected: string
  report: WavesWeeklyReport | null
  onChange: (start: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(selected)
  const ref = useRef<HTMLDivElement>(null)

  const todayStart = period === 'month'
    ? toDateStr(monthStartOf(new Date()))
    : toDateStr(getMondayOfWeek(new Date()))
  const presets = period === 'month' ? MONTH_PRESETS : PRESETS
  const addFn = period === 'month' ? addMonths : addWeeks
  const activePreset = presets.find(p => addFn(todayStart, p.offset) === selected)

  useEffect(() => { setPending(selected) }, [selected])

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
    setPending(selected)
    setOpen(false)
  }

  const displayLabel = report
    ? (period === 'month' ? formatMonthRange(report.weekStart) : formatWeekRange(report.weekStart, report.weekEnd))
    : selected

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setPending(selected); setOpen(o => !o) }}
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

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-surface-elevated border border-border-subtle rounded-xl shadow-xl p-4 min-w-max">
          <div className="flex flex-col sm:flex-row gap-0">
            <div className="sm:w-44 sm:border-r border-border-subtle sm:pr-4 mb-3 sm:mb-0 sm:mr-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">Quick select</p>
              {presets.map(p => {
                const s = addFn(todayStart, p.offset)
                const isActive = pending === s
                return (
                  <button
                    key={p.offset}
                    onClick={() => setPending(s)}
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
            {period === 'month'
              ? <MonthPicker selected={pending} onSelect={setPending} />
              : <WeekPicker selected={pending} onSelect={setPending} />}
          </div>

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
  valueNote,
  sub,
  dimmed,
  description,
  onClick,
}: {
  label: string
  value: string | number | null
  valueNote?: string | number
  sub?: string
  dimmed?: boolean
  description?: string
  onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={[
        'relative group bg-surface-elevated border border-border-subtle rounded-xl p-5 text-left w-full',
        onClick ? 'cursor-pointer hover:border-foreground/30 hover:bg-surface-hover transition-colors' : '',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 leading-tight pr-5">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className={`text-3xl font-semibold leading-none ${dimmed ? 'text-text-muted' : 'text-foreground'}`}>
          {value === null ? '—' : value}
        </p>
        {valueNote !== undefined && (
          <span className="text-sm text-text-muted">{valueNote}</span>
        )}
      </div>
      {sub && <p className="text-xs text-text-muted mt-2 leading-snug">{sub}</p>}

      {description && (
        <>
          <div className="absolute top-4 right-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <Info className="h-3.5 w-3.5" />
          </div>
          <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
              {description}
            </div>
          </div>
        </>
      )}
    </Wrapper>
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

function NewLanguagesModal({
  open,
  onClose,
  period,
  list,
}: {
  open: boolean
  onClose: () => void
  period: 'week' | 'month'
  list: { product: string; language: string }[]
}) {
  const grouped = list.reduce<Record<string, string[]>>((acc, { product, language }) => {
    (acc[product] ??= []).push(language)
    return acc
  }, {})
  const products = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`New Languages Launched This ${period === 'month' ? 'Month' : 'Week'}`}
      description="Across all products, all waves"
      size="md"
    >
      {products.length === 0 ? (
        <p className="text-sm text-text-muted">No new languages launched.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map(product => (
            <div key={product} className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{product}</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {grouped[product].sort().map((lang, i) => (
                  <span
                    key={`${lang}-${i}`}
                    className="text-[10px] font-mono bg-surface-page border border-border-subtle rounded px-1.5 py-0.5 text-foreground whitespace-nowrap"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

const STATUS_EXPLANATIONS: { test: (s: string) => boolean; text: string }[] = [
  { test: s => s === 'waiting for editor', text: 'The ad is finished and is waiting for a video/creative editor to start working on it.' },
  { test: s => s === 'waiting for builder', text: 'The website page is waiting for a web builder to start building it.' },
  { test: s => /^building\s*-\s*.+/.test(s), text: 'A web builder is actively building this website page right now.' },
  { test: s => s === 'waiting for proofread', text: 'The page has been built and is now waiting for a proofreader to check the wording/translation.' },
  { test: s => s === 'proofread done', text: 'Proofreading is finished and the page passed the check.' },
  { test: s => s === 'ready for revision' || s === 'revisions needed' || s === 'need revision', text: 'Someone reviewed this and found issues — it has been sent back for fixes.' },
  { test: s => s === 'not started yet' || s === 'not set' || s === '', text: 'No work has been started on this item yet.' },
  { test: s => s === 'in progress' || s === 'working on it', text: 'Someone on the team is actively working on this right now.' },
  { test: s => s === 'ready', text: 'The work is finished and ready to move to the next step.' },
  { test: s => s === 'ready to launch', text: 'Everything is done — this is just waiting for the go-ahead to go live.' },
  { test: s => s === 'launched' || s === 'running', text: 'This is live and currently active.' },
  { test: s => s === 'expanding', text: 'This is performing well and the team is scaling it up further.' },
  { test: s => s === 'relaunch' || s === 'relaunching', text: 'This was paused before and is being brought back online.' },
  { test: s => s === 'stopped', text: 'This was paused or pulled and is not currently running.' },
  { test: s => s === 'banned', text: 'This was blocked by the platform (e.g. Facebook/Google) and cannot run as-is.' },
  { test: s => s === 'do not start', text: 'The team has decided not to start work on this.' },
  { test: s => s.includes('waiting'), text: 'This item is waiting on someone else before work can continue.' },
  { test: s => s.includes('proof'), text: 'This is somewhere in the proofreading/content-check step.' },
  { test: s => s.includes('test'), text: 'This is currently being tested.' },
]

function explainStatus(status: string) {
  const s = status.trim().toLowerCase()
  return STATUS_EXPLANATIONS.find(({ test }) => test(s))?.text
    ?? `"${status}" is a status set directly in Monday.com — ask your team lead what it means if you're not sure.`
}

function TeamQueueGroup({ team, entries, openKey, onToggle }: {
  team: string
  entries: [string, number][]
  openKey: string | null
  onToggle: (key: string) => void
}) {
  return (
    <div className="bg-surface-page border border-border-subtle rounded-lg p-4">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">{team}</p>
      <div className="flex flex-col gap-1">
        {entries.map(([status, count]) => {
          const key = `${team}-${status}`
          const isOpen = openKey === key
          return (
            <div key={status} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => onToggle(key)}
                className="w-full flex items-center justify-between gap-2 min-w-0 py-2 text-left"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                  <span className="text-sm text-foreground truncate">{status}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">{count}</span>
              </button>
              {isOpen && (
                <p className="text-sm text-text-muted leading-relaxed pb-3 pl-[22px] pr-2">
                  {explainStatus(status)}
                </p>
              )}
            </div>
          )
        })}
        {entries.length === 0 && <span className="text-sm text-text-muted">All clear</span>}
      </div>
    </div>
  )
}

function TeamQueueCard({ teamQueue }: {
  teamQueue: {
    wave1:   { ad: Record<string, number>; web: Record<string, number> }
    waves27: { ad: Record<string, number>; web: Record<string, number> }
  }
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const sorted = (map: Record<string, number>) =>
    Object.entries(map).sort(([, a], [, b]) => b - a)
  const merge = (a: Record<string, number>, b: Record<string, number>) => {
    const out: Record<string, number> = { ...a }
    for (const [status, count] of Object.entries(b)) out[status] = (out[status] ?? 0) + count
    return out
  }
  const queue = {
    ad:  merge(teamQueue.wave1.ad,  teamQueue.waves27.ad),
    web: merge(teamQueue.wave1.web, teamQueue.waves27.web),
  }
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 leading-tight">
        Team Queue
      </p>
      <p className="text-[11px] text-text-muted mb-4 leading-snug">
        Counts are per market (sub-item) — e.g. a product with 5 languages waiting counts as 5, not 1.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <TeamQueueGroup team="Ad Team"  entries={sorted(queue.ad)}  openKey={openKey} onToggle={k => setOpenKey(prev => prev === k ? null : k)} />
        <TeamQueueGroup team="Web Team" entries={sorted(queue.web)} openKey={openKey} onToggle={k => setOpenKey(prev => prev === k ? null : k)} />
      </div>
    </div>
  )
}

export default function WavesReportPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(() => toDateStr(getMondayOfWeek(new Date())))
  const [monthStart, setMonthStart] = useState(() => toDateStr(monthStartOf(new Date())))
  const [report, setReport] = useState<WavesWeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingSales, setUploadingSales] = useState(false)
  const [uploadingProducts, setUploadingProducts] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showNewLangsModal, setShowNewLangsModal] = useState(false)

  const selected = period === 'month' ? monthStart : weekStart

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = period === 'month'
      ? `/api/monday/waves-monthly-report?monthStart=${monthStart}`
      : `/api/monday/waves-weekly-report?weekStart=${weekStart}`
    api
      .get<WavesWeeklyReport>(url)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [period, weekStart, monthStart, refreshKey])

  async function handleProductSalesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingProducts(true)
    try {
      const text = await file.text()
      await api.postText<{ ok: boolean }>('/api/monday/product-sales/upload', text)
      setRefreshKey(k => k + 1)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingProducts(false)
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      const endpoint = period === 'month'
        ? `/api/monday/wave-report-monthly-snapshot/${monthStart}/pdf`
        : `/api/monday/wave-report-snapshot/${weekStart}/pdf`
      const blob = await api.getBlob(endpoint)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `waves-report-${selected}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleSalesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingSales(true)
    try {
      const text = await file.text()
      await api.postText<{ ok: boolean }>('/api/monday/language-sales/upload', text)
      setRefreshKey(k => k + 1)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingSales(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-foreground">Wave Dashboard</h1>
            {report && report.isSnapshot && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Snapshot
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted mt-0.5">Performance metrics across all waves</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center h-9 rounded-lg border border-border-subtle bg-surface-elevated p-0.5">
            {(['week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={[
                  'h-full px-3 rounded-md text-sm font-medium capitalize transition-colors',
                  period === p
                    ? 'bg-foreground text-background'
                    : 'text-text-muted hover:text-foreground',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-subtle bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-text-muted" />
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
          <DateFilter
            period={period}
            selected={selected}
            report={report}
            onChange={period === 'month' ? setMonthStart : setWeekStart}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : report ? (
        <div className="mt-8 flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Wave 1</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Wave 1 → Wave 2"
            value={report.pctWave1ToWave2 !== null ? `${report.pctWave1ToWave2}%` : null}
            valueNote={`/ ${report.wave1Total}`}
            sub={`${report.wave1ToWave2Count} of ${report.wave1Total} Wave 1 products`}
            description="% of Wave 1 products that have moved to Wave 2. Denominator is the original Wave 1 total (current Wave 1 + Wave 2)."
          />
          <MetricCard
            label="Products Tested"
            value={report.productsTested}
            sub="Amount of products tested (English, Spanish, German together = 1)"
            description="Count of Wave 1 products where EN, ES, and DE are all launched together — each product counts as 1."
          />
          <MetricCard
            label="Days: Spot → English Test Done"
            value={report.avgDaysSpotToEnTest !== null ? `${report.avgDaysSpotToEnTest}d` : null}
            sub="Avg Phase 1 duration for EN subitems in Wave 1"
            description="Average days from Phase 1 start (lp_building_at) to Phase 1 done (lp_ready_at) across all English subitems in Wave 1."
          />
          <MetricCard
            label="Avg Days in Proofread"
            value={report.avgDaysProofread !== null ? `${report.avgDaysProofread}d` : null}
            sub="Non-English subitems in Wave 1"
            description="Average days from Proofread start (lp_proofread_at) to Ready to Launch (lp_ready_to_launch_at) — excludes EN/English subitems."
          />
          <MetricCard
            label="Proofread Queue (Wave 1)"
            value={report.proofreadQueue}
            sub="Subitems waiting for proofread"
            description="Wave 1 non-English subitems with 'proofread' in website or ads status, whose product name exists in the Proofreading page (done = false). Each subitem counts once."
          />
          <MetricCard
            label="Days: English Done → Others Done"
            value={report.avgDaysEnToOthers !== null ? `${report.avgDaysEnToOthers}d` : null}
            sub="Days from English done to German and Spanish done"
            description="Average days from Phase 1 start (lp_building_at) to Phase 1 done (lp_ready_at) across all subitems in Wave 1 — English, Spanish, German, and others."
          />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Waves 2–7</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Proofread Queue (Waves 2–7)"
            value={report.proofreadQueueWaves27}
            sub="Subitems waiting for proofread"
            description="Wave 2–7 subitems with 'proofread' in website or ads status, whose product name exists in the Proofreading page (done = false)."
          />
          <MetricCard
            label="Avg Languages per Active Product"
            value={report.avgLangsPerProduct !== null ? `${report.avgLangsPerProduct}` : null}
            sub="Total language versions ÷ total active products (Waves 2–7)"
            description="For each active product in Waves 2–7, count its language subitems. Sum all versions across all products, then divide by total active products."
          />
          <MetricCard
            label="Most Languages Live"
            value={report.mostLangsProduct !== null ? `${report.mostLangsProduct.count}` : null}
            sub={report.mostLangsProduct?.name}
            description="The single product in Waves 2–7 live in the most languages — whichever campaign has the highest subitem count wins."
          />
          <MetricCard
            label={`New Languages Launched This ${period === 'month' ? 'Month' : 'Week'}`}
            value={report.newLanguagesLaunchedThisWeek}
            sub="Across all products, all waves — click to view list"
            description={`Counts subitems whose ad status AND website status are both now 'launched' or 'running' but weren't both at the last ${period}ly snapshot. Resets to 0 each time the ${period}ly wave report cron runs.`}
            onClick={() => setShowNewLangsModal(true)}
          />
          <div className="relative group bg-surface-elevated border border-border-subtle rounded-xl p-5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 leading-tight pr-5">
              Active Winners
            </p>
            <div className="flex flex-col gap-2">
              {([
                { key: 'small',  label: 'Small',  range: '1–7 langs',   value: report.activeWinners.small },
                { key: 'medium', label: 'Medium', range: '8–15 langs',  value: report.activeWinners.medium },
                { key: 'big',    label: 'Big',    range: '16+ langs',   value: report.activeWinners.big },
              ] as const).map(({ key, label, range, value }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-text-muted w-14 shrink-0">{label}</span>
                  <span className="text-[10px] text-text-muted flex-1">{range}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
                Products in Waves 2–7 grouped by number of active (launched/running) languages. Small: 1–7, Medium: 8–15, Big: 16+.
              </div>
            </div>
          </div>
          <div className="relative group bg-surface-elevated border border-border-subtle rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider leading-tight">
                % Language Launches Profitable
              </p>
              <label className={`cursor-pointer flex-shrink-0 ml-2 ${uploadingSales ? 'pointer-events-none opacity-50' : ''}`}>
                <input type="file" accept=".csv" className="sr-only" onChange={handleSalesUpload} />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border-subtle bg-surface-page text-text-muted hover:text-foreground transition-colors whitespace-nowrap">
                  {uploadingSales ? 'Uploading…' : 'Upload CSV'}
                </span>
              </label>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold leading-none text-foreground">
                {report.profitableLaunchPct !== null ? `${report.profitableLaunchPct}%` : '—'}
              </p>
            </div>
            <p className="text-xs text-text-muted mt-2 leading-snug">
              {report.totalLaunches > 0
                ? `${report.profitableLaunches} of ${report.totalLaunches} markets profitable`
                : 'No data — upload a Shopify CSV'}
              {report.salesDataUpdatedAt && ` · ${formatRelativeDate(report.salesDataUpdatedAt)}`}
            </p>
            <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
                Upload a Shopify "Net sales by billing country" CSV. Markets where Net sales &gt; Cost of goods sold count as profitable. Waves 2–7 languages only.
              </div>
            </div>
          </div>
          <div className="relative group bg-surface-elevated border border-border-subtle rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider leading-tight">
                Avg Revenue per Active Winner
              </p>
              <label className={`cursor-pointer flex-shrink-0 ml-2 ${uploadingProducts ? 'pointer-events-none opacity-50' : ''}`}>
                <input type="file" accept=".csv" className="sr-only" onChange={handleProductSalesUpload} />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border-subtle bg-surface-page text-text-muted hover:text-foreground transition-colors whitespace-nowrap">
                  {uploadingProducts ? 'Uploading…' : 'Upload CSV'}
                </span>
              </label>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold leading-none text-foreground">
                {report.avgRevenuePerWinner !== null ? formatCurrency(report.avgRevenuePerWinner) : '—'}
              </p>
            </div>
            <p className="text-xs text-text-muted mt-2 leading-snug">
              {report.activeWinnerCount > 0
                ? `${report.activeWinnerCount} products`
                : 'No data — upload a Shopify CSV'}
              {report.productSalesUpdatedAt && ` · ${formatRelativeDate(report.productSalesUpdatedAt)}`}
            </p>
            <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
                Upload a Shopify "Net sales by product title" CSV. Only counts Waves 2–7 products with a language whose ad + website status are both running or launched. Revenue for those ÷ their count = average per winner.
              </div>
            </div>
          </div>
          <div className="relative group bg-surface-elevated border border-border-subtle rounded-xl p-5 sm:col-span-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 leading-tight pr-5">
              Arriving to New Wave — Phase 1 Avg
            </p>
            <div className="flex flex-col gap-2.5">
              {report.newWaveCampaignAvgDays.map(({ wave, avg }) => {
                const langs = WAVE_LANG_LABELS[wave] ?? []
                return (
                  <div key={wave} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-text-muted w-14 shrink-0">Wave {wave}</span>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {langs.map(l => (
                        <span key={l.code} className="text-[10px] font-mono bg-surface-page border border-border-subtle rounded px-1.5 py-0.5 text-foreground">
                          {l.code}
                        </span>
                      ))}
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${avg === null ? 'text-text-muted' : 'text-foreground'}`}>
                      {avg === null ? '—' : `${avg}d`}
                    </span>
                  </div>
                )
              })}
              {(() => {
                const validAvgs = report.newWaveCampaignAvgDays.map(r => r.avg).filter((v): v is number => v !== null)
                const overall = validAvgs.length > 0
                  ? Math.round((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) * 10) / 10
                  : null
                return (
                  <div className="flex items-center gap-3 pt-2 mt-0.5 border-t border-border-subtle">
                    <span className="text-[11px] font-semibold text-text-muted w-14 shrink-0">Overall</span>
                    <span className="flex-1 text-[10px] text-text-muted">avg across waves 2–7</span>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${overall === null ? 'text-text-muted' : 'text-foreground'}`}>
                      {overall === null ? '—' : `${overall}d`}
                    </span>
                  </div>
                )
              })()}
            </div>
            <div className="absolute top-4 right-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-3.5 w-3.5" />
            </div>
            <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
                Average Phase 1 days (lp_building_at → lp_ready_at) for the 3 new language campaigns introduced in each wave.
              </div>
            </div>
            </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Team Queue</p>
            <TeamQueueCard teamQueue={report.teamQueue} />
          </div>
        </div>
      ) : null}

      <NewLanguagesModal
        open={showNewLangsModal}
        onClose={() => setShowNewLangsModal(false)}
        period={period}
        list={report?.newLanguagesLaunchedList ?? []}
      />
    </div>
  )
}
