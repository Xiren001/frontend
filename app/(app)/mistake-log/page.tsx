'use client'
import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { api } from '@/lib/api'
import { formatDate, currentMonth, cn } from '@/lib/utils'
import type { Mistake } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'
import { MistakeFormModal, CATEGORIES, ConfirmModal } from '@/components/MistakeFormModal'
import { MistakeBulkModal } from '@/components/MistakeBulkModal'
import { Plus, X, Layers, Search } from 'lucide-react'

const SOP_THRESHOLD = 3

export default function MistakeLogPage() {
  const [month, setMonth] = useState(currentMonth())
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isAdmin, setIsAdmin] = useState(false)

  // forms
  const [formOpen, setFormOpen]   = useState(false)
  const [formMode, setFormMode]   = useState<'create' | 'edit'>('create')
  const [editMistake, setEditMistake] = useState<Mistake | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [bulkOpen, setBulkOpen]   = useState(false)

  // search + filter
  const [searchQuery, setSearchQuery]     = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // custom patterns
  const [customPatterns, setCustomPatterns] = useState<string[]>([])
  const [addingPattern, setAddingPattern]   = useState(false)
  const [patternInput, setPatternInput]     = useState('')
  const patternRef = useRef<HTMLInputElement>(null)

  async function loadMistakes() {
    const data = await api.get<{ mistakes: Mistake[]; categoryCounts: Record<string, number> }>(`/api/mistakes?month=${month}`)
    setMistakes(data.mistakes)
    setCounts(data.categoryCounts)
  }

  useRealtimeRefresh('mistakes', loadMistakes)

  useEffect(() => {
    loadMistakes()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [month])

  // load custom patterns from localStorage after mount
  useEffect(() => {
    try {
      setCustomPatterns(JSON.parse(localStorage.getItem('mistake-patterns') ?? '[]'))
    } catch { /* ignore */ }
  }, [])

  function savePatterns(list: string[]) {
    setCustomPatterns(list)
    localStorage.setItem('mistake-patterns', JSON.stringify(list))
  }

  function confirmPattern() {
    const name = patternInput.trim()
    if (!name || customPatterns.includes(name) || CATEGORIES.includes(name)) return
    savePatterns([...customPatterns, name])
    setPatternInput('')
    setAddingPattern(false)
  }

  function removePattern(name: string) {
    savePatterns(customPatterns.filter(p => p !== name))
  }

  function onPatternKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmPattern() }
    if (e.key === 'Escape') { setAddingPattern(false); setPatternInput('') }
  }

  function openCreate() { setFormMode('create'); setEditMistake(null); setFormOpen(true) }
  function openEdit(m: Mistake) { setFormMode('edit'); setEditMistake(m); setFormOpen(true) }

  async function handleSave(data: Partial<Mistake>) {
    setSaving(true)
    try {
      if (formMode === 'create') await api.post('/api/mistakes', data)
      else if (editMistake) await api.put(`/api/mistakes/${editMistake.id}`, { ...editMistake, ...data })
      setFormOpen(false)
      loadMistakes()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/mistakes/${deleteId}`)
      setDeleteId(null)
      loadMistakes()
    } finally { setDeleting(false) }
  }

  const allPatterns = [...CATEGORIES, ...customPatterns]

  const mq = searchQuery.trim().toLowerCase()
  const filtered = mistakes.filter(m => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    if (!mq) return true
    return (
      (m.product_name ?? '').toLowerCase().includes(mq) ||
      (m.category ?? '').toLowerCase().includes(mq) ||
      (m.description ?? '').toLowerCase().includes(mq) ||
      (m.caught_where ?? '').toLowerCase().includes(mq)
    )
  })

  const columns: ResponsiveColumn<Mistake>[] = [
    { key: 'date',     header: 'Date',        mono: true,  render: m => formatDate(m.date) },
    { key: 'product',  header: 'Product',                   render: m => <span className="text-foreground">{m.product_name ?? '—'}</span> },
    { key: 'category', header: 'Category',                  render: m => m.category ?? '—' },
    { key: 'caught',   header: 'Caught where',              render: m => m.caught_where ?? '—' },
    { key: 'desc',     header: 'Description',               render: m => m.description ?? '—' },
    { key: 'sop',      header: 'SOP?',                      render: m => m.sop_updated ? <Badge variant="accent">✓</Badge> : <span className="text-text-muted">—</span> },
    ...(isAdmin ? [{
      key: 'actions', header: '', hideOnMobile: true, align: 'right' as const,
      render: (m: Mistake) => (
        <>
          <button onClick={() => openEdit(m)} className="text-xs text-text-secondary hover:text-foreground mr-3">Edit</button>
          <button onClick={() => setDeleteId(m.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
        </>
      ),
    }] : []),
  ]

  return (
    <div>
      <PageHeader
        title="Mistake Log"
        description="Track errors by category. Pattern watch flags categories with 3+ occurrences."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setBulkOpen(true)}>
                  <Layers className="h-3.5 w-3.5 mr-1.5" />Bulk log
                </Button>
                <Button variant="secondary" size="sm" onClick={openCreate}>+ Log mistake</Button>
              </>
            )}
          </div>
        }
      />

      {/* Search + category filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search product, category, description…"
            className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(searchQuery || categoryFilter !== 'all') && (
          <span className="text-xs text-text-muted">
            {filtered.length} of {mistakes.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ── Mistake table ── */}
        <div className="lg:col-span-2">
          <ResponsiveTable
            columns={columns}
            data={filtered}
            rowKey={m => m.id}
            emptyMessage={searchQuery || categoryFilter !== 'all' ? 'No matching mistakes.' : 'No mistakes logged this month'}
            mobileTitle={m => m.product_name ?? 'Unknown product'}
            mobileSubtitle={m => formatDate(m.date)}
            mobileActions={isAdmin ? m => (
              <div className="flex gap-2">
                <button onClick={() => openEdit(m)} className="text-xs text-text-secondary hover:text-foreground">Edit</button>
                <button onClick={() => setDeleteId(m.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
              </div>
            ) : undefined}
          />
        </div>

        {/* ── Pattern watch ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Pattern watch</p>
              {isAdmin && (
                <button
                  onClick={() => { setAddingPattern(true); setTimeout(() => patternRef.current?.focus(), 50) }}
                  title="Add custom pattern"
                  className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {/* Desktop table */}
            <table className="hidden md:table w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left text-text-muted font-medium px-4 py-2">Category</th>
                  <th className="text-right text-text-muted font-medium px-4 py-2">Count</th>
                  <th className="text-right text-text-muted font-medium px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {allPatterns.map(cat => {
                  const count = counts[cat] ?? 0
                  const flagged = count >= SOP_THRESHOLD
                  const isCustom = !CATEGORIES.includes(cat)
                  return (
                    <tr key={cat} className={flagged ? 'bg-danger-muted/30' : ''}>
                      <td className="py-2 px-4 text-text-secondary leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="flex-1">{cat}</span>
                          {isCustom && isAdmin && (
                            <button onClick={() => removePattern(cat)} className="text-text-muted hover:text-danger transition-colors shrink-0" title="Remove">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-medium text-foreground">{count}</td>
                      <td className="py-2 px-4 text-right">
                        {flagged ? <Badge variant="danger">FLAG</Badge> : <Badge variant="muted">OK</Badge>}
                      </td>
                    </tr>
                  )
                })}

                {/* Add pattern inline input */}
                {addingPattern && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={patternRef}
                          value={patternInput}
                          onChange={e => setPatternInput(e.target.value)}
                          onKeyDown={onPatternKey}
                          placeholder="Pattern name…"
                          className="flex-1 rounded border border-accent/40 bg-surface px-2 py-1 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
                        />
                        <button onClick={confirmPattern} className="text-accent hover:text-accent-bright text-xs font-medium">Add</button>
                        <button onClick={() => { setAddingPattern(false); setPatternInput('') }} className="text-text-muted hover:text-foreground text-xs">Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {allPatterns.map(cat => {
                const count = counts[cat] ?? 0
                const flagged = count >= SOP_THRESHOLD
                const isCustom = !CATEGORIES.includes(cat)
                return (
                  <div key={cat} className={cn('px-4 py-3 flex items-start justify-between gap-3', flagged && 'bg-danger-muted/30')}>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <p className="text-xs text-text-secondary leading-tight flex-1 truncate">{cat}</p>
                      {isCustom && isAdmin && (
                        <button onClick={() => removePattern(cat)} className="text-text-muted hover:text-danger transition-colors shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-medium text-foreground">{count}</span>
                      {flagged ? <Badge variant="danger">FLAG</Badge> : <Badge variant="muted">OK</Badge>}
                    </div>
                  </div>
                )
              })}

              {addingPattern && (
                <div className="px-4 py-2 flex items-center gap-2">
                  <input
                    value={patternInput}
                    onChange={e => setPatternInput(e.target.value)}
                    onKeyDown={onPatternKey}
                    placeholder="Pattern name…"
                    className="flex-1 rounded border border-accent/40 bg-surface px-2 py-1 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <button onClick={confirmPattern} className="text-accent text-xs font-medium">Add</button>
                  <button onClick={() => { setAddingPattern(false); setPatternInput('') }} className="text-text-muted text-xs">✕</button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Modals */}
      <MistakeBulkModal
        open={bulkOpen}
        month={month}
        onClose={() => setBulkOpen(false)}
        onSaved={loadMistakes}
      />

      <MistakeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        mode={formMode}
        initial={editMistake ?? undefined}
        saving={saving}
      />

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete mistake"
        message="This mistake entry will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
