'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, currentMonth, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, Check, RotateCcw, Search, X, Clock, CheckCircle2 } from 'lucide-react'

type ProductStatus = 'done' | 'in_proofread' | 'ready' | 'needs_links' | 'active'
type PayView = 'all' | 'unpaid' | 'paid'
type WeekTab = 'all' | 'direct' | number

interface PaymentItem {
  id: string
  proof_product_id: string | null
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
  paid: boolean
  paid_at: string | null
  status: ProductStatus
}

const STATUS_LABEL: Record<ProductStatus, string> = {
  done:         'Done',
  in_proofread: 'In Proofread',
  ready:        'Ready',
  needs_links:  'Needs Links',
  active:       'Active',
}

const STATUS_CLS: Record<ProductStatus, string> = {
  done:         'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  in_proofread: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  ready:        'bg-violet-500/15 text-violet-600 border-violet-500/20',
  needs_links:  'bg-amber-500/15 text-amber-600 border-amber-500/20',
  active:       'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
}

export default function ProofreaderPaymentsPage() {
  const { role } = useRole()
  const [items, setItems]           = useState<PaymentItem[]>([])
  const [month, setMonth]           = useState(currentMonth())
  const [payView, setPayView]       = useState<PayView>('all')
  const [weekTab, setWeekTab]       = useState<WeekTab>('all')
  const [directWeek, setDirectWeek] = useState<number | 'all'>('all')
  const [langTab, setLangTab]       = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const canPay = role === 'admin' || role === 'management'

  const load = useCallback(() => {
    api.get<PaymentItem[]>(`/api/builds/payment-overview?month=${month}`)
      .then(setItems).catch(console.error)
  }, [month])

  useRealtimeRefresh('proof_products', load)
  useRealtimeRefresh('builds', load)

  useEffect(() => { load() }, [load])
  useEffect(() => { setWeekTab('all'); setDirectWeek('all'); setLangTab('all'); setSearch('') }, [month, payView])
  useEffect(() => { setDirectWeek('all') }, [weekTab])

  async function togglePaid(item: PaymentItem) {
    if (!canPay) return
    const key = item.proof_product_id ?? item.id
    setTogglingKey(key)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post('/api/builds/mark-paid', {
        id:           item.proof_product_id,
        product_name: item.product_name,
        language:     item.language,
        proofreader:  item.proofreader,
        paid:         !item.paid,
        paid_at:      !item.paid ? today : null,
      })
      load()
    } finally {
      setTogglingKey(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const viewFiltered = items.filter(i => {
    if (payView === 'unpaid') return !i.paid && i.status === 'done'
    if (payView === 'paid')   return  i.paid
    return true
  })

  const weekNumbers = Array.from(new Set(
    viewFiltered.filter(i => i.source === 'build' && i.week_number != null).map(i => i.week_number!)
  )).sort((a, b) => a - b)

  const hasDirectItems = viewFiltered.some(i => i.source === 'proof_product')

  const directItems    = viewFiltered.filter(i => i.source === 'proof_product')
  const directWeekNums = Array.from(new Set(directItems.map(i => i.week_number).filter((n): n is number => n != null))).sort((a, b) => a - b)

  const weekFiltered: PaymentItem[] =
    weekTab === 'all'    ? viewFiltered :
    weekTab === 'direct' ? (directWeek === 'all' ? directItems : directItems.filter(i => i.week_number === directWeek)) :
    viewFiltered.filter(i => i.week_number === (weekTab as number))

  const uniqueLangs = Array.from(new Set(weekFiltered.map(i => i.language).filter(Boolean))).sort() as string[]
  const langFiltered = langTab === 'all' ? weekFiltered : weekFiltered.filter(i => i.language === langTab)

  const q = search.trim().toLowerCase()
  const visible = q
    ? langFiltered.filter(i =>
        i.product_name.toLowerCase().includes(q) ||
        (i.proofreader ?? '').toLowerCase().includes(q) ||
        (i.language ?? '').toLowerCase().includes(q)
      )
    : langFiltered

  // ── Tab counts ────────────────────────────────────────────────────────────
  const allCount    = items.length
  const unpaidCount = items.filter(i => !i.paid && i.status === 'done').length
  const paidCount   = items.filter(i => i.paid).length

  const weekTabItems = [
    { id: 'all' as WeekTab,    label: 'All',    count: viewFiltered.length },
    ...weekNumbers.map(w => ({ id: w as WeekTab, label: `Week ${w}`, count: viewFiltered.filter(i => i.week_number === w).length })),
    ...(hasDirectItems ? [{ id: 'direct' as WeekTab, label: 'Direct', count: directItems.length }] : []),
  ]

  const langPills = [
    { id: 'all', label: 'All', count: weekFiltered.length },
    ...uniqueLangs.map(l => ({ id: l, label: l, count: weekFiltered.filter(i => i.language === l).length })),
  ]

  // ── Row grouping (same as proofread queue) ────────────────────────────────
  type RowGroup = { key: string; label: string; items: PaymentItem[] }

  const rowGroups: RowGroup[] = (() => {
    if (weekTab !== 'all') return [{ key: 'flat', label: '', items: visible }]
    const groups: RowGroup[] = []
    for (const item of visible) {
      let key: string, label: string
      if (item.source === 'proof_product') {
        key   = `direct-${item.language ?? 'unknown'}`
        label = `Added directly — ${item.language ?? '—'}`
      } else {
        key   = item.week_number != null ? `w${item.week_number}` : 'no-week'
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
  })()

  const showGroupHeaders = false
  const colSpan = canPay ? 8 : 7

  const emptyMsg = search
    ? `No results for "${search}"`
    : payView === 'unpaid'
      ? 'No unpaid done products — all caught up!'
      : 'No products found.'

  function SourceBadge({ item }: { item: PaymentItem }) {
    return item.source === 'proof_product'
      ? <Badge variant="muted">Direct</Badge>
      : <Badge variant="default">Tracker</Badge>
  }

  function StatusBadge({ status }: { status: ProductStatus }) {
    return (
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium border whitespace-nowrap', STATUS_CLS[status])}>
        {STATUS_LABEL[status]}
      </span>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <PageHeader
          title="Proofreader Payments"
          description="Track payment status for all proofread products"
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

        {/* Pay view toggle */}
        <div className="flex gap-2 mb-5">
          {([
            { id: 'all',    label: 'All',    icon: null,         count: allCount    },
            { id: 'unpaid', label: 'Unpaid', icon: Clock,        count: unpaidCount },
            { id: 'paid',   label: 'Paid',   icon: CheckCircle2, count: paidCount   },
          ] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setPayView(v.id)}
              className={cn(
                'flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                payView === v.id
                  ? v.id === 'paid'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : v.id === 'unpaid'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                      : 'bg-accent-muted text-accent-bright border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
              )}
            >
              {v.icon && <v.icon className="h-4 w-4 shrink-0" />}
              <span>{v.label}</span>
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                payView === v.id
                  ? v.id === 'paid'   ? 'text-green-400 bg-green-500/10'
                  : v.id === 'unpaid' ? 'text-amber-500 bg-amber-500/10'
                  :                     'text-accent bg-accent-muted'
                  : 'text-text-muted bg-surface',
              )}>
                {v.count}
              </span>
            </button>
          ))}
        </div>

        {/* Week tabs */}
        {weekTabItems.length > 1 && (
          <Tabs tabs={weekTabItems} active={weekTab} onChange={v => setWeekTab(v as WeekTab)} />
        )}

        {/* Direct week sub-filter */}
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

        {/* Lang pills + search */}
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
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>{/* end shrink-0 */}

      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Mobile: cards ── */}
        <div className="md:hidden space-y-3 pb-6">
          {visible.length === 0 ? (
            <p className="text-center text-text-muted py-12 text-sm">{emptyMsg}</p>
          ) : rowGroups.map(group => (
            <div key={group.key}>
              {showGroupHeaders && group.items.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-5 pb-2 first:pt-1">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">{group.label}</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-xs font-mono text-text-muted">{group.items.length}</span>
                </div>
              )}
              <div className="space-y-3">
                {group.items.map(item => {
                  const itemKey = item.proof_product_id ?? item.id
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl border bg-surface-elevated p-4',
                        item.paid ? 'border-border-subtle opacity-70' : 'border-border-subtle',
                      )}
                    >
                      {/* Name */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className={cn('text-[15px] font-medium text-foreground leading-snug flex-1', item.paid && 'line-through')}>
                          {item.product_name}
                        </p>
                        {item.paid && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 shrink-0">
                            <Check className="h-3.5 w-3.5" /> Paid
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-4">
                        <SourceBadge item={item} />
                        {item.language && (
                          <span className="text-xs font-mono bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary">
                            {item.language}
                          </span>
                        )}
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Date grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-3">
                        <div>
                          <p className="text-xs text-text-muted mb-0.5">Into Proofread</p>
                          <p className="font-mono text-text-secondary text-sm">
                            {item.into_proofread ? formatDate(item.into_proofread) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-0.5">{item.paid ? 'Paid date' : 'Proof end'}</p>
                          <p className="font-mono text-text-secondary text-sm">
                            {item.paid && item.paid_at
                              ? formatDate(item.paid_at)
                              : item.proof_end ? formatDate(item.proof_end) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Proofreader + action */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border-subtle">
                        <span className="text-sm text-text-muted truncate">{item.proofreader ?? '—'}</span>
                        {item.paid ? (
                          canPay && (
                            <button
                              onClick={() => togglePaid(item)}
                              disabled={togglingKey === itemKey}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-40"
                              title="Undo payment"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Undo
                            </button>
                          )
                        ) : canPay && item.status === 'done' ? (
                          <Button
                            size="sm"
                            disabled={togglingKey === itemKey}
                            onClick={() => togglePaid(item)}
                            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                          >
                            <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:block pb-6">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Product</TableHeader>
                <TableHeader>Source</TableHeader>
                <TableHeader>Lang</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Into Proofread</TableHeader>
                <TableHeader>Proof end</TableHeader>
                <TableHeader>Proofreader</TableHeader>
                {canPay && <TableHeader />}
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
                  {group.items.map(item => {
                    const itemKey = item.proof_product_id ?? item.id
                    return (
                      <TableRow
                        key={item.id}
                        className={item.paid ? 'opacity-60' : undefined}
                      >
                        <TableCell className={cn('font-medium text-foreground', item.paid && 'line-through')}>
                          {item.product_name}
                        </TableCell>
                        <TableCell><SourceBadge item={item} /></TableCell>
                        <TableCell mono>{item.language ?? '—'}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        <TableCell mono className="whitespace-nowrap">
                          {item.into_proofread
                            ? formatDate(item.into_proofread)
                            : <span className="text-text-muted">—</span>}
                        </TableCell>
                        <TableCell mono className="whitespace-nowrap">
                          {item.proof_end
                            ? formatDate(item.proof_end)
                            : <span className="text-text-muted">—</span>}
                        </TableCell>
                        <TableCell>
                          {item.proofreader ?? <span className="text-text-muted">—</span>}
                        </TableCell>
                        {canPay && (
                          <TableCell className="text-right whitespace-nowrap">
                            {item.paid ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="flex items-center gap-1 text-xs text-emerald-600">
                                  <Check className="h-3.5 w-3.5" />
                                  {item.paid_at ? formatDate(item.paid_at) : 'Paid'}
                                </span>
                                <button
                                  onClick={() => togglePaid(item)}
                                  disabled={togglingKey === itemKey}
                                  className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-text-secondary hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-40"
                                  title="Undo payment"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Undo
                                </button>
                              </div>
                            ) : item.status === 'done' ? (
                              <Button
                                size="sm"
                                disabled={togglingKey === itemKey}
                                onClick={() => togglePaid(item)}
                                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
                              </Button>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
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

      </div>{/* end flex-1 */}
    </div>
  )
}
