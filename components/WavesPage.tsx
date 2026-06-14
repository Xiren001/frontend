'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import type { MondayWave, MondayItem, MondaySubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'

// ── Wave color palette ───────────────────────────────────────────────────────

const WAVE_DOT: Record<number, string> = {
  1: 'bg-violet-500',
  2: 'bg-blue-500',
  3: 'bg-emerald-500',
  4: 'bg-amber-500',
  5: 'bg-orange-500',
  6: 'bg-fuchsia-500',
  7: 'bg-teal-500',
  0: 'bg-gray-400',
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
    <TableRow className="bg-surface-page/50 hover:bg-surface-hover/50">
      <TableCell className="pl-10 text-text-muted">{sub.name}</TableCell>
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
        className={cn(open && 'bg-surface-hover')}
        onClick={() => hasSubs && setOpen(o => !o)}
        style={{ cursor: hasSubs ? 'pointer' : 'default' }}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {hasSubs ? (
              open
                ? <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
                : <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className="font-medium">{item.name}</span>
          </div>
        </TableCell>
        <TableCell><StatusBadge label={item.creatives_status} /></TableCell>
        <TableCell><StatusBadge label={item.landing_page_status} /></TableCell>
        <TableCell className="text-text-muted">{item.found_by || '—'}</TableCell>
        <TableCell className="text-text-muted text-xs">
          {hasSubs ? `${item.monday_subitems.length} variant${item.monday_subitems.length !== 1 ? 's' : ''}` : '—'}
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

// ── Wave content ─────────────────────────────────────────────────────────────

function WaveContent({ wave }: { wave: MondayWave }) {
  const groups = Array.from(new Set(wave.monday_items.map(i => i.group_name ?? 'General')))
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? '')

  // Reset active group when wave changes
  const currentGroup = groups.includes(activeGroup) ? activeGroup : (groups[0] ?? '')
  const items = wave.monday_items.filter(i => (i.group_name ?? 'General') === currentGroup)

  if (!wave.monday_items.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        No items in this wave yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Group tabs */}
      {groups.length > 1 && (
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border-subtle bg-surface-elevated shrink-0 overflow-x-auto">
          {groups.map(group => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-t whitespace-nowrap transition-colors border-b-2 -mb-px',
                currentGroup === group
                  ? 'text-accent border-accent bg-accent-muted/40'
                  : 'text-text-muted border-transparent hover:text-foreground hover:bg-surface-hover',
              )}
            >
              {group}
              <span className={cn(
                'ml-1.5 text-[10px] rounded-full px-1.5 py-0.5',
                currentGroup === group ? 'bg-accent/15 text-accent' : 'bg-surface-page text-text-muted',
              )}>
                {wave.monday_items.filter(i => (i.group_name ?? 'General') === group).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Table for active group */}
      <div className="flex-1 overflow-auto">
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHead>
            <tr>
              <TableHeader className="w-64">Product</TableHeader>
              <TableHeader>Creatives</TableHeader>
              <TableHeader>Landing Page</TableHeader>
              <TableHeader>Found by</TableHeader>
              <TableHeader>Variants</TableHeader>
              <TableHeader>Links</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {items.map(item => <ItemRow key={item.id} item={item} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ── Wave nav item ────────────────────────────────────────────────────────────

function WaveNavItem({ wave, active, onClick }: { wave: MondayWave; active: boolean; onClick: () => void }) {
  const dot = WAVE_DOT[wave.wave_number] ?? 'bg-gray-400'
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left group',
        active
          ? 'bg-accent-muted text-accent font-medium'
          : 'text-text-secondary hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
      <span className="flex-1 truncate">{wave.name}</span>
      <span className={cn(
        'text-xs rounded-full px-1.5 py-0.5 shrink-0 tabular-nums',
        active ? 'bg-accent/15 text-accent' : 'bg-surface-page text-text-muted group-hover:bg-surface-hover',
      )}>
        {wave.monday_items.length}
      </span>
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function WavesPage() {
  const [waves, setWaves] = useState<MondayWave[]>([])
  const [loading, setLoading] = useState(true)
  const [activeWave, setActiveWave] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

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
    const channel = supabase
      .channel('monday-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monday_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monday_subitems' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
    <div className="flex h-full overflow-hidden">

      {/* ── Side nav ── */}
      <aside className="w-52 shrink-0 border-r border-border-subtle bg-surface-elevated flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-border-subtle">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Waves</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {mainWaves.map(w => (
            <WaveNavItem key={w.id} wave={w} active={activeWave === w.id} onClick={() => setActiveWave(w.id)} />
          ))}
        </nav>

        {stoppedWave && (
          <div className="border-t border-border-subtle px-2 py-2">
            <WaveNavItem
              wave={stoppedWave}
              active={activeWave === stoppedWave.id}
              onClick={() => setActiveWave(stoppedWave.id)}
            />
          </div>
        )}
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border-subtle bg-surface-elevated shrink-0">
          <div className="flex items-center gap-3">
            {current && (
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', WAVE_DOT[current.wave_number] ?? 'bg-gray-400')} />
            )}
            <h1 className="text-sm font-semibold text-foreground">{current?.name ?? '—'}</h1>
            {current && (
              <span className="text-xs text-text-muted bg-surface-page border border-border-subtle px-2 py-0.5 rounded-full">
                {current.monday_items.length} product{current.monday_items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {current?.board_id && (
            <button
              onClick={syncWave}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={cn(syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {current && <WaveContent wave={current} />}
        </div>

      </div>
    </div>
  )
}
