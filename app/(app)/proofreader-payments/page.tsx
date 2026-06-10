'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, Check, RotateCcw, User, Search, X, Clock, CheckCircle2 } from 'lucide-react'

type ProductStatus = 'done' | 'in_proofread' | 'ready' | 'needs_links' | 'active'

interface PaymentItem {
  id: string | null
  language: string | null
  proofreader: string | null
  product_name: string
  proof_end: string | null
  paid: boolean
  paid_at: string | null
  status: ProductStatus
}

type PayFilter = 'unpaid' | 'paid' | 'all'
type StatusFilter = 'all' | ProductStatus

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

const STATUS_ORDER: ProductStatus[] = ['done', 'ready', 'in_proofread', 'needs_links', 'active']

function groupByProofreader(products: PaymentItem[]) {
  const map = new Map<string, PaymentItem[]>()
  for (const p of products) {
    const key = p.proofreader || '(unassigned)'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return Array.from(map.entries()).sort(([aKey, aItems], [bKey, bItems]) => {
    const aUnpaid = aItems.filter(i => !i.paid && i.status === 'done').length
    const bUnpaid = bItems.filter(i => !i.paid && i.status === 'done').length
    if (bUnpaid !== aUnpaid) return bUnpaid - aUnpaid
    return aKey.localeCompare(bKey)
  })
}

export default function ProofreaderPaymentsPage() {
  const { role } = useRole()
  const [products, setProducts]         = useState<PaymentItem[]>([])
  const [payFilter, setPayFilter]       = useState<PayFilter>('unpaid')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [langTab, setLangTab]           = useState<string>('all')
  const [search, setSearch]             = useState('')
  const [togglingKey, setTogglingKey]   = useState<string | null>(null)

  const canPay = role === 'admin' || role === 'management'

  const load = useCallback(() => {
    api.get<PaymentItem[]>('/api/builds/payment-overview')
      .then(setProducts)
      .catch(console.error)
  }, [])

  useRealtimeRefresh('proof_products', load)
  useRealtimeRefresh('builds', load)

  useEffect(() => { load() }, [load])
  useEffect(() => { setStatusFilter('all'); setSearch('') }, [payFilter, langTab])

  async function togglePaid(product: PaymentItem) {
    if (!canPay) return
    const key = product.id ?? `${product.product_name}|${product.language}`
    setTogglingKey(key)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post('/api/builds/mark-paid', {
        id:           product.id,
        product_name: product.product_name,
        language:     product.language,
        proofreader:  product.proofreader,
        paid:         !product.paid,
        paid_at:      !product.paid ? today : null,
      })
      load()
    } finally {
      setTogglingKey(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const langs = Array.from(new Set(products.map(p => p.language).filter(Boolean) as string[])).sort()

  const payFiltered = products.filter(p => {
    if (payFilter === 'unpaid') return !p.paid
    if (payFilter === 'paid')   return  p.paid
    return true
  })

  const langFiltered = payFiltered.filter(p => langTab === 'all' || p.language === langTab)

  const statusFiltered = statusFilter === 'all'
    ? langFiltered
    : langFiltered.filter(p => p.status === statusFilter)

  const q = search.trim().toLowerCase()
  const visible = q
    ? statusFiltered.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        (p.proofreader ?? '').toLowerCase().includes(q)
      )
    : statusFiltered

  const groups = groupByProofreader(visible)

  // Counts
  const totalUnpaid = products.filter(p => !p.paid).length
  const totalPaid   = products.filter(p =>  p.paid).length

  const langPills = [
    { id: 'all', label: 'All', count: payFiltered.length },
    ...langs.map(l => ({ id: l, label: l, count: payFiltered.filter(p => p.language === l).length })),
  ]

  const existingStatuses = Array.from(new Set(langFiltered.map(p => p.status))) as ProductStatus[]
  const sortedStatuses   = STATUS_ORDER.filter(s => existingStatuses.includes(s))

  const payTabs = [
    { id: 'unpaid', label: 'Unpaid',    count: totalUnpaid > 0 ? totalUnpaid : undefined },
    { id: 'paid',   label: 'Paid',      count: totalPaid   > 0 ? totalPaid   : undefined },
    { id: 'all',    label: 'All' },
  ]

  const emptyMsg = q
    ? `No results for "${search}"`
    : payFilter === 'unpaid'
      ? 'No unpaid products — all caught up!'
      : 'No products found.'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <PageHeader
          title="Proofreader Payments"
          description="Track which products have been paid to proofreaders"
        />

        {/* Pay filter (view mode toggle) */}
        <div className="flex gap-2 mb-5">
          {([
            { id: 'unpaid', label: 'Unpaid',  icon: Clock,        count: totalUnpaid },
            { id: 'paid',   label: 'Paid',    icon: CheckCircle2, count: totalPaid   },
            { id: 'all',    label: 'All',     icon: null,         count: products.length },
          ] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setPayFilter(v.id)}
              className={cn(
                'flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                payFilter === v.id
                  ? v.id === 'paid'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-accent-muted text-accent-bright border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
              )}
            >
              {v.icon && <v.icon className="h-4 w-4 shrink-0" />}
              <span>{v.label}</span>
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                payFilter === v.id
                  ? v.id === 'paid' ? 'text-green-400 bg-green-500/10' : 'text-accent bg-accent-muted'
                  : 'text-text-muted bg-surface',
              )}>
                {v.count}
              </span>
            </button>
          ))}
        </div>

        {/* Status pills (week-tab equivalent) */}
        {sortedStatuses.length > 1 && (
          <Tabs
            tabs={[
              { id: 'all', label: 'All statuses', count: langFiltered.length },
              ...sortedStatuses.map(s => ({ id: s, label: STATUS_LABEL[s], count: langFiltered.filter(p => p.status === s).length })),
            ]}
            active={statusFilter}
            onChange={v => setStatusFilter(v as StatusFilter)}
          />
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
        <div className="md:hidden space-y-6 pb-6">
          {groups.length === 0 ? (
            <p className="text-center text-text-muted py-12 text-sm">{emptyMsg}</p>
          ) : groups.map(([proofreader, items]) => {
            const unpaid  = items.filter(i => !i.paid && i.status === 'done').length
            const paid    = items.filter(i =>  i.paid).length
            const pending = items.filter(i => !i.paid && i.status !== 'done').length
            return (
              <div key={proofreader} className="rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-surface flex-wrap">
                  <User className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="font-semibold text-sm text-foreground">{proofreader}</span>
                  {unpaid > 0 && <Badge className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/20">{unpaid} unpaid</Badge>}
                  {paid > 0   && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/20">{paid} paid</Badge>}
                  {pending > 0 && <Badge className="text-xs bg-zinc-500/15 text-zinc-500 border-zinc-500/20">{pending} in progress</Badge>}
                </div>
                <div className="divide-y divide-border-subtle">
                  {items.map(product => {
                    const itemKey = product.id ?? `${product.product_name}|${product.language}`
                    return (
                      <div key={itemKey} className={cn('p-4 space-y-3', product.paid && 'opacity-60')}>
                        {/* Name */}
                        <p className={cn('text-[15px] font-medium text-foreground leading-snug', product.paid && 'line-through')}>
                          {product.product_name}
                        </p>
                        {/* Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {product.language && (
                            <span className="text-xs font-mono bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary">
                              {product.language}
                            </span>
                          )}
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium border', STATUS_CLS[product.status])}>
                            {STATUS_LABEL[product.status]}
                          </span>
                          {product.paid && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Paid</Badge>}
                        </div>
                        {/* Date + action row */}
                        <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                          <span className="text-xs text-text-muted font-mono">
                            {product.paid && product.paid_at ? formatDate(product.paid_at) : product.proof_end ? formatDate(product.proof_end) : '—'}
                          </span>
                          {product.paid ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <Check className="h-3.5 w-3.5" /> Paid
                              </span>
                              {canPay && (
                                <button onClick={() => togglePaid(product)} disabled={togglingKey === itemKey}
                                  className="text-xs text-text-muted hover:text-foreground transition-colors" title="Undo">
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : canPay && product.status === 'done' ? (
                            <Button size="sm" disabled={togglingKey === itemKey} onClick={() => togglePaid(product)}
                              className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                              <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
                            </Button>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:block pb-6">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Product</TableHeader>
                <TableHeader>Lang</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Proof end</TableHeader>
                <TableHeader>Proofreader</TableHeader>
                <TableHeader>Paid date</TableHeader>
                {canPay && <TableHeader />}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canPay ? 7 : 6} className="text-center text-text-muted py-12">
                    {emptyMsg}
                  </TableCell>
                </TableRow>
              )}
              {groups.map(([proofreader, items]) => {
                const unpaid  = items.filter(i => !i.paid && i.status === 'done').length
                const paid    = items.filter(i =>  i.paid).length
                const pending = items.filter(i => !i.paid && i.status !== 'done').length
                return (
                  <>
                    {/* Proofreader group header */}
                    <TableRow key={proofreader + '-hdr'} className="bg-surface-elevated/60 border-t-2 border-border-subtle">
                      <TableCell colSpan={canPay ? 7 : 6} className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <User className="h-3.5 w-3.5 text-text-muted" />
                          <span className="text-sm font-semibold text-foreground">{proofreader}</span>
                          {unpaid > 0  && <Badge className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/20">{unpaid} unpaid</Badge>}
                          {paid > 0    && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/20">{paid} paid</Badge>}
                          {pending > 0 && <Badge className="text-xs bg-zinc-500/15 text-zinc-500 border-zinc-500/20">{pending} in progress</Badge>}
                          <span className="ml-auto text-xs font-mono text-text-muted">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {items.map(product => {
                      const itemKey = product.id ?? `${product.product_name}|${product.language}`
                      return (
                        <TableRow key={itemKey} className={product.paid ? 'opacity-60' : undefined}>
                          <TableCell className={cn('font-medium text-foreground', product.paid && 'line-through')}>
                            {product.product_name}
                          </TableCell>
                          <TableCell mono>{product.language ?? '—'}</TableCell>
                          <TableCell>
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium border', STATUS_CLS[product.status])}>
                              {STATUS_LABEL[product.status]}
                            </span>
                          </TableCell>
                          <TableCell mono className="whitespace-nowrap">
                            {product.proof_end ? formatDate(product.proof_end) : <span className="text-text-muted">—</span>}
                          </TableCell>
                          <TableCell>{product.proofreader ?? <span className="text-text-muted">—</span>}</TableCell>
                          <TableCell mono className="whitespace-nowrap">
                            {product.paid && product.paid_at
                              ? <span className="text-emerald-600">{formatDate(product.paid_at)}</span>
                              : <span className="text-text-muted">—</span>}
                          </TableCell>
                          {canPay && (
                            <TableCell className="text-right whitespace-nowrap">
                              {product.paid ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                                    <Check className="h-3.5 w-3.5" /> Paid
                                  </span>
                                  <button onClick={() => togglePaid(product)} disabled={togglingKey === itemKey}
                                    className="text-text-muted hover:text-foreground transition-colors" title="Undo payment">
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : product.status === 'done' ? (
                                <Button size="sm" disabled={togglingKey === itemKey} onClick={() => togglePaid(product)}
                                  className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
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
                )
              })}
            </TableBody>
          </Table>
        </div>

      </div>{/* end flex-1 */}
    </div>
  )
}
