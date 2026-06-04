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

  return (
    <div>
      <PageHeader
        title="Mistake Log"
        description="Track errors by category. Pattern watch flags categories with 3+ occurrences."
        actions={
          <div className="flex items-center gap-3">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={openCreate}>+ Log mistake</Button>
            )}
          </div>
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
                    {m.sop_updated ? <Badge variant="accent">✓</Badge> : <span className="text-text-muted">—</span>}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right whitespace-nowrap">
                      <button onClick={() => openEdit(m)} className="text-xs text-text-secondary hover:text-foreground mr-3">Edit</button>
                      <button onClick={() => setDeleteId(m.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
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
