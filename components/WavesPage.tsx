'use client'
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import {
  ChevronDown, ChevronRight, ChevronUp, ExternalLink,
  RefreshCw, Search, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { createClient } from '@/lib/supabase'
import type { MondayWave, MondayItem, MondaySubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'

// ── LP phase timeline helpers ─────────────────────────────────────────────────

const LP_PHASE_FIELD_NAMES = [
  'lp_building_at', 'lp_ready_at', 'lp_proofread_at', 'lp_ready_to_launch_at', 'lp_launched_at',
] as const

function isOutOfOrder(obj: Record<string, unknown>): boolean {
  let highest = -1
  for (let i = 0; i < LP_PHASE_FIELD_NAMES.length; i++) {
    if (obj[LP_PHASE_FIELD_NAMES[i]]) highest = i
  }
  for (let i = 0; i < highest; i++) {
    if (!obj[LP_PHASE_FIELD_NAMES[i]]) return true
  }
  return false
}

function subitemPhaseAgg(subitems: MondaySubitem[]) {
  const avg = (nums: (number | null)[]) => {
    const valid = nums.filter((n): n is number => n !== null)
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  }
  const buildDays  = subitems.map(s => lpDays(s.lp_building_at, s.lp_ready_at))
  const proofDays  = subitems.map(s => lpDays(s.lp_proofread_at, s.lp_ready_to_launch_at))
  const launched   = subitems.filter(s => s.lp_launched_at).length
  return {
    avgBuild:  avg(buildDays),
    buildDone: buildDays.filter(n => n !== null).length,
    avgProof:  avg(proofDays),
    proofDone: proofDays.filter(n => n !== null).length,
    launched,
    total: subitems.length,
  }
}

function lpDays(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function fmtTs(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function EditableDate({
  value, field, apiPath, onUpdated,
}: {
  value: string | null
  field: string
  apiPath: string
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(dateStr: string | null) {
    setSaving(true)
    try {
      await api.patch(apiPath, {
        [field]: dateStr ? `${dateStr}T00:00:00.000Z` : null,
      })
      onUpdated()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        type="date"
        defaultValue={value ? value.slice(0, 10) : ''}
        onBlur={e => save(e.target.value || null)}
        onKeyDown={e => {
          if (e.key === 'Enter') save((e.target as HTMLInputElement).value || null)
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
        className="font-mono text-xs bg-surface border border-accent/40 rounded px-1 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
    )
  }

  return (
    <div className="flex items-center gap-1 group/date">
      <button
        onClick={() => setEditing(true)}
        disabled={saving}
        className="font-mono text-xs text-left transition-colors disabled:opacity-50 hover:text-accent"
      >
        {value
          ? <span className="text-foreground">{fmtTs(value)}</span>
          : <span className="text-text-muted opacity-0 group-hover/date:opacity-100">+ date</span>}
      </button>
      {value && (
        <button
          onClick={() => save(null)}
          disabled={saving}
          className="opacity-0 group-hover/date:opacity-100 text-text-muted hover:text-danger transition-all"
          title="Clear date"
        >
          <X size={9} />
        </button>
      )}
    </div>
  )
}

function LpPhaseCell({
  start, startField, end, endField, outOfOrder, apiPath, onUpdated, isAdmin,
}: {
  start: string | null
  startField: string
  end?: string | null
  endField?: string
  outOfOrder: boolean
  apiPath: string
  onUpdated: () => void
  isAdmin: boolean
}) {
  const days = end !== undefined ? lpDays(start, end) : null
  const red = outOfOrder ? 'bg-red-500/10 border border-red-500/30' : ''
  return (
    <TableCell className={cn('whitespace-nowrap', red)}>
      <div className="flex flex-col gap-0.5 min-w-[90px]">
        {isAdmin
          ? <EditableDate value={start} field={startField} apiPath={apiPath} onUpdated={onUpdated} />
          : <span className="font-mono text-xs text-foreground">{fmtTs(start)}</span>}
        {end !== undefined && (
          isAdmin && endField
            ? <EditableDate value={end} field={endField} apiPath={apiPath} onUpdated={onUpdated} />
            : <span className="font-mono text-xs text-text-muted">{fmtTs(end ?? null)}</span>
        )}
        {days !== null && (
          <span className={cn(
            'inline-flex font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 w-fit',
            outOfOrder ? 'bg-red-500/15 text-red-500 ring-1 ring-inset ring-red-500/30' : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
          )}>
            {days}d
          </span>
        )}
      </div>
    </TableCell>
  )
}

// ── Wave color palette ───────────────────────────────────────────────────────

const WAVE_COLOR: Record<number, string> = {
  1: 'bg-violet-500', 2: 'bg-blue-500',   3: 'bg-emerald-500',
  4: 'bg-amber-500',  5: 'bg-orange-500', 6: 'bg-fuchsia-500',
  7: 'bg-teal-500',   0: 'bg-gray-400',
}

// ── Status badge ─────────────────────────────────────────────────────────────

const R = 'ring-1 ring-inset'

const STATUS_STYLE: Record<string, string> = {
  'not started yet':       `bg-gray-400/10 text-gray-500 ${R} ring-gray-400/30`,
  'in progress':           `bg-blue-400/10 text-blue-500 ${R} ring-blue-400/30`,
  'ready':                 `bg-green-400/10 text-green-500 ${R} ring-green-400/30`,
  'launched':              `bg-violet-400/10 text-violet-500 ${R} ring-violet-400/30`,
  'running':               `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`,
  'stopped':               `bg-red-400/10 text-red-500 ${R} ring-red-400/30`,
  'waiting for editor':    `bg-yellow-400/10 text-yellow-600 ${R} ring-yellow-400/30`,
  'waiting for builder':   `bg-yellow-400/10 text-yellow-600 ${R} ring-yellow-400/30`,
  'working on it':         `bg-blue-400/10 text-blue-500 ${R} ring-blue-400/30`,
  'waiting for proofread': `bg-orange-400/10 text-orange-500 ${R} ring-orange-400/30`,
  'proofread done':        `bg-teal-400/10 text-teal-500 ${R} ring-teal-400/30`,
  'ready for revision':    `bg-orange-400/10 text-orange-500 ${R} ring-orange-400/30`,
  'ready to launch':       `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`,
  'building - dan':        `bg-sky-400/10 text-sky-500 ${R} ring-sky-400/30`,
  'building - dora':       `bg-sky-400/10 text-sky-500 ${R} ring-sky-400/30`,
  'revisions needed':      `bg-red-400/10 text-red-500 ${R} ring-red-400/30`,
}

function getStatusStyle(label: string): string {
  const l = label.toLowerCase()
  if (STATUS_STYLE[l]) return STATUS_STYLE[l]
  if (l.includes('waiting'))                           return `bg-yellow-400/10 text-yellow-600 ${R} ring-yellow-400/30`
  if (l.includes('building') || l.includes('working')) return `bg-sky-400/10 text-sky-500 ${R} ring-sky-400/30`
  if (l.includes('progress'))                          return `bg-blue-400/10 text-blue-500 ${R} ring-blue-400/30`
  if (l.includes('proof'))                             return `bg-teal-400/10 text-teal-500 ${R} ring-teal-400/30`
  if (l.includes('ready') || l.includes('launch'))     return `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`
  if (l.includes('running') || l.includes('expand'))   return `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`
  if (l.includes('stop') || l.includes('revision'))    return `bg-red-400/10 text-red-500 ${R} ring-red-400/30`
  if (l.includes('test'))                              return `bg-orange-400/10 text-orange-500 ${R} ring-orange-400/30`
  return `bg-gray-400/10 text-gray-500 ${R} ring-gray-400/30`
}

function StatusBadge({ label }: { label: string | null }) {
  if (!label) return <span className="text-text-muted text-xs">—</span>
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', getStatusStyle(label))}>
      {label}
    </span>
  )
}

// ── Platform flags ───────────────────────────────────────────────────────────

const PLATFORMS: Array<{ key: keyof MondaySubitem; label: string }> = [
  { key: 'meta',            label: 'Meta'   },
  { key: 'tiktok',         label: 'TikTok' },
  { key: 'youtube',        label: 'YT'     },
  { key: 'pinterest',      label: 'Pin'    },
  { key: 'google_shopping', label: 'GS'    },
  { key: 'google_search',  label: 'G🔍'   },
]

function PlatformFlags({ sub }: { sub: MondaySubitem }) {
  const active = PLATFORMS.filter(p => sub[p.key])
  if (!active.length) return <span className="text-text-muted text-xs">—</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {active.map(p => (
        <span key={p.key} className="bg-accent-muted text-accent text-xs px-1.5 py-0.5 rounded-full font-medium">
          {p.label}
        </span>
      ))}
    </div>
  )
}

// ── Sortable header ───────────────────────────────────────────────────────────

type SortKey = 'name' | 'creatives_status' | 'landing_page_status'
type SortDir = 'asc' | 'desc'

function SortableHeader({ label, sortKey, active, dir, onSort, className }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir
  onSort: (k: SortKey) => void; className?: string
}) {
  return (
    <TableHeader className={cn('cursor-pointer select-none group whitespace-nowrap', className)} onClick={() => onSort(sortKey)}>
      <div className="flex items-center gap-1">
        {label}
        <span className={cn('transition-opacity text-text-muted', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}>
          {active && dir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </span>
      </div>
    </TableHeader>
  )
}

// ── Marquee name ─────────────────────────────────────────────────────────────

function MarqueeName({ name, className = '' }: { name: string; className?: string }) {
  const cRef = useRef<HTMLDivElement>(null)
  const tRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!cRef.current || !tRef.current) return
    setOverflow(Math.max(0, tRef.current.scrollWidth - cRef.current.offsetWidth))
  }, [name])

  return (
    <div
      ref={cRef}
      className={`overflow-hidden ${className}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <span
        ref={tRef}
        className="block whitespace-nowrap"
        style={
          active && overflow > 0
            ? ({ animation: 'marquee-bounce 3s ease-in-out infinite', '--marquee-offset': `-${overflow}px` } as CSSProperties)
            : {}
        }
      >
        {name}
      </span>
    </div>
  )
}

// ── Subitem row ──────────────────────────────────────────────────────────────

function SubitemRow({ sub, visible, knownNames, showTimeline, showProofread, showPhase1, isAdmin, onUpdated }: {
  sub: MondaySubitem
  visible: boolean
  knownNames: Set<string>
  showTimeline?: boolean
  showProofread?: boolean
  showPhase1?: boolean
  isAdmin: boolean
  onUpdated: () => void
}) {
  const inner = cn(
    'overflow-hidden transition-[max-height,opacity,padding] duration-200 ease-in-out px-4',
    visible ? 'max-h-16 opacity-100 py-2' : 'max-h-0 opacity-0 py-0',
  )
  const innerWrap = cn(
    'transition-[max-height,opacity,padding] duration-200 ease-in-out px-4',
    visible ? 'max-h-40 opacity-100 py-2' : 'max-h-0 opacity-0 py-0',
  )
  const innerDate = cn(
    'overflow-hidden transition-[max-height,opacity,padding] duration-200 ease-in-out px-4',
    visible ? 'max-h-24 opacity-100 py-2' : 'max-h-0 opacity-0 py-0',
  )
  const outOfOrder = showTimeline ? isOutOfOrder(sub as unknown as Record<string, unknown>) : false
  const apiPath = `/api/monday/subitems/${sub.id}/timestamps`

  return (
    <TableRow
      className={cn('bg-surface/40 hover:bg-surface-hover/30 border-l-0')}
      style={!visible ? { borderBottomWidth: 0 } : undefined}
    >
      <TableCell className="p-0" />
      <TableCell className="p-0">
        <div className={inner}>
          <div className="flex items-center gap-2 pl-4">
            {sub.product_name != null && (
              <span className={cn(
                'shrink-0 w-2 h-2 rounded-full',
                knownNames.has(sub.product_name.toLowerCase()) ? 'bg-emerald-500' : 'bg-gray-300',
              )} />
            )}
            <span className="w-px h-4 bg-border-subtle shrink-0" />
            <span className="text-xs text-text-muted">{sub.name}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="p-0 text-xs text-text-secondary">
        <div className={innerWrap}>
          {sub.product_name ?? null}
        </div>
      </TableCell>
      <TableCell className="p-0">
        <div className={inner}>
          {sub.shopify_pdp_link
            ? <a href={sub.shopify_pdp_link} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
                View <ExternalLink size={10} />
              </a>
            : <span className="text-xs text-text-muted">—</span>}
        </div>
      </TableCell>
      <TableCell className="p-0"><div className={inner}><StatusBadge label={sub.ad_status} /></div></TableCell>
      <TableCell className="p-0"><div className={inner}><StatusBadge label={sub.website_status} /></div></TableCell>

      {/* Phase date cells — only when timeline is active */}
      {showTimeline ? (
        <>
          <TableCell className={cn('p-0', outOfOrder && 'bg-red-500/10')}>
            <div className={innerDate}>
              <div className="flex flex-col gap-0.5 min-w-[90px]">
                {isAdmin
                  ? <EditableDate value={sub.lp_building_at} field="lp_building_at" apiPath={apiPath} onUpdated={onUpdated} />
                  : <span className="font-mono text-xs text-foreground">{fmtTs(sub.lp_building_at)}</span>}
                {isAdmin
                  ? <EditableDate value={sub.lp_ready_at} field="lp_ready_at" apiPath={apiPath} onUpdated={onUpdated} />
                  : <span className="font-mono text-xs text-text-muted">{fmtTs(sub.lp_ready_at)}</span>}
                {lpDays(sub.lp_building_at, sub.lp_ready_at) !== null && (
                  <span className={cn(
                    'inline-flex font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 w-fit',
                    outOfOrder ? 'bg-red-500/15 text-red-500 ring-1 ring-inset ring-red-500/30' : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
                  )}>
                    {lpDays(sub.lp_building_at, sub.lp_ready_at)}d
                  </span>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className={cn('p-0', outOfOrder && 'bg-red-500/10')}>
            <div className={innerDate}>
              <div className="flex flex-col gap-0.5 min-w-[90px]">
                {isAdmin
                  ? <EditableDate value={sub.lp_proofread_at} field="lp_proofread_at" apiPath={apiPath} onUpdated={onUpdated} />
                  : <span className="font-mono text-xs text-foreground">{fmtTs(sub.lp_proofread_at)}</span>}
                {isAdmin
                  ? <EditableDate value={sub.lp_ready_to_launch_at} field="lp_ready_to_launch_at" apiPath={apiPath} onUpdated={onUpdated} />
                  : <span className="font-mono text-xs text-text-muted">{fmtTs(sub.lp_ready_to_launch_at)}</span>}
                {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at) !== null && (
                  <span className={cn(
                    'inline-flex font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 w-fit',
                    outOfOrder ? 'bg-red-500/15 text-red-500 ring-1 ring-inset ring-red-500/30' : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
                  )}>
                    {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at)}d
                  </span>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className={cn('p-0', outOfOrder && 'bg-red-500/10')}>
            <div className={innerDate}>
              {isAdmin
                ? <EditableDate value={sub.lp_launched_at} field="lp_launched_at" apiPath={apiPath} onUpdated={onUpdated} />
                : <span className="font-mono text-xs text-foreground">{fmtTs(sub.lp_launched_at)}</span>}
            </div>
          </TableCell>
        </>
      ) : (
        <>
          {showPhase1 && (
            <TableCell className="p-0">
              <div className={innerDate}>
                <div className="flex flex-col gap-0.5 min-w-[90px]">
                  {isAdmin
                    ? <EditableDate value={sub.lp_building_at} field="lp_building_at" apiPath={apiPath} onUpdated={onUpdated} />
                    : <span className="font-mono text-xs text-foreground">{fmtTs(sub.lp_building_at)}</span>}
                  {isAdmin
                    ? <EditableDate value={sub.lp_ready_at} field="lp_ready_at" apiPath={apiPath} onUpdated={onUpdated} />
                    : <span className="font-mono text-xs text-text-muted">{fmtTs(sub.lp_ready_at)}</span>}
                  {lpDays(sub.lp_building_at, sub.lp_ready_at) !== null && (
                    <span className="inline-flex font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 w-fit bg-accent/15 text-accent ring-1 ring-inset ring-accent/30">
                      {lpDays(sub.lp_building_at, sub.lp_ready_at)}d
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
          )}
          {showProofread && (
            <TableCell className="p-0">
              <div className={innerDate}>
                <div className="flex flex-col gap-0.5 min-w-[90px]">
                  {isAdmin
                    ? <EditableDate value={sub.lp_proofread_at} field="lp_proofread_at" apiPath={apiPath} onUpdated={onUpdated} />
                    : <span className="font-mono text-xs text-foreground">{fmtTs(sub.lp_proofread_at)}</span>}
                  {isAdmin
                    ? <EditableDate value={sub.lp_ready_to_launch_at} field="lp_ready_to_launch_at" apiPath={apiPath} onUpdated={onUpdated} />
                    : <span className="font-mono text-xs text-text-muted">{fmtTs(sub.lp_ready_to_launch_at)}</span>}
                  {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at) !== null && (
                    <span className="inline-flex font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 w-fit bg-accent/15 text-accent ring-1 ring-inset ring-accent/30">
                      {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at)}d
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
          )}
        </>
      )}

      <TableCell className="p-0"><div className={inner}><PlatformFlags sub={sub} /></div></TableCell>
      <TableCell className="p-0">
        <div className={cn(inner, 'flex flex-col gap-0.5')}>
          {sub.drive_link && (
            <a href={sub.drive_link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Drive <ExternalLink size={10} />
            </a>
          )}
          {sub.page_link && (
            <a href={sub.page_link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Page <ExternalLink size={10} />
            </a>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Subitem header row ────────────────────────────────────────────────────────

function SubitemHeaderRow({ visible, showTimeline, showProofread, showPhase1 }: {
  visible: boolean
  showTimeline?: boolean
  showProofread?: boolean
  showPhase1?: boolean
}) {
  const cls = cn(
    'overflow-hidden transition-[max-height,opacity,padding] duration-200 ease-in-out px-2',
    visible ? 'max-h-8 opacity-100 py-1' : 'max-h-0 opacity-0 py-0',
  )
  const lbl = 'text-[10px] font-semibold uppercase tracking-wider text-text-muted'
  return (
    <TableRow className="bg-surface-elevated/40 border-l-0">
      <TableCell className="p-0" />
      <TableCell className="p-0"><div className={cls}><span className={cn(lbl, 'pl-10')}>Variant</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Product Name</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>PDP</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Ad Status</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Web Status</span></div></TableCell>
      {showTimeline && (
        <>
          <TableCell className="p-0"><div className={cls}><span className={lbl}>Phase 1</span></div></TableCell>
          <TableCell className="p-0"><div className={cls}><span className={lbl}>Proofread</span></div></TableCell>
          <TableCell className="p-0"><div className={cls}><span className={lbl}>Testing</span></div></TableCell>
        </>
      )}
      {showPhase1 && (
        <TableCell className="p-0"><div className={cls}><span className={lbl}>Phase 1</span></div></TableCell>
      )}
      {showProofread && (
        <TableCell className="p-0"><div className={cls}><span className={lbl}>Proofread</span></div></TableCell>
      )}
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Platforms</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Links</span></div></TableCell>
    </TableRow>
  )
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, index, knownNames, showTimeline, showProofread, showPhase1, onUpdated, isAdmin }: {
  item: MondayItem
  index: number
  knownNames: Set<string>
  showTimeline?: boolean
  showProofread?: boolean
  showPhase1?: boolean
  onUpdated: () => void
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.monday_subitems.length > 0
  const outOfOrder = showTimeline && !hasSubs ? isOutOfOrder(item as unknown as Record<string, unknown>) : false

  return (
    <>
      <TableRow
        className={cn(open && 'bg-surface-hover/60')}
        onClick={() => hasSubs && setOpen(o => !o)}
        style={{ cursor: hasSubs ? 'pointer' : 'default' }}
      >
        <TableCell className="text-center text-xs text-text-muted/50 font-mono tabular-nums w-8 select-none">{index}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted flex-shrink-0 w-3.5">
              {hasSubs && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </span>
            <MarqueeName name={item.name} className="min-w-0 max-w-[200px] text-sm font-medium text-accent" />
          </div>
        </TableCell>
        <TableCell className="text-text-muted text-xs">—</TableCell>
        <TableCell className="text-text-muted text-xs">—</TableCell>
        <TableCell><StatusBadge label={item.creatives_status} /></TableCell>
        <TableCell><StatusBadge label={item.landing_page_status} /></TableCell>
        {showTimeline && (hasSubs ? (() => {
          const agg = subitemPhaseAgg(item.monday_subitems)
          return (
            <>
              <TableCell className="whitespace-nowrap">
                {agg.avgBuild !== null
                  ? <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-semibold text-accent tabular-nums">{agg.avgBuild}d avg</span>
                      <span className="text-[11px] text-text-muted tabular-nums">{agg.buildDone}/{agg.total}</span>
                    </div>
                  : <span className="text-text-muted text-xs">—</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {agg.avgProof !== null
                  ? <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-semibold text-accent tabular-nums">{agg.avgProof}d avg</span>
                      <span className="text-[11px] text-text-muted tabular-nums">{agg.proofDone}/{agg.total}</span>
                    </div>
                  : <span className="text-text-muted text-xs">—</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {agg.launched > 0
                  ? <span className="font-mono text-xs font-semibold text-accent tabular-nums">{agg.launched}/{agg.total}</span>
                  : <span className="text-text-muted text-xs">—</span>}
              </TableCell>
            </>
          )
        })() : (
          <>
            <LpPhaseCell
              start={item.lp_building_at}  startField="lp_building_at"
              end={item.lp_ready_at}       endField="lp_ready_at"
              outOfOrder={outOfOrder} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} isAdmin={isAdmin}
            />
            <LpPhaseCell
              start={item.lp_proofread_at}      startField="lp_proofread_at"
              end={item.lp_ready_to_launch_at}  endField="lp_ready_to_launch_at"
              outOfOrder={outOfOrder} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} isAdmin={isAdmin}
            />
            <LpPhaseCell
              start={item.lp_launched_at} startField="lp_launched_at"
              outOfOrder={outOfOrder} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} isAdmin={isAdmin}
            />
          </>
        ))}
        {showPhase1 && (hasSubs ? (() => {
          const agg = subitemPhaseAgg(item.monday_subitems)
          return (
            <TableCell className="whitespace-nowrap">
              {agg.avgBuild !== null
                ? <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold text-accent tabular-nums">{agg.avgBuild}d avg</span>
                    <span className="text-[11px] text-text-muted tabular-nums">{agg.buildDone}/{agg.total}</span>
                  </div>
                : <span className="text-text-muted text-xs">—</span>}
            </TableCell>
          )
        })() : (
          <LpPhaseCell
            start={item.lp_building_at} startField="lp_building_at"
            end={item.lp_ready_at}      endField="lp_ready_at"
            outOfOrder={false} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} isAdmin={isAdmin}
          />
        ))}
        {showProofread && (hasSubs ? (() => {
          const agg = subitemPhaseAgg(item.monday_subitems)
          return (
            <TableCell className="whitespace-nowrap">
              {agg.avgProof !== null
                ? <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold text-accent tabular-nums">{agg.avgProof}d avg</span>
                    <span className="text-[11px] text-text-muted tabular-nums">{agg.proofDone}/{agg.total}</span>
                  </div>
                : <span className="text-text-muted text-xs">—</span>}
            </TableCell>
          )
        })() : (
          <LpPhaseCell
            start={item.lp_proofread_at}     startField="lp_proofread_at"
            end={item.lp_ready_to_launch_at} endField="lp_ready_to_launch_at"
            outOfOrder={false} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} isAdmin={isAdmin}
          />
        ))}
        <TableCell className="text-text-muted text-xs">
          {hasSubs
            ? <span className="bg-surface-page border border-border-subtle rounded-full px-2 py-0.5 text-[11px]">{item.monday_subitems.length}</span>
            : '—'}
        </TableCell>
        <TableCell />
      </TableRow>
      {hasSubs && <SubitemHeaderRow visible={open} showTimeline={showTimeline} showProofread={showProofread} showPhase1={showPhase1} />}
      {hasSubs && [...item.monday_subitems].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).map(sub => <SubitemRow key={sub.id} sub={sub} visible={open} knownNames={knownNames} showTimeline={showTimeline} showProofread={showProofread} showPhase1={showPhase1} isAdmin={isAdmin} onUpdated={onUpdated} />)}
    </>
  )
}

// ── Mobile item card ──────────────────────────────────────────────────────────

function ItemCard({ item, showTimeline, showProofread, onUpdated, isAdmin }: {
  item: MondayItem
  showTimeline?: boolean
  showProofread?: boolean
  onUpdated: () => void
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.monday_subitems.length > 0
  const outOfOrder = showTimeline && !hasSubs ? isOutOfOrder(item as unknown as Record<string, unknown>) : false

  return (
    <div className={cn(
      'bg-surface-elevated border rounded-xl p-4',
      outOfOrder ? 'border-red-500/40' : 'border-border-subtle',
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-foreground leading-snug">{item.name}</p>
        {hasSubs && (
          <button
            onClick={() => setOpen(o => !o)}
            className="shrink-0 text-text-muted hover:text-foreground p-1 rounded"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.creatives_status    && <StatusBadge label={item.creatives_status} />}
        {item.landing_page_status && <StatusBadge label={item.landing_page_status} />}
        {hasSubs && (
          <span className="text-xs bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">
            {item.monday_subitems.length} variant{item.monday_subitems.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {showTimeline && hasSubs && (() => {
        const agg = subitemPhaseAgg(item.monday_subitems)
        return (
          <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg text-xs bg-surface border border-border-subtle">
            <div>
              <p className="font-medium text-text-muted mb-1">Phase 1</p>
              {agg.avgBuild !== null
                ? <><p className="font-mono font-semibold text-accent tabular-nums">{agg.avgBuild}d avg</p><p className="text-text-muted tabular-nums">{agg.buildDone}/{agg.total}</p></>
                : <p className="text-text-muted">—</p>}
            </div>
            <div>
              <p className="font-medium text-text-muted mb-1">Proofread</p>
              {agg.avgProof !== null
                ? <><p className="font-mono font-semibold text-accent tabular-nums">{agg.avgProof}d avg</p><p className="text-text-muted tabular-nums">{agg.proofDone}/{agg.total}</p></>
                : <p className="text-text-muted">—</p>}
            </div>
            <div>
              <p className="font-medium text-text-muted mb-1">Testing</p>
              {agg.launched > 0
                ? <p className="font-mono font-semibold text-accent tabular-nums">{agg.launched}/{agg.total}</p>
                : <p className="text-text-muted">—</p>}
            </div>
          </div>
        )
      })()}

      {showTimeline && !hasSubs && (
        <div className={cn('grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg text-xs', outOfOrder ? 'bg-red-500/10 border border-red-500/20' : 'bg-surface border border-border-subtle')}>
          {([
            { label: 'Phase 1',  startField: 'lp_building_at',  start: item.lp_building_at,  endField: 'lp_ready_at',           end: item.lp_ready_at           },
            { label: 'Proofread',startField: 'lp_proofread_at', start: item.lp_proofread_at,  endField: 'lp_ready_to_launch_at', end: item.lp_ready_to_launch_at },
            { label: 'Testing',  startField: 'lp_launched_at',  start: item.lp_launched_at,   endField: undefined,               end: undefined                  },
          ] as { label: string; startField: string; start: string | null; endField?: string; end?: string | null }[]).map(phase => (
            <div key={phase.label}>
              <p className={cn('font-medium mb-1', outOfOrder ? 'text-red-500' : 'text-text-muted')}>{phase.label}</p>
              {isAdmin
                ? <EditableDate value={phase.start} field={phase.startField} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} />
                : <p className="font-mono text-foreground">{fmtTs(phase.start)}</p>}
              {phase.endField !== undefined && (
                isAdmin
                  ? <EditableDate value={phase.end ?? null} field={phase.endField} apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} />
                  : <p className="font-mono text-text-muted">{fmtTs(phase.end ?? null)}</p>
              )}
              {phase.end !== undefined && lpDays(phase.start, phase.end ?? null) !== null && (
                <p className={cn(
                  'inline-flex font-mono font-semibold mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full',
                  outOfOrder ? 'bg-red-500/15 text-red-500 ring-1 ring-inset ring-red-500/30' : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
                )}>
                  {lpDays(phase.start, phase.end ?? null)}d
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showProofread && hasSubs && (() => {
        const agg = subitemPhaseAgg(item.monday_subitems)
        return (
          <div className="mb-3 p-2 rounded-lg text-xs bg-surface border border-border-subtle">
            <p className="font-medium text-text-muted mb-1">Proofread</p>
            {agg.avgProof !== null
              ? <><p className="font-mono font-semibold text-accent tabular-nums">{agg.avgProof}d avg</p><p className="text-text-muted tabular-nums">{agg.proofDone}/{agg.total}</p></>
              : <p className="text-text-muted">—</p>}
          </div>
        )
      })()}

      {showProofread && !hasSubs && (
        <div className="mb-3 p-2 rounded-lg text-xs bg-surface border border-border-subtle">
          <p className="font-medium text-text-muted mb-1">Proofread</p>
          {isAdmin
            ? <EditableDate value={item.lp_proofread_at} field="lp_proofread_at" apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} />
            : <p className="font-mono text-foreground">{fmtTs(item.lp_proofread_at)}</p>}
          {isAdmin
            ? <EditableDate value={item.lp_ready_to_launch_at} field="lp_ready_to_launch_at" apiPath={`/api/monday/items/${item.id}/timestamps`} onUpdated={onUpdated} />
            : <p className="font-mono text-text-muted">{fmtTs(item.lp_ready_to_launch_at)}</p>}
          {lpDays(item.lp_proofread_at, item.lp_ready_to_launch_at) !== null && (
            <p className="inline-flex font-mono font-semibold mt-0.5 text-[10px] bg-accent/15 text-accent ring-1 ring-inset ring-accent/30 px-1.5 py-0.5 rounded-full">
              {lpDays(item.lp_proofread_at, item.lp_ready_to_launch_at)}d
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
          {item.monday_subitems.map(sub => {
            const subOut = showTimeline ? isOutOfOrder(sub as unknown as Record<string, unknown>) : false
            return (
              <div key={sub.id} className={cn('pl-2 border-l-2', subOut ? 'border-red-400' : 'border-border-subtle')}>
                <p className="text-xs text-text-muted italic mb-1">{sub.name}</p>
                <div className="flex flex-wrap gap-1 mb-1">
                  {sub.ad_status      && <StatusBadge label={sub.ad_status} />}
                  {sub.website_status && <StatusBadge label={sub.website_status} />}
                </div>
                {showProofread && (
                  <div className="mt-1 text-xs">
                    <p className="text-[10px] font-medium mb-0.5 text-text-muted">Proofread</p>
                    {isAdmin
                      ? <EditableDate value={sub.lp_proofread_at} field="lp_proofread_at" apiPath={`/api/monday/subitems/${sub.id}/timestamps`} onUpdated={onUpdated} />
                      : <p className="font-mono text-foreground">{fmtTs(sub.lp_proofread_at)}</p>}
                    {isAdmin
                      ? <EditableDate value={sub.lp_ready_to_launch_at} field="lp_ready_to_launch_at" apiPath={`/api/monday/subitems/${sub.id}/timestamps`} onUpdated={onUpdated} />
                      : <p className="font-mono text-text-muted">{fmtTs(sub.lp_ready_to_launch_at)}</p>}
                    {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at) !== null && (
                      <p className="inline-flex font-mono font-semibold text-[10px] bg-accent/15 text-accent ring-1 ring-inset ring-accent/30 px-1.5 py-0.5 rounded-full">
                        {lpDays(sub.lp_proofread_at, sub.lp_ready_to_launch_at)}d
                      </p>
                    )}
                  </div>
                )}
                {(sub.drive_link || sub.page_link) && (
                  <div className="flex items-center gap-2 mt-1">
                    {sub.drive_link && (
                      <a href={sub.drive_link} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-accent hover:underline flex items-center gap-0.5">
                        Drive <ExternalLink size={10} />
                      </a>
                    )}
                    {sub.page_link && (
                      <a href={sub.page_link} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-accent hover:underline flex items-center gap-0.5">
                        Page <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
                {showTimeline && (
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                    {([
                      { label: 'Phase 1',  startField: 'lp_building_at',  start: sub.lp_building_at,  endField: 'lp_ready_at',           end: sub.lp_ready_at           },
                      { label: 'Proofread',startField: 'lp_proofread_at', start: sub.lp_proofread_at,  endField: 'lp_ready_to_launch_at', end: sub.lp_ready_to_launch_at },
                      { label: 'Testing',  startField: 'lp_launched_at',  start: sub.lp_launched_at,   endField: undefined,               end: undefined                  },
                    ] as { label: string; startField: string; start: string | null; endField?: string; end?: string | null }[]).map(phase => (
                      <div key={phase.label}>
                        <p className={cn('text-[10px] font-medium mb-0.5', subOut ? 'text-red-400' : 'text-text-muted')}>{phase.label}</p>
                        {isAdmin
                          ? <EditableDate value={phase.start} field={phase.startField} apiPath={`/api/monday/subitems/${sub.id}/timestamps`} onUpdated={onUpdated} />
                          : <p className="font-mono text-foreground">{fmtTs(phase.start)}</p>}
                        {phase.endField !== undefined && (
                          isAdmin
                            ? <EditableDate value={phase.end ?? null} field={phase.endField} apiPath={`/api/monday/subitems/${sub.id}/timestamps`} onUpdated={onUpdated} />
                            : <p className="font-mono text-text-muted">{fmtTs(phase.end ?? null)}</p>
                        )}
                        {phase.end !== undefined && lpDays(phase.start, phase.end ?? null) !== null && (
                          <p className={cn(
                            'inline-flex font-mono font-semibold text-[10px] px-1.5 py-0.5 rounded-full',
                            subOut ? 'bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30' : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
                          )}>
                            {lpDays(phase.start, phase.end ?? null)}d
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function WavesPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'
  const [waves, setWaves]           = useState<MondayWave[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeWave, setActiveWave] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string>('')
  const [search, setSearch]         = useState('')
  const [filterCreatives, setFilterCreatives] = useState('')
  const [filterLanding, setFilterLanding]     = useState('')
  const [sortKey, setSortKey]       = useState<SortKey | null>(null)
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [syncing, setSyncing]           = useState(false)
  const [registeringHooks, setRegisteringHooks] = useState(false)
  const [knownNames, setKnownNames] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const data = await api.get<MondayWave[]>('/api/monday/waves')
      setWaves(data)
      if (!activeWave && data.length) {
        const first = data.find(w => w.wave_number !== 0) ?? data[0]
        setActiveWave(first.id)
      }
    } catch (err) {
      console.error('Failed to load waves:', err)
    } finally {
      setLoading(false)
    }
  }, [activeWave])

  useEffect(() => { load() }, [])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('monday-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monday_items' },    load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monday_subitems' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // Fetch known product names from tracker + proofreading for cross-reference dots
  useEffect(() => {
    Promise.allSettled([
      api.get<{ product_name: string }[]>('/api/builds'),
      api.get<{ product_name: string }[]>('/api/proof-corrections/products'),
    ]).then(([buildsResult, proofsResult]) => {
      const names = new Set<string>()
      if (buildsResult.status === 'fulfilled') {
        for (const b of buildsResult.value) if (b.product_name) names.add(b.product_name.toLowerCase())
      } else {
        console.error('[cross-ref] builds fetch failed:', buildsResult.reason)
      }
      if (proofsResult.status === 'fulfilled') {
        for (const p of proofsResult.value) if (p.product_name) names.add(p.product_name.toLowerCase())
      } else {
        console.error('[cross-ref] proof-corrections/products fetch failed:', proofsResult.reason)
      }
      setKnownNames(names)
    })
  }, [])

  // Reset group/filters when wave changes
  useEffect(() => {
    setActiveGroup('')
    setSearch('')
    setFilterCreatives('')
    setFilterLanding('')
    setSortKey(null)
  }, [activeWave])

  async function syncWave() {
    if (!current?.board_id) return
    setSyncing(true)
    try {
      await api.post(`/api/monday/sync/${current.board_id}`, {})
      await load()
    } catch (err: any) {
      alert('Sync failed: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function registerHooks() {
    setRegisteringHooks(true)
    try {
      const res = await api.post<{ ok: boolean; results: Record<string, unknown> }>('/api/monday/register-hooks', {})
      const boards = Object.keys(res.results)
      const ok = boards.filter(b => (res.results[b] as any)?.id).length
      alert(`Hooks registered: ${ok}/${boards.length} boards`)
    } catch (err: any) {
      alert('Register failed: ' + err.message)
    } finally {
      setRegisteringHooks(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const mainWaves      = waves.filter(w => w.wave_number !== 0).sort((a, b) => a.wave_number - b.wave_number)
  const rawStoppedWave = waves.find(w => w.wave_number === 0)

  // Auto-surface just the subitem(s) stopped on both ads and web from waves 1-7,
  // in addition to items actually moved into the Stopped wave.
  const autoStoppedItems = mainWaves
    .filter(w => w.wave_number >= 1 && w.wave_number <= 7)
    .flatMap(w => w.monday_items
      .map(i => ({
        ...i,
        monday_subitems: i.monday_subitems.filter(s =>
          (s.ad_status ?? '').toLowerCase() === 'stopped' && (s.website_status ?? '').toLowerCase() === 'stopped'
        ),
      }))
      .filter(i => i.monday_subitems.length > 0)
    )
  const stoppedWave = rawStoppedWave
    ? {
        ...rawStoppedWave,
        monday_items: [
          ...rawStoppedWave.monday_items,
          ...autoStoppedItems.filter(i => !rawStoppedWave.monday_items.some(existing => existing.id === i.id)),
        ],
      }
    : undefined

  const allWaves    = [...mainWaves, ...(stoppedWave ? [stoppedWave] : [])]
  const current      = activeWave === stoppedWave?.id ? stoppedWave : waves.find(w => w.id === activeWave)
  const showTimeline = current?.wave_number === 1
  const showProofread = (current?.wave_number ?? 0) >= 2
  const showPhase1 = (current?.wave_number ?? 0) >= 2 && (current?.wave_number ?? 0) <= 7

  const isStoppedTab = current?.wave_number === 0
  const groups = current && !isStoppedTab
    ? Array.from(new Set(current.monday_items.map(i => i.group_name ?? 'General')))
    : []
  const currentGroup = groups.includes(activeGroup) ? activeGroup : (groups[0] ?? '')

  const creativesOptions = Array.from(new Set(
    (current?.monday_items ?? []).map(i => i.creatives_status).filter((s): s is string => Boolean(s))
  )).sort()
  const landingOptions = Array.from(new Set(
    (current?.monday_items ?? []).map(i => i.landing_page_status).filter((s): s is string => Boolean(s))
  )).sort()

  let items = (current?.monday_items ?? []).filter(i => isStoppedTab || (i.group_name ?? 'General') === currentGroup)
  if (search.trim()) {
    const q = search.toLowerCase()
    items = items.filter(i => i.name.toLowerCase().includes(q))
  }
  if (filterCreatives) items = items.filter(i => i.creatives_status === filterCreatives)
  if (filterLanding)   items = items.filter(i => i.landing_page_status === filterLanding)
  items = [...items].sort((a, b) => {
    if (sortKey) {
      const av = (a[sortKey] ?? '').toLowerCase()
      const bv = (b[sortKey] ?? '').toLowerCase()
      const cmp = sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      if (cmp !== 0) return cmp
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  const hasFilters  = search || filterCreatives || filterLanding
  const groupCount  = (current?.monday_items ?? []).filter(i => isStoppedTab || (i.group_name ?? 'General') === currentGroup).length

  const waveTabs = allWaves.map(w => ({
    id: w.id,
    label: w.name,
    count: w.monday_items.length,
  }))

  const SELECT_CLS = 'rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">Loading waves…</div>
    )
  }

  if (!waves.length) {
    return (
      <div>
        <PageHeader title="Waves" />
        <p className="text-sm text-text-muted">No waves imported yet.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Waves" />

      <div className="space-y-4">

        {/* ── Mobile: wave select ── */}
        <div className="md:hidden">
          <select
            value={activeWave ?? ''}
            onChange={e => setActiveWave(e.target.value)}
            className={cn(SELECT_CLS, 'w-full')}
          >
            {allWaves.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* ── Desktop: wave tabs + sync ── */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <Tabs
            tabs={waveTabs}
            active={activeWave ?? ''}
            onChange={id => setActiveWave(String(id))}
            className="flex-1"
          />
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={registerHooks}
                disabled={registeringHooks}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
                title="Register Monday.com webhooks for all boards"
              >
                {registeringHooks ? 'Registering…' : 'Register Hooks'}
              </button>
            )}
            {current?.board_id && (
              <button
                onClick={syncWave}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
              >
                <RefreshCw size={11} className={cn(syncing && 'animate-spin')} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
          </div>
        </div>

        {/* ── Group sub-tabs ── */}
        {groups.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {groups.map(group => {
              const cnt = (current?.monday_items ?? []).filter(i => (i.group_name ?? 'General') === group).length
              const isActive = currentGroup === group
              return (
                <button
                  key={group}
                  onClick={() => setActiveGroup(group)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all border',
                    isActive
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'text-text-secondary bg-surface-elevated border-border-subtle hover:text-foreground hover:border-border',
                  )}
                >
                  {group}
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-page text-text-muted',
                  )}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Search + filters ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {creativesOptions.length > 0 && (
            <select
              value={filterCreatives}
              onChange={e => setFilterCreatives(e.target.value)}
              className={cn(
                'rounded-md border bg-surface-elevated px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 cursor-pointer',
                filterCreatives ? 'border-accent text-accent font-medium' : 'border-border text-text-secondary',
              )}
            >
              <option value="">All Creatives</option>
              {creativesOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {landingOptions.length > 0 && (
            <select
              value={filterLanding}
              onChange={e => setFilterLanding(e.target.value)}
              className={cn(
                'rounded-md border bg-surface-elevated px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 cursor-pointer',
                filterLanding ? 'border-accent text-accent font-medium' : 'border-border text-text-secondary',
              )}
            >
              <option value="">All Landing Pages</option>
              {landingOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterCreatives(''); setFilterLanding('') }}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}

          {hasFilters && (
            <span className="text-xs text-text-muted tabular-nums ml-auto">
              {items.length} of {groupCount}
            </span>
          )}
        </div>

        {/* ── Mobile cards ── */}
        <div className="block md:hidden space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-10">
              {hasFilters ? 'No results match your filters.' : 'No items in this wave yet.'}
            </p>
          ) : (
            items.map(item => <ItemCard key={item.id} item={item} showTimeline={showTimeline} showProofread={showProofread} onUpdated={load} isAdmin={isAdmin} />)
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-8 text-center text-text-muted/60">#</TableHeader>
                <SortableHeader label="Product"      sortKey="name"                active={sortKey === 'name'}                dir={sortDir} onSort={toggleSort} className="w-56" />
                <TableHeader />
                <TableHeader />
                <SortableHeader label="Creatives"    sortKey="creatives_status"    active={sortKey === 'creatives_status'}    dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Landing Page" sortKey="landing_page_status" active={sortKey === 'landing_page_status'} dir={sortDir} onSort={toggleSort} />
                {showTimeline && (
                  <>
                    <TableHeader className="whitespace-nowrap">Phase 1 avg</TableHeader>
                    <TableHeader className="whitespace-nowrap">Proofread avg</TableHeader>
                    <TableHeader className="whitespace-nowrap">Launched</TableHeader>
                  </>
                )}
                {showPhase1 && (
                  <TableHeader className="whitespace-nowrap">Phase 1 avg</TableHeader>
                )}
                {showProofread && (
                  <TableHeader className="whitespace-nowrap">Proofread avg</TableHeader>
                )}
                <TableHeader>Variants</TableHeader>
                <TableHeader />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showTimeline ? 11 : showPhase1 ? 10 : showProofread ? 9 : 8} className="text-center text-text-muted py-12">
                    {hasFilters ? 'No results match your filters.' : 'No items in this wave yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => <ItemRow key={item.id} item={item} index={idx + 1} knownNames={knownNames} showTimeline={showTimeline} showProofread={showProofread} showPhase1={showPhase1} onUpdated={load} isAdmin={isAdmin} />)
              )}
            </TableBody>
          </Table>
        </div>

      </div>
    </div>
  )
}
