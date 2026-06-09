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
import { DollarSign, Check, RotateCcw, User } from 'lucide-react'

interface PaymentItem {
  id: string | null
  language: string | null
  proofreader: string | null
  product_name: string
  proof_end: string | null
  paid: boolean
  paid_at: string | null
}

type PayFilter = 'unpaid' | 'paid' | 'all'

function groupByProofreader(products: PaymentItem[]) {
  const map = new Map<string, PaymentItem[]>()
  for (const p of products) {
    const key = p.proofreader || '(unassigned)'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  // Sort: groups with unpaid first, then alphabetical
  return Array.from(map.entries()).sort(([aKey, aItems], [bKey, bItems]) => {
    const aUnpaid = aItems.filter(i => !i.paid).length
    const bUnpaid = bItems.filter(i => !i.paid).length
    if (bUnpaid !== aUnpaid) return bUnpaid - aUnpaid
    return aKey.localeCompare(bKey)
  })
}

export default function ProofreaderPaymentsPage() {
  const { role } = useRole()
  const [products, setProducts]     = useState<PaymentItem[]>([])
  const [payFilter, setPayFilter]   = useState<PayFilter>('unpaid')
  const [langTab, setLangTab]       = useState<string>('all')
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const canPay = role === 'admin' || role === 'management'

  const load = useCallback(() => {
    api.get<PaymentItem[]>('/api/builds/payment-overview')
      .then(setProducts)
      .catch(console.error)
  }, [])

  useRealtimeRefresh('proof_products', load)
  useRealtimeRefresh('builds', load)

  useEffect(() => { load() }, [load])

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

  // Derive language list
  const langs = Array.from(new Set(products.map(p => p.language).filter(Boolean) as string[])).sort()

  const filtered = products
    .filter(p => langTab === 'all' || p.language === langTab)
    .filter(p => {
      if (payFilter === 'unpaid') return !p.paid
      if (payFilter === 'paid')   return  p.paid
      return true
    })

  const groups = groupByProofreader(filtered)

  const totalUnpaid = products.filter(p => !p.paid && (langTab === 'all' || p.language === langTab)).length
  const totalPaid   = products.filter(p =>  p.paid && (langTab === 'all' || p.language === langTab)).length

  const payTabs = [
    { id: 'unpaid', label: 'Unpaid', count: totalUnpaid > 0 ? totalUnpaid : undefined },
    { id: 'paid',   label: 'Paid',   count: totalPaid   > 0 ? totalPaid   : undefined },
    { id: 'all',    label: 'All'                                                       },
  ]

  const langTabs = [
    { id: 'all', label: 'All' },
    ...langs.map(l => ({ id: l, label: l })),
  ]

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Proofreader Payments"
        description="Track which products have been paid to proofreaders"
      />

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={payTabs}
          active={payFilter}
          onChange={v => setPayFilter(v as PayFilter)}
        />
        {langs.length > 1 && (
          <Tabs
            tabs={langTabs}
            active={langTab}
            onChange={v => setLangTab(String(v))}
          />
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-elevated p-10 text-center text-text-muted">
          {payFilter === 'unpaid' ? 'No unpaid products — all caught up!' : 'No products found.'}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([proofreader, items]) => {
            const unpaid = items.filter(i => !i.paid).length
            const paid   = items.filter(i =>  i.paid).length
            return (
              <div key={proofreader} className="rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-surface">
                  <User className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="font-semibold text-sm text-foreground">{proofreader}</span>
                  {unpaid > 0 && (
                    <Badge className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/20">
                      {unpaid} unpaid
                    </Badge>
                  )}
                  {paid > 0 && (
                    <Badge className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                      {paid} paid
                    </Badge>
                  )}
                </div>

                {/* Product rows */}
                <div className="divide-y divide-border-subtle">
                  {items.map(product => {
                    const itemKey = product.id ?? `${product.product_name}|${product.language}`
                    return (
                    <div
                      key={itemKey}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 text-sm',
                        product.paid ? 'opacity-60' : ''
                      )}
                    >
                      {/* Language pill */}
                      {product.language && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-accent/10 text-accent">
                          {product.language}
                        </span>
                      )}

                      {/* Product name */}
                      <span className={cn('flex-1 min-w-0 truncate', product.paid && 'line-through')}>
                        {product.product_name}
                      </span>

                      {/* Paid date */}
                      {product.paid && product.paid_at && (
                        <span className="shrink-0 text-xs text-text-muted">
                          {formatDate(product.paid_at)}
                        </span>
                      )}

                      {/* Status / action */}
                      {product.paid ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                            Paid
                          </span>
                          {canPay && (
                            <button
                              onClick={() => togglePaid(product)}
                              disabled={togglingKey === itemKey}
                              className="text-xs text-text-muted hover:text-foreground transition-colors flex items-center gap-1"
                              title="Undo payment"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : canPay ? (
                        <Button
                          size="sm"
                          disabled={togglingKey === itemKey}
                          onClick={() => togglePaid(product)}
                          className="shrink-0 h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs text-amber-600 shrink-0">Unpaid</span>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
