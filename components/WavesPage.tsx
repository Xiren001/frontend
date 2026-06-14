'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import type { MondayWave, MondayItem, MondaySubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ChevronDown, ChevronRight, ChevronUp, ExternalLink,
  RefreshCw, Search, X, SlidersHorizontal,
} from 'lucide-react'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'

// ── Wave color palette ───────────────────────────────────────────────────────

const WAVE_DOT: Record<number, string> = {
  1: 'bg-violet-500', 2: 'bg-blue-500',    3: 'bg-emerald-500',
  4: 'bg-amber-500',  5: 'bg-orange-500',  6: 'bg-fuchsia-500',
  7: 'bg-teal-500',   0: 'bg-gray-400',
}

const WAVE_RING: Record<number, string> = {
  1: 'ring-violet-400/30', 2: 'ring-blue-400/30',    3: 'ring-emerald-400/30',
  4: 'ring-amber-400/30',  5: 'ring-orange-400/30',  6: 'ring-fuchsia-400/30',
  7: 'ring-teal-400/30',   0: 'ring-gray-400/20',
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  'not started yet':       'bg-gray-100 text-gray-500',
  'in progress':           'bg-blue-100 text-blue-700',
  'ready':                 'bg-green-100 text-green-700',
  'launched':              'bg-violet-100 text-violet-700',
  'running':               'bg-emerald-100 text-emerald-700',
  'stopped':               'bg-red-100 text-red-600',
  'waiting for editor':    'bg-yellow-100 text-yellow-700',
  'waiting for builder':   'bg-yellow-100 text-yellow-700',
  'working on it':         'bg-blue-100 text-blue-700',
  'waiting for proofread': 'bg-orange-100 text-orange-700',
  'proofread done':        'bg-teal-100 text-teal-700',
  'ready for revision':    'bg-orange-100 text-orange-700',
  'ready to launch':       'bg-emerald-100 text-emerald-700',
  'building - dan':        'bg-sky-100 text-sky-700',
  'building - dora':       'bg-sky-100 text-sky-700',
  'revisions needed':      'bg-red-100 text-red-600',
}

function StatusBadge({ label }: { label: string | null }) {
  if (!label) return <span className="text-text-muted text-xs">—</span>
  const style = STATUS_STYLE[label.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', style)}>
      {label}
    </span>
  )
}

// ── Platform flags ───────────────────────────────────────────────────────────

