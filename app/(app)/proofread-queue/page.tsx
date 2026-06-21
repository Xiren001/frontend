'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, currentMonth, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { Search, X, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { useRole } from '@/lib/role-context'

interface ProofQueueItem {
  id: string
  build_id: string | null
  product_name: string
  monday_url: string | null
  language: string | null
  proofreader: string | null
  type: string | null
  week_number: number | null
  month_year: string | null
  into_proofread: string | null
  proof_end: string | null
  proof_days: number | null
  outcome: string | null
  done: boolean
  created_at: string | null
  source: 'wave' | 'proof_product'
}

function derivedWeek(item: ProofQueueItem): number | null {
  if (item.week_number != null) return item.week_number
  const dateStr = item.created_at ?? item.into_proofread
  if (!dateStr) return null
  const day = new Date(dateStr).getDate()
  return Math.min(4, Math.ceil(day / 7))
}

type ViewMode = 'active' | 'done'
type WeekTab  = 'all' | 'direct' | 'duplicates' | number

function daysInProofread(item: ProofQueueItem): number | null {
  if (!item.into_proofread) return null
  if (item.proof_days !== null) return item.proof_days
  const end = item.proof_end ? new Date(item.proof_end) : new Date()
  return Math.round((end.getTime() - new Date(item.into_proofread).getTime()) / 86_400_000)
}

