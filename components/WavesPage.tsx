'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import type { MondayWave, MondayItem, MondaySubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'

// ── Status badge ────────────────────────────────────────────────────────────

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

// ── Platform flags ──────────────────────────────────────────────────────────

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

// ── Subitem row ─────────────────────────────────────────────────────────────

function SubitemRow({ sub }: { sub: MondaySubitem }) {
  return (
    <tr className="border-t border-border-subtle/50 bg-surface-page/50">
      <td className="pl-10 pr-3 py-2 text-sm text-text-muted">{sub.name}</td>
      <td className="px-3 py-2"><StatusBadge label={sub.ad_status} /></td>
      <td className="px-3 py-2"><StatusBadge label={sub.website_status} /></td>
      <td className="px-3 py-2">
        {sub.concluded
          ? <span className="text-xs text-green-600 font-medium">Done</span>
          : <span className="text-xs text-text-muted">—</span>}
      </td>
      <td className="px-3 py-2"><PlatformFlags sub={sub} /></td>
      <td className="px-3 py-2">
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
      </td>
    </tr>
  )
}

// ── Item row (expandable) ───────────────────────────────────────────────────

function ItemRow({ item }: { item: MondayItem }) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.monday_subitems.length > 0

  return (
    <>
      <tr
        className={cn('border-t border-border-subtle hover:bg-surface-hover transition-colors',
          open && 'bg-surface-hover')}
        onClick={() => hasSubs && setOpen(o => !o)}
        style={{ cursor: hasSubs ? 'pointer' : 'default' }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasSubs ? (
              open
                ? <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
                : <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">{item.name}</span>
          </div>
        </td>
        <td className="px-3 py-3"><StatusBadge label={item.creatives_status} /></td>
        <td className="px-3 py-3"><StatusBadge label={item.landing_page_status} /></td>
        <td className="px-3 py-3 text-sm text-text-muted">{item.found_by || '—'}</td>
        <td className="px-3 py-3 text-xs text-text-muted">
          {hasSubs ? `${item.monday_subitems.length} variant${item.monday_subitems.length !== 1 ? 's' : ''}` : '—'}
        </td>
        <td className="px-3 py-3">
          {item.drive_link && (
            <a href={item.drive_link} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}
               className="text-xs text-accent hover:underline flex items-center gap-0.5">
              Drive <ExternalLink size={10} />
            </a>
          )}
        </td>
      </tr>

      {open && item.monday_subitems.map(sub => (
        <SubitemRow key={sub.id} sub={sub} />
      ))}
    </>
  )
}

// ── Wave content ────────────────────────────────────────────────────────────

function WaveContent({ wave }: { wave: MondayWave }) {
  const groups = Array.from(new Set(wave.monday_items.map(i => i.group_name ?? 'General')))

  if (!wave.monday_items.length) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">No items in this wave yet.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs text-text-muted uppercase tracking-wide">
            <th className="px-4 py-2 text-left font-medium w-64">Product</th>
            <th className="px-3 py-2 text-left font-medium">Creatives</th>
            <th className="px-3 py-2 text-left font-medium">Landing Page</th>
            <th className="px-3 py-2 text-left font-medium">Found by</th>
            <th className="px-3 py-2 text-left font-medium">Variants</th>
            <th className="px-3 py-2 text-left font-medium">Links</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            const items = wave.monday_items.filter(i => (i.group_name ?? 'General') === group)
            return (
              <>
                {groups.length > 1 && (
                  <tr key={`g-${group}`}>
                    <td colSpan={6} className="px-4 pt-4 pb-1">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        {group}
                      </span>
                    </td>
                  </tr>
                )}
                {items.map(item => <ItemRow key={item.id} item={item} />)}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // auto-sync every 5 minutes

export function WavesPage() {
  const [waves, setWaves] = useState<MondayWave[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [activeWave, setActiveWave] = useState<string | null>(null)
  const activeWaveRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get<MondayWave[]>('/api/monday/waves')
      setWaves(data)
      if (!activeWaveRef.current && data.length) {
        activeWaveRef.current = data[0].id
        setActiveWave(data[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load waves:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const syncFromMonday = useCallback(async (boardId?: string) => {
    if (!boardId) return
    setSyncing(true)
    setSyncError(null)
    try {
      await api.post(`/api/monday/sync/${boardId}`, {})
      await load()
      setLastSynced(new Date())
    } catch (err: any) {
      setSyncError(err.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [load])

  // Initial load
  useEffect(() => { load() }, [load])

  // Auto-sync active wave every 5 minutes
  const currentBoardRef = useRef<string | null>(null)
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentBoardRef.current) syncFromMonday(currentBoardRef.current)
    }, SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [syncFromMonday])

  const current = waves.find(w => w.id === activeWave)
  currentBoardRef.current = current?.board_id ?? null

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
    <div className="flex flex-col gap-0 h-full">
      {/* Wave tabs + sync button */}
      <div className="border-b border-border-subtle bg-surface-elevated px-4 flex items-center justify-between gap-4">
        <div className="flex gap-0 overflow-x-auto min-w-0">
          {waves.map(w => (
            <button
              key={w.id}
              onClick={() => setActiveWave(w.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
                activeWave === w.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-foreground hover:border-border-subtle'
              )}
            >
              {w.name}
              <span className={cn(
                'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                activeWave === w.id ? 'bg-accent/10 text-accent' : 'bg-surface-page text-text-muted'
              )}>
                {w.monday_items.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {lastSynced && (
            <span className="text-xs text-text-muted hidden sm:block">
              Synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {syncError && (
            <span className="text-xs text-red-500 hidden sm:block max-w-48 truncate" title={syncError}>
              {syncError}
            </span>
          )}
          <button
            onClick={() => syncFromMonday(current?.board_id ?? undefined)}
            disabled={syncing || !current?.board_id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-surface-elevated">
        {current && <WaveContent wave={current} />}
      </div>
    </div>
  )
}