const PLATFORMS: Array<{ key: keyof MondaySubitem; label: string }> = [
  { key: 'meta',            label: 'Meta' },
  { key: 'tiktok',         label: 'TikTok' },
  { key: 'youtube',        label: 'YT' },
  { key: 'pinterest',      label: 'Pin' },
  { key: 'google_shopping', label: 'GS' },
  { key: 'google_search',  label: 'G🔍' },
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

// ── Subitem row ──────────────────────────────────────────────────────────────

function SubitemRow({ sub }: { sub: MondaySubitem }) {
  return (
    <TableRow className="bg-surface-page/60 hover:bg-surface-hover/40">
      <TableCell className="pl-10 text-text-muted italic text-xs">{sub.name}</TableCell>
      <TableCell><StatusBadge label={sub.ad_status} /></TableCell>
      <TableCell><StatusBadge label={sub.website_status} /></TableCell>
      <TableCell>
        {sub.concluded
          ? <span className="text-xs text-emerald-600 font-medium">Done</span>
          : <span className="text-xs text-text-muted">—</span>}
      </TableCell>
      <TableCell><PlatformFlags sub={sub} /></TableCell>
      <TableCell>
        <div className="flex gap-2">
          {sub.page_link && (
            <a href={sub.page_link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5">
              Page <ExternalLink size={10} />
            </a>
          )}
          {sub.shopify_pdp_link && (
            <a href={sub.shopify_pdp_link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5">
              Shopify <ExternalLink size={10} />
            </a>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Item row (expandable) ────────────────────────────────────────────────────

function ItemRow({ item }: { item: MondayItem }) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.monday_subitems.length > 0

  return (
    <>
      <TableRow
        className={cn(open && 'bg-surface-hover/60')}
        onClick={() => hasSubs && setOpen(o => !o)}
        style={{ cursor: hasSubs ? 'pointer' : 'default' }}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {hasSubs ? (
              <span className="text-text-muted flex-shrink-0">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className="font-medium text-foreground">{item.name}</span>
          </div>
        </TableCell>
        <TableCell><StatusBadge label={item.creatives_status} /></TableCell>
        <TableCell><StatusBadge label={item.landing_page_status} /></TableCell>
        <TableCell className="text-text-muted text-xs">{item.found_by || '—'}</TableCell>
        <TableCell className="text-text-muted text-xs">
          {hasSubs
            ? <span className="bg-surface-page border border-border-subtle rounded-full px-2 py-0.5 text-[11px]">{item.monday_subitems.length}</span>
            : '—'}
        </TableCell>
        <TableCell>
          {item.drive_link && (
            <a href={item.drive_link} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}
               className="text-xs text-accent hover:underline flex items-center gap-0.5">
              Drive <ExternalLink size={10} />
            </a>
          )}
        </TableCell>
      </TableRow>

      {open && item.monday_subitems.map(sub => (
        <SubitemRow key={sub.id} sub={sub} />
      ))}
    </>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────

type SortKey = 'name' | 'creatives_status' | 'landing_page_status' | 'found_by'
type SortDir = 'asc' | 'desc'

function SortableHeader({ label, sortKey, active, dir, onSort, className }: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  return (
    <TableHeader
      className={cn('cursor-pointer select-none group', className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={cn('transition-opacity text-text-muted', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}>
          {active && dir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </span>
      </div>
    </TableHeader>
  )
}

// ── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  if (!options.length) return null
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'text-xs px-2.5 py-1.5 rounded-lg border bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer transition-colors',
        value ? 'border-accent text-accent font-medium' : 'border-border-subtle text-text-secondary hover:border-border',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

// ── Wave content ─────────────────────────────────────────────────────────────

function WaveContent({ wave }: { wave: MondayWave }) {
  const groups = Array.from(new Set(wave.monday_items.map(i => i.group_name ?? 'General')))
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? '')
  const [search, setSearch]           = useState('')
  const [filterCreatives, setFilterCreatives] = useState('')
  const [filterLanding, setFilterLanding]     = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const currentGroup = groups.includes(activeGroup) ? activeGroup : (groups[0] ?? '')

  const creativesOptions = Array.from(new Set(
    wave.monday_items.map(i => i.creatives_status).filter((s): s is string => Boolean(s))
  )).sort()
  const landingOptions = Array.from(new Set(
    wave.monday_items.map(i => i.landing_page_status).filter((s): s is string => Boolean(s))
  )).sort()

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  let items = wave.monday_items.filter(i => (i.group_name ?? 'General') === currentGroup)
  if (search.trim()) {
    const q = search.toLowerCase()
    items = items.filter(i => i.name.toLowerCase().includes(q))
  }
  if (filterCreatives) items = items.filter(i => i.creatives_status === filterCreatives)
  if (filterLanding)   items = items.filter(i => i.landing_page_status === filterLanding)
  if (sortKey) {
    items = [...items].sort((a, b) => {
      const av = (a[sortKey] ?? '').toLowerCase()
      const bv = (b[sortKey] ?? '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }

  const hasFilters = search || filterCreatives || filterLanding

  if (!wave.monday_items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted">
        <SlidersHorizontal size={20} className="opacity-30" />
        <span className="text-sm">No items in this wave yet.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0 px-4 py-2.5 border-b border-border-subtle bg-surface-elevated/50">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={13} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border-subtle bg-surface-elevated text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 w-52 transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <FilterSelect
          value={filterCreatives}
          onChange={setFilterCreatives}
          placeholder="All Creatives"
          options={creativesOptions}
        />
        <FilterSelect
          value={filterLanding}
          onChange={setFilterLanding}
          placeholder="All Landing Pages"
          options={landingOptions}
        />

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterCreatives(''); setFilterLanding('') }}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X size={11} /> Clear
          </button>
        )}

        <div className="flex-1" />
        <span className="text-xs text-text-muted tabular-nums shrink-0">
          {items.length} of {wave.monday_items.filter(i => (i.group_name ?? 'General') === currentGroup).length}
        </span>
      </div>

      {/* ── Group tabs ── */}
      {groups.length > 1 && (
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto px-4 py-2 border-b border-border-subtle">
          {groups.map(group => {
            const cnt = wave.monday_items.filter(i => (i.group_name ?? 'General') === group).length
            return (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all border',
                  currentGroup === group
                    ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                    : 'text-text-secondary bg-surface-elevated border-border-subtle hover:text-foreground hover:border-border',
                )}
              >
                {group}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  currentGroup === group ? 'bg-white/20 text-white' : 'bg-surface-page text-text-muted',
                )}>
                  {cnt}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Table ── */}
      <Table containerClassName="rounded-none border-x-0 border-b-0 shadow-none">
        <TableHead>
          <tr>
            <SortableHeader label="Product"      sortKey="name"               active={sortKey === 'name'}               dir={sortDir} onSort={toggleSort} className="w-64" />
            <SortableHeader label="Creatives"    sortKey="creatives_status"   active={sortKey === 'creatives_status'}   dir={sortDir} onSort={toggleSort} />
            <SortableHeader label="Landing Page" sortKey="landing_page_status" active={sortKey === 'landing_page_status'} dir={sortDir} onSort={toggleSort} />
            <SortableHeader label="Found by"     sortKey="found_by"           active={sortKey === 'found_by'}           dir={sortDir} onSort={toggleSort} />
            <TableHeader>Variants</TableHeader>
            <TableHeader>Links</TableHeader>
          </tr>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">
                No results match your filters.
              </td>
            </tr>
          ) : (
            items.map(item => <ItemRow key={item.id} item={item} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Wave nav item ────────────────────────────────────────────────────────────

function WaveNavItem({ wave, active, onClick }: { wave: MondayWave; active: boolean; onClick: () => void }) {
  const dot  = WAVE_DOT[wave.wave_number]  ?? 'bg-gray-400'
  const ring = WAVE_RING[wave.wave_number] ?? 'ring-gray-400/20'
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left group',
        active
          ? cn('bg-surface-page shadow-sm ring-1', ring, 'font-medium text-foreground')
          : 'text-text-secondary hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0 transition-transform', dot, active && 'scale-125')} />
      <span className="flex-1 truncate text-xs">{wave.name}</span>
      <span className={cn(
        'text-[10px] rounded-full px-1.5 py-0.5 shrink-0 tabular-nums transition-colors',
        active ? 'bg-accent/10 text-accent font-semibold' : 'bg-surface-page text-text-muted group-hover:bg-surface-hover',
      )}>
        {wave.monday_items.length}
      </span>
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function WavesPage() {
  const [waves, setWaves]       = useState<MondayWave[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeWave, setActiveWave] = useState<string | null>(null)
  const [syncing, setSyncing]   = useState(false)

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

  const mainWaves   = waves.filter(w => w.wave_number !== 0).sort((a, b) => a.wave_number - b.wave_number)
  const stoppedWave = waves.find(w => w.wave_number === 0)
  const current     = waves.find(w => w.id === activeWave)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Loading waves…
      </div>
    )
  }

  if (!waves.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-text-muted text-sm">
        <p>No waves imported yet.</p>
        <p className="text-xs">Run the import from the admin panel to seed the data.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-surface-page">

      {/* ── Side nav ── */}
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface-elevated flex flex-col overflow-hidden">
        {/* Sidebar header */}
        <div className="px-4 py-5">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Waves</p>
        </div>

        {/* Wave list */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {mainWaves.map(w => (
            <WaveNavItem
              key={w.id}
              wave={w}
              active={activeWave === w.id}
              onClick={() => setActiveWave(w.id)}
            />
          ))}
        </nav>

        {/* Stopped wave pinned at bottom */}
        {stoppedWave && (
          <div className="px-2 pb-3 pt-2 border-t border-border-subtle">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 pb-1.5">Stopped</p>
            <WaveNavItem
              wave={stoppedWave}
              active={activeWave === stoppedWave.id}
              onClick={() => setActiveWave(stoppedWave.id)}
            />
          </div>
        )}
      </aside>

      {/* ── Content panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Content header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-elevated shrink-0">
          <div className="flex items-center gap-3">
            {current && (
              <span className={cn(
                'w-3 h-3 rounded-full shrink-0 ring-4',
                WAVE_DOT[current.wave_number]  ?? 'bg-gray-400',
                WAVE_RING[current.wave_number] ?? 'ring-gray-400/20',
              )} />
            )}
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">{current?.name ?? '—'}</h1>
              {current && (
                <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                  {current.monday_items.length} product{current.monday_items.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {current?.board_id && (
            <button
              onClick={syncWave}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-lg px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={11} className={cn(syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
        </div>

        {/* Wave content — key forces remount on wave switch to reset filters */}
        <div className="flex-1 overflow-hidden">
          {current && <WaveContent key={current.id} wave={current} />}
        </div>

      </div>
    </div>
  )
}