export default function ProofreadQueuePage() {
  const { role } = useRole()
  const isProofreader = role === 'proofreader'
  const [items, setItems]             = useState<ProofQueueItem[]>([])
  const [month, setMonth]             = useState(currentMonth())
  const [viewMode, setViewMode]       = useState<ViewMode>('active')
  const [weekTab, setWeekTab]         = useState<WeekTab>('all')
  const [directWeek, setDirectWeek]   = useState<number | 'all'>('all')
  const [langTab, setLangTab]         = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const load = useCallback(() => {
    api.get<ProofQueueItem[]>(`/api/builds/proofread-queue?month=${month}`)
      .then(setItems).catch(console.error)
  }, [month])

  useRealtimeRefresh('monday_subitems', load)

  useEffect(() => { load() }, [load])

  useEffect(() => { setWeekTab('all'); setDirectWeek('all'); setLangTab('all'); setSearchQuery('') }, [month, viewMode])
  useEffect(() => { setDirectWeek('all') }, [weekTab])

  // ── Split active / done ────────────────────────────────────────────────
  const activeItems = items.filter(b => !b.done)
  const doneItems   = items.filter(b => b.done)
  const baseItems   = viewMode === 'active' ? activeItems : doneItems

  // ── Derived ────────────────────────────────────────────────────────────
  const weekNumbers = Array.from(new Set(
    activeItems.filter(b => b.source === 'wave' && b.week_number != null).map(b => b.week_number!)
  )).sort((a, b) => a - b)

  const hasDirectItems = activeItems.some(b => b.source === 'proof_product')

  const doneWeekNumbers = Array.from(new Set(
    doneItems.filter(b => b.source === 'wave' && b.week_number != null).map(b => b.week_number!)
  )).sort((a, b) => a - b)

  const hasDoneDirectItems = doneItems.some(b => b.source === 'proof_product')

  const byName = activeItems.reduce<Record<string, ProofQueueItem[]>>((acc, b) => {
    const key = b.product_name.toLowerCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})
  const duplicateItems = Object.values(byName).filter(g => g.length > 1).flat()

  const uniqueLangs = Array.from(new Set(baseItems.map(b => b.language).filter(Boolean))).sort() as string[]

  // ── Filters ────────────────────────────────────────────────────────────
  const directItems = baseItems.filter(b => b.source === 'proof_product')
  const directWeekNums = Array.from(new Set(directItems.map(b => derivedWeek(b)).filter((n): n is number => n != null))).sort((a, b) => a - b)

  const weekFiltered: ProofQueueItem[] =
    weekTab === 'all'        ? baseItems :
    weekTab === 'direct'     ? (directWeek === 'all' ? directItems : directItems.filter(b => derivedWeek(b) === directWeek)) :
    weekTab === 'duplicates' ? (viewMode === 'active' ? duplicateItems : baseItems) :
    baseItems.filter(b => b.week_number === (weekTab as number))

  const langFiltered = langTab === 'all' ? weekFiltered : weekFiltered.filter(b => b.language === langTab)

  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? langFiltered.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.proofreader ?? '').toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : langFiltered

  // ── Tab data ───────────────────────────────────────────────────────────
  const weekTabItems = [
    { id: 'all' as WeekTab, label: 'All', count: activeItems.length },
    ...weekNumbers.map(w => ({ id: w as WeekTab, label: `Week ${w}`, count: activeItems.filter(b => b.week_number === w).length })),
    ...(hasDirectItems ? [{ id: 'direct' as WeekTab, label: 'Direct', count: activeItems.filter(b => b.source === 'proof_product').length }] : []),
    ...(duplicateItems.length > 0 ? [{ id: 'duplicates' as WeekTab, label: 'Duplicates', count: duplicateItems.length }] : []),
  ]

  const doneWeekTabItems = [
    { id: 'all' as WeekTab, label: 'All', count: doneItems.length },
    ...doneWeekNumbers.map(w => ({ id: w as WeekTab, label: `Week ${w}`, count: doneItems.filter(b => b.week_number === w).length })),
    ...(hasDoneDirectItems ? [{ id: 'direct' as WeekTab, label: 'Direct', count: doneItems.filter(b => b.source === 'proof_product').length }] : []),
  ]

  const langPills = [
    { id: 'all', label: 'All', count: weekFiltered.length },
    ...uniqueLangs.map(lang => ({ id: lang, label: lang, count: weekFiltered.filter(b => b.language === lang).length })),
  ]

  // ── Row grouping ───────────────────────────────────────────────────────
  type RowGroup = { key: string; label: string; items: ProofQueueItem[] }

  const rowGroups: RowGroup[] = (() => {
    if (weekTab === 'all') {
      const groups: RowGroup[] = []
      for (const item of visible) {
        let key: string, label: string
        if (item.source === 'proof_product') {
          key = `direct-${item.language ?? 'unknown'}`
          label = `Added directly — ${item.language ?? '—'}`
        } else {
          key = item.week_number != null ? `w${item.week_number}` : 'no-week'
          label = item.week_number != null ? `Week ${item.week_number}` : 'Unknown week'
        }
        let group = groups.find(g => g.key === key)
        if (!group) { group = { key, label, items: [] }; groups.push(group) }
        group.items.push(item)
      }
      return groups.sort((a, b) => {
        if (a.key.startsWith('direct') && !b.key.startsWith('direct')) return 1
        if (!a.key.startsWith('direct') && b.key.startsWith('direct')) return -1
        return a.key.localeCompare(b.key)
      })
    }

    if (weekTab === 'duplicates' && viewMode === 'active') {
      const groups: RowGroup[] = []
      const seen = new Set<string>()
      for (const item of visible) {
        const key = item.product_name.toLowerCase()
        if (!seen.has(key)) { seen.add(key); groups.push({ key, label: item.product_name, items: [] }) }
        groups.find(g => g.key === key)!.items.push(item)
      }
      return groups
    }

    return [{ key: 'flat', label: '', items: visible }]
  })()

  const showGroupHeaders = weekTab === 'all' || (weekTab === 'duplicates' && viewMode === 'active')
  const colSpan = 8

  // ── Shared item renderer helpers ───────────────────────────────────────
  function SourceBadge({ b }: { b: ProofQueueItem }) {
    return b.source === 'proof_product'
      ? <Badge variant="muted">Direct</Badge>
      : <Badge variant="default">Wave</Badge>
  }

  function TypeBadge({ b }: { b: ProofQueueItem }) {
    if (b.type === 'jewelry') return <Badge variant="accent">Jewelry</Badge>
    if (b.type === 'funnel')  return <Badge variant="default">Funnel</Badge>
    return null
  }

  const emptyMsg = searchQuery
    ? `No results for "${searchQuery}"`
    : viewMode === 'done'
      ? 'No completed items for this month.'
      : 'Queue is empty — all clear.'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
      <PageHeader
        title="Proofread Queue"
        description="Proofread builds grouped by week. Items flagged red exceed the 3-day target."
        actions={
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-auto"
            mono
          />
        }
      />

      {/* ── View mode toggle ── */}
      <div className="flex gap-2 mb-5">
        {([
          { id: 'active', label: 'Active',             shortLabel: 'Active', icon: Clock,         count: activeItems.length },
          { id: 'done',   label: 'Done Proofreading',  shortLabel: 'Done',   icon: CheckCircle2,  count: doneItems.length  },
        ] as const).map(v => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            className={cn(
              'flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              viewMode === v.id
                ? v.id === 'done'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-accent-muted text-accent-bright border-accent-border/50'
                : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
            )}
          >
            <v.icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{v.label}</span>
            <span className="sm:hidden">{v.shortLabel}</span>
            <span className={cn(
              'text-xs font-mono px-1.5 py-0.5 rounded',
              viewMode === v.id
                ? v.id === 'done' ? 'text-green-400 bg-green-500/10' : 'text-accent bg-accent-muted'
                : 'text-text-muted bg-surface',
            )}>
              {v.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Week tabs ── */}
      {viewMode === 'active' && (
        <Tabs tabs={weekTabItems} active={weekTab} onChange={v => setWeekTab(v as WeekTab)} />
      )}
      {viewMode === 'done' && doneWeekTabItems.length > 1 && (
        <Tabs tabs={doneWeekTabItems} active={weekTab} onChange={v => setWeekTab(v as WeekTab)} />
      )}

      {/* ── Direct week sub-filter ── */}
      {weekTab === 'direct' && directWeekNums.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          {[{ id: 'all' as const, label: 'All weeks' }, ...directWeekNums.map(w => ({ id: w as number | 'all', label: `Week ${w}` }))].map(opt => (
            <button
              key={String(opt.id)}
              onClick={() => setDirectWeek(opt.id)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                directWeek === opt.id
                  ? 'bg-accent-muted text-accent-bright border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Lang pills + search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 mb-4 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {langPills.map(p => (
            <button
              key={p.id}
              onClick={() => setLangTab(p.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                langTab === p.id
                  ? 'bg-accent-muted text-accent-bright border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
              )}
            >
              {p.label}
              <span className={cn('font-mono', langTab === p.id ? 'text-accent' : 'text-text-muted')}>{p.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-52 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      </div>{/* end shrink-0 */}

      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* ── Mobile: card list ── */}
      <div className="md:hidden">
        {visible.length === 0 ? (
          <p className="text-center text-text-muted py-12 text-sm">{emptyMsg}</p>
        ) : (
          rowGroups.map(group => (
            <div key={group.key}>
              {showGroupHeaders && group.items.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-5 pb-2 first:pt-1">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">{group.label}</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-xs font-mono text-text-muted">{group.items.length}</span>
                </div>
              )}
              <div className="space-y-3">
                {group.items.map(b => {
                  const days    = daysInProofread(b)
                  const flagged = viewMode === 'active' && days !== null && days > 3

                  return (
                    <div
                      key={b.id}
                      className={cn(
                        'rounded-xl border bg-surface-elevated p-4',
                        viewMode === 'done'   ? 'border-border-subtle opacity-75'      :
                        flagged               ? 'border-danger/40 bg-danger-muted/10'  :
                                                'border-border-subtle',
                      )}
                    >
                      {/* Name + flag */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        {!isProofreader && b.monday_url ? (
                          <a
                            href={b.monday_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-1 group flex-1"
                          >
                            <span className="text-[15px] font-medium text-accent group-hover:text-accent-bright transition-colors leading-snug line-clamp-2">{b.product_name}</span>
                            <ExternalLink className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-colors shrink-0 mt-0.5" />
                          </a>
                        ) : (
                          <span className="text-[15px] font-medium text-foreground leading-snug flex-1">
                            {b.product_name}
                          </span>
                        )}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {flagged && <Badge variant="danger">RED</Badge>}
                          {b.created_at && (
                            <span className="text-xs font-mono text-text-muted">{formatDate(b.created_at)}</span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-4">
                        <SourceBadge b={b} />
                        <TypeBadge b={b} />
                        {b.language && (
                          <span className="text-xs font-mono bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary">
                            {b.language}
                          </span>
                        )}
                      </div>

                      {/* Date grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                          <p className="text-xs text-text-muted mb-0.5">In Proofread Since</p>
                          <p className="font-mono text-text-secondary text-sm">
                            {b.into_proofread ? formatDate(b.into_proofread) : '—'}
                          </p>
                        </div>
                        {viewMode === 'active' ? (
                          <div>
                            <p className="text-xs text-text-muted mb-0.5">Days</p>
                            <p className={cn('font-mono font-semibold', flagged ? 'text-danger' : 'text-foreground')}>
                              {days ?? '—'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-text-muted mb-0.5">Completed</p>
                            <p className="font-mono text-text-secondary text-sm">
                              {b.proof_end ? formatDate(b.proof_end) : '—'}
                            </p>
                          </div>
                        )}
                      </div>

                      {b.proofreader && (
                        <div className="pt-3 mt-3 border-t border-border-subtle">
                          <span className="text-sm text-text-muted">{b.proofreader}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Product</TableHeader>
              <TableHeader>Source</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Lang</TableHeader>
              <TableHeader>In Proofread Since</TableHeader>
              {viewMode === 'done'
                ? <TableHeader>Completed</TableHeader>
                : <TableHeader className="text-right">Days</TableHeader>}
              {viewMode === 'active' && <TableHeader>Flag</TableHeader>}
              <TableHeader>Proofreader</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-text-muted py-12">
                  {emptyMsg}
                </TableCell>
              </TableRow>
            )}
            {rowGroups.map(group => (
              <>
                {showGroupHeaders && group.items.length > 0 && (
                  <TableRow key={group.key + '-hdr'} className="bg-surface-elevated/60 border-t-2 border-border-subtle">
                    <TableCell colSpan={colSpan} className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{group.label}</span>
                        <span className="ml-auto text-xs font-mono text-text-muted">
                          {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {group.items.map(b => {
                  const days    = daysInProofread(b)
                  const flagged = viewMode === 'active' && days !== null && days > 3

                  return (
                    <TableRow
                      key={b.id}
                      className={viewMode === 'done' ? 'opacity-70' : flagged ? 'bg-danger-muted/20' : undefined}
                    >
                      <TableCell className="font-medium text-foreground">
                        {!isProofreader && b.monday_url ? (
                          <a
                            href={b.monday_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 group text-accent hover:text-accent-bright transition-colors"
                          >
                            {b.product_name}
                            <ExternalLink className="h-3 w-3 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                          </a>
                        ) : (
                          <span>{b.product_name}</span>
                        )}
                        {b.created_at && (
                          <p className="text-xs font-mono text-text-muted mt-0.5">{formatDate(b.created_at)}</p>
                        )}
                      </TableCell>
                      <TableCell><SourceBadge b={b} /></TableCell>
                      <TableCell><TypeBadge b={b} /> </TableCell>
                      <TableCell mono>{b.language ?? '—'}</TableCell>
                      <TableCell mono className="whitespace-nowrap">
                        {b.into_proofread ? formatDate(b.into_proofread) : <span className="text-text-muted">—</span>}
                      </TableCell>
                      {viewMode === 'done' ? (
                        <TableCell mono className="whitespace-nowrap">
                          {b.proof_end ? formatDate(b.proof_end) : <span className="text-text-muted">—</span>}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell mono className="text-right">
                            <span className={flagged ? 'text-danger font-medium' : 'text-foreground'}>{days ?? '—'}</span>
                          </TableCell>
                          <TableCell>
                            {flagged ? <Badge variant="danger">RED</Badge> : <span className="text-text-muted">—</span>}
                          </TableCell>
                        </>
                      )}
                      <TableCell>{b.proofreader ?? <span className="text-text-muted">—</span>}</TableCell>
                    </TableRow>
                  )
                })}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>{/* end flex-1 overflow-y-auto */}
    </div>
  )
}
