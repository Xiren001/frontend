'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, currentMonth } from '@/lib/utils'
import type { Mistake } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const CATEGORIES = [
  'Translation / proofreading',
  'Pricing / currency / tax (per market)',
  'Payment method missing or broken (Shopify checkout)',
  'Funnelish → Shopify checkout redirect (wrong/empty cart · lost variant)',
  'Variant / SKU / inventory mapping (size · metal · length)',
  'Product imagery / sizing chart',
  'Shopify page issue (jewelry)',
  'Funnelish page issue (advertorial / sales)',
  'Speed / performance',
  'Page / funnel break (CTA → checkout)',
  'Product',
]

const CAUGHT_WHERE = ['Phase 1 (Build QA)', 'Phase 2 (Proofread)', 'Phase 3 (Testing)', 'Phase 4 (Expanding)', 'Live']

const SOP_THRESHOLD = 3

export default function MistakeLogPage() {
  const [month, setMonth] = useState(currentMonth())
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newM, setNewM] = useState<Partial<Mistake>>({ date: new Date().toISOString().slice(0,10) })

  async function loadMistakes() {
    const data = await api.get<{ mistakes: Mistake[]; categoryCounts: Record<string, number> }>(`/api/mistakes?month=${month}`)
    setMistakes(data.mistakes)
    setCounts(data.categoryCounts)
  }

  useEffect(() => {
    loadMistakes()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [month])

  async function handleAdd() {
    await api.post('/api/mistakes', newM)
    setAdding(false)
    setNewM({ date: new Date().toISOString().slice(0,10) })
    loadMistakes()
  }

  async function handleToggleSOP(m: Mistake) {
    await api.put(`/api/mistakes/${m.id}`, { ...m, sop_updated: !m.sop_updated })
    loadMistakes()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this mistake entry?')) return
    await api.delete(`/api/mistakes/${id}`)
    loadMistakes()
  }

  return (
    <div>
      <PageHeader
        title="Mistake Log"
        description="Track errors by category. Pattern watch flags categories with 3+ occurrences."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Date</TableHeader>
                <TableHeader>Product</TableHeader>
                <TableHeader>Category</TableHeader>
                <TableHeader>Caught where</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>SOP?</TableHeader>
                {isAdmin && <TableHeader />}
              </TableRow>
            </TableHead>
            <TableBody>
              {mistakes.map(m => (
                <TableRow key={m.id}>
                  <TableCell mono className="whitespace-nowrap">{formatDate(m.date)}</TableCell>
                  <TableCell className="max-w-xs truncate text-foreground">{m.product_name ?? '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">{m.category ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{m.caught_where ?? '—'}</TableCell>
                  <TableCell className="max-w-sm truncate">{m.description ?? '—'}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <input type="checkbox" checked={m.sop_updated} onChange={() => handleToggleSOP(m)} className="cursor-pointer" />
                    ) : (
                      m.sop_updated ? <Badge variant="accent">✓</Badge> : <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {mistakes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-muted py-8">
                    No mistakes logged this month
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Pattern watch</p>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left text-text-muted font-medium px-4 py-2">Category</th>
                  <th className="text-right text-text-muted font-medium px-4 py-2">Count</th>
                  <th className="text-right text-text-muted font-medium px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {CATEGORIES.map(cat => {
                  const count = counts[cat] ?? 0
                  const flagged = count >= SOP_THRESHOLD
                  return (
                    <tr key={cat} className={flagged ? 'bg-danger-muted/30' : ''}>
                      <td className="py-2 px-4 text-text-secondary leading-tight">{cat}</td>
                      <td className="py-2 px-4 text-right font-mono font-medium text-foreground">{count}</td>
                      <td className="py-2 px-4 text-right">
                        {flagged
                          ? <Badge variant="danger">FLAG</Badge>
                          : <Badge variant="muted">OK</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {isAdmin && (
        <div>
          {!adding ? (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>+ Log a mistake</Button>
          ) : (
            <Card>
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">New mistake</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Date</label>
                    <Input type="date" value={newM.date ?? ''} onChange={e => setNewM(d => ({ ...d, date: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs text-text-muted mb-1">Product</label>
                    <Input value={newM.product_name ?? ''} onChange={e => setNewM(d => ({ ...d, product_name: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs text-text-muted mb-1">Category</label>
                    <select className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40" value={newM.category ?? ''} onChange={e => setNewM(d => ({ ...d, category: e.target.value }))}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Caught where</label>
                    <select className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40" value={newM.caught_where ?? ''} onChange={e => setNewM(d => ({ ...d, caught_where: e.target.value }))}>
                      <option value="">Select…</option>
                      {CAUGHT_WHERE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Description</label>
                  <Input value={newM.description ?? ''} onChange={e => setNewM(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
