'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, currentMonth, cn } from '@/lib/utils'
import type { Mistake } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'
import { MistakeFormModal, CATEGORIES, ConfirmModal } from '@/components/MistakeFormModal'

const SOP_THRESHOLD = 3

export default function MistakeLogPage() {
  const [month, setMonth] = useState(currentMonth())
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editMistake, setEditMistake] = useState<Mistake | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  function openCreate() {
    setFormMode('create')
    setEditMistake(null)
    setFormOpen(true)
  }

  function openEdit(m: Mistake) {
    setFormMode('edit')
    setEditMistake(m)
    setFormOpen(true)
  }

  async function handleSave(data: Partial<Mistake>) {
    setSaving(true)
    try {
      if (formMode === 'create') {
        await api.post('/api/mistakes', data)
      } else if (editMistake) {
        await api.put(`/api/mistakes/${editMistake.id}`, { ...editMistake, ...data })
      }
      setFormOpen(false)
      loadMistakes()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/mistakes/${deleteId}`)
      setDeleteId(null)
      loadMistakes()
    } finally {
      setDeleting(false)
    }
  }

  const columns: ResponsiveColumn<Mistake>[] = [
    {
      key: 'date',
      header: 'Date',
      mono: true,
      render: m => formatDate(m.date),
    },
    {
      key: 'product',
      header: 'Product',
      render: m => <span className="text-foreground">{m.product_name ?? '—'}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: m => m.category ?? '—',
    },
    {
      key: 'caught',
      header: 'Caught where',
      render: m => m.caught_where ?? '—',
    },
    {
      key: 'description',
      header: 'Description',
      render: m => m.description ?? '—',
    },
    {
      key: 'sop',
      header: 'SOP?',
      render: m => (
        m.sop_updated ? <Badge variant="accent">✓</Badge> : <span className="text-text-muted">—</span>
      ),
    },
    ...(isAdmin ? [{
      key: 'actions',
      header: '',
      hideOnMobile: true,
      align: 'right' as const,
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
          <div className="flex flex-wrap items-center gap-3">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={openCreate}>+ Log mistake</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ResponsiveTable
            columns={columns}
            data={mistakes}
            rowKey={m => m.id}
            emptyMessage="No mistakes logged this month"
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

        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Pattern watch</p>
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
                {CATEGORIES.map(cat => {
                  const count = counts[cat] ?? 0
                  const flagged = count >= SOP_THRESHOLD
                  return (
                    <tr key={cat} className={flagged ? 'bg-danger-muted/30' : ''}>
                      <td className="py-2 px-4 text-text-secondary leading-tight">{cat}</td>
                      <td className="py-2 px-4 text-right font-mono font-medium text-foreground">{count}</td>
                      <td className="py-2 px-4 text-right">
                        {flagged ? <Badge variant="danger">FLAG</Badge> : <Badge variant="muted">OK</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {CATEGORIES.map(cat => {
                const count = counts[cat] ?? 0
                const flagged = count >= SOP_THRESHOLD
                return (
                  <div
                    key={cat}
                    className={cn('px-4 py-3 flex items-start justify-between gap-3', flagged && 'bg-danger-muted/30')}
                  >
                    <p className="text-xs text-text-secondary leading-tight flex-1">{cat}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-medium text-foreground">{count}</span>
                      {flagged ? <Badge variant="danger">FLAG</Badge> : <Badge variant="muted">OK</Badge>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </div>

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
