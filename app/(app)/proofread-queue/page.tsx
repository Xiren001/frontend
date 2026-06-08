'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, currentMonth, cn } from '@/lib/utils'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { Search, X, CheckCircle2, Clock } from 'lucide-react'

interface ProofQueueItem {
  id: string
  build_id: string | null
  product_name: string
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
  source: 'build' | 'proof_product'
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
  const [items, setItems]           = useState<ProofQueueItem[]>([])
  const [month, setMonth]           = useState(currentMonth())
  const [viewMode, setViewMode]     = useState<ViewMode>('active')
  const [weekTab, setWeekTab]       = useState<WeekTab>('all')
  const [langTab, setLangTab]       = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin]       = useState(false)
  const [advancing, setAdvancing]   = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<ProofQueueItem[]>(`/api/builds/proofread-queue?month=${month}`)
      .then(setItems).catch(console.error)
  }, [month])

  useRealtimeRefresh('builds', load)

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [load])

  // Reset navigation when month or view changes
  useEffect(() => { setWeekTab('all'); setLangTab('all'); setSearchQuery('') }, [month, viewMode])

  async function endProofread(item: ProofQueueItem) {
    if (!item.build_id) return
    setAdvancing(item.id)
    try {
      await api.put(`/api/builds/${item.build_id}`, {
        proof_end: new Date().toISOString().split('T')[0],
      })
      load()
    } finally {
      setAdvancing(null)
    }
  }

  // ── Split into active / done ───────────────────────────────────────────
  const activeItems = items.filter(b => !b.done)
  const doneItems   = items.filter(b => b.done)
  const baseItems   = viewMode === 'active' ? activeItems : doneItems

  // ── Derived: unique week numbers and languages ─────────────────────────
  const weekNumbers = Array.from(new Set(
    activeItems.filter(b => b.source === 'build' && b.week_number != null).map(b => b.week_number!)
  )).sort((a, b) => a - b)

  const hasDirectItems = activeItems.some(b => b.source === 'proof_product')

  const byName = activeItems.reduce<Record<string, ProofQueueItem[]>>((acc, b) => {
    const key = b.product_name.toLowerCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})
  const duplicateItems = Object.values(byName).filter(g => g.length > 1).flat()

  const uniqueLangs = Array.from(new Set(baseItems.map(b => b.language).filter(Boolean))).sort() as string[]

  // ── Apply filters ──────────────────────────────────────────────────────

  // Week filter (active view only)
  const weekFiltered: ProofQueueItem[] = viewMode !== 'active' ? baseItems :
    weekTab === 'all'        ? baseItems :
    weekTab === 'direct'     ? baseItems.filter(b => b.source === 'proof_product') :
    weekTab === 'duplicates' ? duplicateItems :
    baseItems.filter(b => b.week_number === (weekTab as number))

  // Lang filter
  const langFiltered = langTab === 'all' ? weekFiltered : weekFiltered.filter(b => b.language === langTab)

  // Search
  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? langFiltered.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.proofreader ?? '').toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : langFiltered

  // ── Tab definitions ────────────────────────────────────────────────────

  const weekTabItems = [
    { id: 'all' as WeekTab,  label: 'All',  count: activeItems.length },
    ...weekNumbers.map(w => ({
      id: w as WeekTab,
      label: `Week ${w}`,
      count: activeItems.filter(b => b.week_number === w).length,
    })),
    ...(hasDirectItems ? [{
      id: 'direct' as WeekTab,
      label: 'Direct',
      count: activeItems.filter(b => b.source === 'proof_product').length,
    }] : []),
    ...(duplicateItems.length > 0 ? [{
      id: 'duplicates' as WeekTab,
      label: 'Duplicates',
      count: duplicateItems.length,
    }] : []),
  ]

  const langPills = [
    { id: 'all', label: 'All', count: weekFiltered.length },
    ...uniqueLangs.map(lang => ({
      id: lang,
      label: lang,
      count: weekFiltered.filter(b => b.language === lang).length,
    })),
  ]

  // ── Row grouping (active view only) ───────────────────────────────────
  type RowGroup = { key: string; label: string; items: ProofQueueItem[] }

  const rowGroups: RowGroup[] = (() => {
    if (viewMode !== 'active') return [{ key: 'flat', label: '', items: visible }]

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

    if (weekTab === 'duplicates') {
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

  const showGroupHeaders = viewMode === 'active' && (weekTab === 'all' || weekTab === 'duplicates')
  const colSpan = isAdmin ? 9 : 8

  return (
    <div>
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

      {/* ── View mode toggle ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        {([
          { id: 'active', label: 'Active', icon: Clock,         count: activeItems.length },
          { id: 'done',   label: 'Done Proofreading', icon: CheckCircle2, count: doneItems.length },
        ] as const).map(v => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              viewMode === v.id
                ? v.id === 'done'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-accent-muted text-accent-bright border-accent-border/50'
                : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
            )}
          >
            <v.icon className="h-4 w-4" />
            {v.label}
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

      {/* ── Week tabs (active view only) ──────────────────────────────── */}
      {viewMode === 'active' && (
        <Tabs
          tabs={weekTabItems}
          active={weekTab}
          onChange={v => setWeekTab(v as WeekTab)}
        />
      )}

      {/* ── Language pills + search ───────────────────────────────────── */}
      <div className="flex items-center gap-3 py-3 mb-4 border-b border-border-subtle">
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
              <span className={cn('font-mono', langTab === p.id ? 'text-accent' : 'text-text-muted')}>
                {p.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 w-52"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
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
              {isAdmin && <TableHeader />}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-text-muted py-12">
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : viewMode === 'done'
                      ? 'No completed items for this month.'
                      : 'Queue is empty — all clear.'}
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
                  const trackerHref = b.type === 'funnel' ? '/funnel-tracker' : b.source === 'proof_product' ? '/copy-review' : '/jewelry-tracker'

                  return (
                    <TableRow
                      key={b.id}
                      className={viewMode === 'done' ? 'opacity-70' : flagged ? 'bg-danger-muted/20' : undefined}
                    >
                      <TableCell className="font-medium text-foreground">
                        <Link href={trackerHref} className="hover:text-accent transition-colors">
                          {b.product_name}
                        </Link>
                      </TableCell>

                      <TableCell>
                        {b.source === 'proof_product'
                          ? <Badge variant="muted">Direct</Badge>
                          : <Badge variant="default">Tracker</Badge>}
                      </TableCell>

                      <TableCell>
                        {b.type === 'jewelry' ? (
                          <Badge variant="accent">Jewelry</Badge>
                        ) : b.type === 'funnel' ? (
                          <Badge variant="default">Funnel</Badge>
                        ) : (
                          <span className="text-text-muted text-sm">—</span>
                        )}
                      </TableCell>

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
                            <span className={flagged ? 'text-danger font-medium' : 'text-foreground'}>
                              {days ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {flagged
                              ? <Badge variant="danger">RED</Badge>
                              : <span className="text-text-muted">—</span>}
                          </TableCell>
                        </>
                      )}

                      <TableCell>{b.proofreader ?? <span className="text-text-muted">—</span>}</TableCell>

                      {isAdmin && (
                        <TableCell className="text-right whitespace-nowrap">
                          {viewMode === 'active' && b.build_id && (
                            <div className="flex items-center justify-end gap-3">
                              <Link href={`/qa-checklist/${b.build_id}`} className="text-sm text-accent hover:text-accent-bright">
                                QA
                              </Link>
                              <button
                                onClick={() => endProofread(b)}
                                disabled={advancing === b.id}
                                className="text-sm font-medium px-3 py-1 rounded border text-text-secondary border-border hover:border-text-secondary transition-colors disabled:opacity-40"
                              >
                                {advancing === b.id ? '…' : 'Done →'}
                              </button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
