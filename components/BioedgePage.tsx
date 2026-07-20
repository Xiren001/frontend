'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { createClient } from '@/lib/supabase'
import type { BioedgeItem, BioedgeSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'

// ── Status badge ─────────────────────────────────────────────────────────────

const R = 'ring-1 ring-inset'

const STATUS_STYLE: Record<string, string> = {
  'working on it':    `bg-sky-400/10 text-sky-500 ${R} ring-sky-400/30`,
  'waiting':          `bg-yellow-400/10 text-yellow-600 ${R} ring-yellow-400/30`,
  'ready':            `bg-green-400/10 text-green-500 ${R} ring-green-400/30`,
  'ready to launch':  `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`,
  'ready to launched':`bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`,
  'running':          `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`,
  'launched':         `bg-violet-400/10 text-violet-500 ${R} ring-violet-400/30`,
  'expanding':        `bg-fuchsia-400/10 text-fuchsia-500 ${R} ring-fuchsia-400/30`,
  'stopped':          `bg-red-400/10 text-red-500 ${R} ring-red-400/30`,
  'relaunch':         `bg-orange-400/10 text-orange-500 ${R} ring-orange-400/30`,
  'need revision':    `bg-red-400/10 text-red-500 ${R} ring-red-400/30`,
  'proofread':        `bg-teal-400/10 text-teal-500 ${R} ring-teal-400/30`,
  'do not start':     `bg-gray-400/10 text-gray-500 ${R} ring-gray-400/30`,
  'deleted':          `bg-gray-400/10 text-gray-500 ${R} ring-gray-400/30`,
}

function getStatusStyle(label: string): string {
  const l = label.toLowerCase()
  if (STATUS_STYLE[l]) return STATUS_STYLE[l]
  if (l.includes('wait'))                 return `bg-yellow-400/10 text-yellow-600 ${R} ring-yellow-400/30`
  if (l.includes('proof'))                return `bg-teal-400/10 text-teal-500 ${R} ring-teal-400/30`
  if (l.includes('revision'))             return `bg-red-400/10 text-red-500 ${R} ring-red-400/30`
  if (l.includes('stop'))                 return `bg-red-400/10 text-red-500 ${R} ring-red-400/30`
  if (l.includes('launch'))               return `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`
  if (l.includes('run') || l.includes('expand')) return `bg-emerald-400/10 text-emerald-500 ${R} ring-emerald-400/30`
  if (l.includes('work'))                 return `bg-sky-400/10 text-sky-500 ${R} ring-sky-400/30`
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

// ── Subitem row ──────────────────────────────────────────────────────────────

function SubitemRow({ sub, visible }: { sub: BioedgeSubitem; visible: boolean }) {
  const inner = cn(
    'overflow-hidden transition-[max-height,opacity,padding] duration-200 ease-in-out px-4',
    visible ? 'max-h-16 opacity-100 py-2' : 'max-h-0 opacity-0 py-0',
  )
  return (
    <TableRow className="bg-surface/40 hover:bg-surface-hover/30 border-l-0" style={!visible ? { borderBottomWidth: 0 } : undefined}>
      <TableCell className="p-0" />
      <TableCell className="p-0">
        <div className={cn(inner, 'flex items-center gap-2 pl-4')}>
          <span className="w-px h-4 bg-border-subtle shrink-0" />
          <span className="text-xs text-text-muted">{sub.name}</span>
        </div>
      </TableCell>
      <TableCell className="p-0 text-xs text-text-secondary"><div className={inner}>{sub.language ?? '—'}</div></TableCell>
      <TableCell className="p-0 text-xs text-text-secondary"><div className={inner}>{sub.targeted_country ?? '—'}</div></TableCell>
      <TableCell className="p-0"><div className={inner}><StatusBadge label={sub.ad_status} /></div></TableCell>
      <TableCell className="p-0"><div className={inner}><StatusBadge label={sub.funnel_status} /></div></TableCell>
      <TableCell className="p-0 text-xs text-text-secondary"><div className={inner}>{sub.ad_account ?? '—'}</div></TableCell>
      <TableCell className="p-0">
        <div className={cn(inner, 'flex flex-col gap-0.5')}>
          {sub.ads_drive_link && (
            <a href={sub.ads_drive_link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Drive <ExternalLink size={10} />
            </a>
          )}
          {sub.completed_funnel_url && (
            <a href={sub.completed_funnel_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Funnel <ExternalLink size={10} />
            </a>
          )}
          {sub.monday_url && (
            <a href={sub.monday_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Monday <ExternalLink size={10} />
            </a>
          )}
          {!sub.ads_drive_link && !sub.completed_funnel_url && !sub.monday_url && <span className="text-xs text-text-muted">—</span>}
        </div>
      </TableCell>
    </TableRow>
  )
}

function SubitemHeaderRow({ visible }: { visible: boolean }) {
  const cls = cn(
    'overflow-hidden transition-[max-height,opacity,padding] duration-200 ease-in-out px-2',
    visible ? 'max-h-8 opacity-100 py-1' : 'max-h-0 opacity-0 py-0',
  )
  const lbl = 'text-[10px] font-semibold uppercase tracking-wider text-text-muted'
  return (
    <TableRow className="bg-surface-elevated/40 border-l-0">
      <TableCell className="p-0" />
      <TableCell className="p-0"><div className={cls}><span className={cn(lbl, 'pl-10')}>Variant</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Language</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Country</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Ad Status</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Funnel Status</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Ad Account</span></div></TableCell>
      <TableCell className="p-0"><div className={cls}><span className={lbl}>Links</span></div></TableCell>
    </TableRow>
  )
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, index }: { item: BioedgeItem; index: number }) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.bioedge_subitems.length > 0
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
            <span className="text-sm font-medium text-accent truncate max-w-[200px]">{item.name}</span>
          </div>
        </TableCell>
        <TableCell><StatusBadge label={item.ad_status} /></TableCell>
        <TableCell><StatusBadge label={item.funnel_status} /></TableCell>
        <TableCell className="text-xs text-text-secondary">{item.batch ?? '—'}</TableCell>
        <TableCell className="text-text-muted text-xs">
          {hasSubs
            ? <span className="bg-surface-page border border-border-subtle rounded-full px-2 py-0.5 text-[11px]">{item.bioedge_subitems.length}</span>
            : '—'}
        </TableCell>
      </TableRow>
      {hasSubs && <SubitemHeaderRow visible={open} />}
      {hasSubs && [...item.bioedge_subitems]
        .sort((a, b) => (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase()))
        .map(sub => <SubitemRow key={sub.id} sub={sub} visible={open} />)}
    </>
  )
}

// ── Mobile item card ──────────────────────────────────────────────────────────

function ItemCard({ item }: { item: BioedgeItem }) {
  const [open, setOpen] = useState(false)
  const hasSubs = item.bioedge_subitems.length > 0
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-foreground leading-snug">{item.name}</p>
        {hasSubs && (
          <button onClick={() => setOpen(o => !o)} className="shrink-0 text-text-muted hover:text-foreground p-1 rounded">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.ad_status     && <StatusBadge label={item.ad_status} />}
        {item.funnel_status && <StatusBadge label={item.funnel_status} />}
        {item.batch && <span className="text-xs bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">{item.batch}</span>}
        {hasSubs && (
          <span className="text-xs bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">
            {item.bioedge_subitems.length} variant{item.bioedge_subitems.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
          {item.bioedge_subitems.map(sub => (
            <div key={sub.id} className="pl-2 border-l-2 border-border-subtle">
              <p className="text-xs text-text-muted italic mb-1">{sub.name} — {sub.language ?? '—'} / {sub.targeted_country ?? '—'}</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {sub.ad_status     && <StatusBadge label={sub.ad_status} />}
                {sub.funnel_status && <StatusBadge label={sub.funnel_status} />}
              </div>
              {(sub.ads_drive_link || sub.completed_funnel_url || sub.monday_url) && (
                <div className="flex items-center gap-2 mt-1">
                  {sub.ads_drive_link && (
                    <a href={sub.ads_drive_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                      Drive <ExternalLink size={10} />
                    </a>
                  )}
                  {sub.completed_funnel_url && (
                    <a href={sub.completed_funnel_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                      Funnel <ExternalLink size={10} />
                    </a>
                  )}
                  {sub.monday_url && (
                    <a href={sub.monday_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                      Monday <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function BioedgePage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'
  const [items, setItems]     = useState<BioedgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string>('')
  const [search, setSearch]   = useState('')
  const [filterAdStatus, setFilterAdStatus]         = useState('')
  const [filterFunnelStatus, setFilterFunnelStatus] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [registeringHooks, setRegisteringHooks] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get<BioedgeItem[]>('/api/bioedge/items')
      setItems(data)
    } catch (err) {
      console.error('Failed to load BioEdge items:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('bioedge-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bioedge_items' },    load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bioedge_subitems' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function sync() {
    setSyncing(true)
    try {
      await api.post('/api/bioedge/sync', {})
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
      const res = await api.post<{ ok: boolean; results: Record<string, unknown> }>('/api/bioedge/register-hooks', {})
      const boards = Object.keys(res.results)
      alert(`Hooks registered on ${boards.length} board(s)`)
    } catch (err: any) {
      alert('Register failed: ' + err.message)
    } finally {
      setRegisteringHooks(false)
    }
  }

  const groups = Array.from(new Set(items.map(i => i.group_name ?? 'General')))
  const currentGroup = groups.includes(activeGroup) ? activeGroup : (groups[0] ?? '')

  const adStatusOptions = Array.from(new Set(items.map(i => i.ad_status).filter((s): s is string => Boolean(s)))).sort()
  const funnelStatusOptions = Array.from(new Set(items.map(i => i.funnel_status).filter((s): s is string => Boolean(s)))).sort()

  let visible = items.filter(i => (i.group_name ?? 'General') === currentGroup)
  if (search.trim()) {
    const q = search.toLowerCase()
    visible = visible.filter(i => i.name.toLowerCase().includes(q))
  }
  if (filterAdStatus)     visible = visible.filter(i => i.ad_status === filterAdStatus)
  if (filterFunnelStatus) visible = visible.filter(i => i.funnel_status === filterFunnelStatus)
  visible = [...visible].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

  const hasFilters = search || filterAdStatus || filterFunnelStatus
  const groupCount  = items.filter(i => (i.group_name ?? 'General') === currentGroup).length

  const SELECT_CLS = 'rounded-md border border-border bg-surface-elevated px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 cursor-pointer'

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">Loading BioEdge…</div>
  }

  if (!items.length) {
    return (
      <div>
        <PageHeader title="BioEdge" description="Products and language/country variants synced from the BioEdge Monday board." />
        <p className="text-sm text-text-muted">No BioEdge items synced yet. {isAdmin && 'Click Sync below once the board is ready.'}</p>
        {isAdmin && (
          <button
            onClick={sync}
            disabled={syncing}
            className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
          >
            <RefreshCw size={11} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="BioEdge" description="Products and language/country variants synced from the BioEdge Monday board." />

      <div className="space-y-4">
        {/* ── Group tabs + sync ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {groups.map(group => {
              const cnt = items.filter(i => (i.group_name ?? 'General') === group).length
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
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', isActive ? 'bg-white/20 text-white' : 'bg-surface-page text-text-muted')}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={registerHooks}
                disabled={registeringHooks}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
                title="Register Monday.com webhooks for the BioEdge boards"
              >
                {registeringHooks ? 'Registering…' : 'Register Hooks'}
              </button>
            )}
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground border border-border-subtle rounded-md px-3 py-1.5 hover:bg-surface-hover transition-all disabled:opacity-50"
            >
              <RefreshCw size={11} className={cn(syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>

        {/* ── Search + filters ── */}
        <div className="flex items-center gap-2 flex-wrap">
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

          {adStatusOptions.length > 0 && (
            <select value={filterAdStatus} onChange={e => setFilterAdStatus(e.target.value)}
              className={cn(SELECT_CLS, filterAdStatus ? 'border-accent text-accent font-medium' : 'border-border text-text-secondary')}>
              <option value="">All Ad Status</option>
              {adStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {funnelStatusOptions.length > 0 && (
            <select value={filterFunnelStatus} onChange={e => setFilterFunnelStatus(e.target.value)}
              className={cn(SELECT_CLS, filterFunnelStatus ? 'border-accent text-accent font-medium' : 'border-border text-text-secondary')}>
              <option value="">All Funnel Status</option>
              {funnelStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterAdStatus(''); setFilterFunnelStatus('') }}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}

          {hasFilters && (
            <span className="text-xs text-text-muted tabular-nums ml-auto">{visible.length} of {groupCount}</span>
          )}
        </div>

        {/* ── Mobile cards ── */}
        <div className="block md:hidden space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-10">
              {hasFilters ? 'No results match your filters.' : 'No items in this group yet.'}
            </p>
          ) : (
            visible.map(item => <ItemCard key={item.id} item={item} />)
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-8 text-center text-text-muted/60">#</TableHeader>
                <TableHeader className="w-56">Product</TableHeader>
                <TableHeader>Ad Status</TableHeader>
                <TableHeader>Funnel Status</TableHeader>
                <TableHeader>Batch</TableHeader>
                <TableHeader>Variants</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-12">
                    {hasFilters ? 'No results match your filters.' : 'No items in this group yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((item, idx) => <ItemRow key={item.id} item={item} index={idx + 1} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
