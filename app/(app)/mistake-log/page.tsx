'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, currentMonth } from '@/lib/utils'
import type { Mistake } from '@/lib/types'
import { createClient } from '@/lib/supabase'

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Mistake Log</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-xs divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Date</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Product</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Category</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Caught where</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Description</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">SOP?</th>
                {isAdmin && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {mistakes.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDate(m.date)}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{m.product_name ?? '—'}</td>
                  <td className="px-3 py-2 max-w-xs truncate text-gray-600">{m.category ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{m.caught_where ?? '—'}</td>
                  <td className="px-3 py-2 max-w-sm text-gray-500 truncate">{m.description ?? '—'}</td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <input type="checkbox" checked={m.sop_updated} onChange={() => handleToggleSOP(m)} className="cursor-pointer" />
                    ) : (
                      m.sop_updated ? '✓' : '—'
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 hover:underline">Del</button>
                    </td>
                  )}
                </tr>
              ))}
              {mistakes.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No mistakes logged this month</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">This month — pattern watch</p>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-medium pb-1">Category</th>
                <th className="text-right text-gray-500 font-medium pb-1">Count</th>
                <th className="text-right text-gray-500 font-medium pb-1">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CATEGORIES.map(cat => {
                const count = counts[cat] ?? 0
                const flagged = count >= SOP_THRESHOLD
                return (
                  <tr key={cat} className={flagged ? 'bg-red-50' : ''}>
                    <td className="py-1.5 pr-2 text-gray-600 leading-tight">{cat}</td>
                    <td className="py-1.5 text-right font-medium">{count}</td>
                    <td className="py-1.5 text-right">
                      {flagged
                        ? <span className="text-red-600 font-medium">FLAG</span>
                        : <span className="text-gray-300">OK</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div>
          {!adding ? (
            <button onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline">+ Log a mistake</button>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">New mistake</p>
              <div className="flex flex-wrap gap-3">
                <div><label className="block text-xs text-gray-500 mb-0.5">Date</label>
                  <input type="date" className="border rounded px-2 py-1 text-sm" value={newM.date ?? ''} onChange={e => setNewM(d => ({ ...d, date: e.target.value }))} /></div>
                <div className="flex-1 min-w-48"><label className="block text-xs text-gray-500 mb-0.5">Product</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={newM.product_name ?? ''} onChange={e => setNewM(d => ({ ...d, product_name: e.target.value }))} /></div>
                <div className="flex-1 min-w-48"><label className="block text-xs text-gray-500 mb-0.5">Category</label>
                  <select className="w-full border rounded px-2 py-1 text-sm" value={newM.category ?? ''} onChange={e => setNewM(d => ({ ...d, category: e.target.value }))}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-xs text-gray-500 mb-0.5">Caught where</label>
                  <select className="border rounded px-2 py-1 text-sm" value={newM.caught_where ?? ''} onChange={e => setNewM(d => ({ ...d, caught_where: e.target.value }))}>
                    <option value="">Select…</option>
                    {CAUGHT_WHERE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-0.5">Description</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={newM.description ?? ''} onChange={e => setNewM(d => ({ ...d, description: e.target.value }))} /></div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">Add</button>
                <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
