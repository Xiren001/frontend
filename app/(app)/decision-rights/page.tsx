'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal, FormField } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2 } from 'lucide-react'

interface DecisionRight {
  id: string
  section: string
  decision: string
  myko: string
  abigel: string
  owner: string
  sort_order: number
}

const ROLE_OPTIONS = ['—', 'Decides', 'Recommends', 'Approves', 'Approves*', 'Informed']

const SELECT_CLS = 'w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'

function RoleBadge({ val }: { val: string }) {
  if (!val || val === '—') return <span className="text-text-muted">—</span>
  if (val === 'Decides') return <Badge variant="accent">{val}</Badge>
  if (val.startsWith('Approves')) return <Badge variant="accent">{val}</Badge>
  if (val === 'Recommends') return <Badge variant="warn">{val}</Badge>
  if (val === 'Informed') return <Badge variant="muted">{val}</Badge>
  return <span className="text-text-muted">{val}</span>
}

function emptyForm(): Partial<DecisionRight> {
  return { section: '', decision: '', myko: '—', abigel: '—', owner: '—', sort_order: 0 }
}

export default function DecisionRightsPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'

  const [items, setItems] = useState<DecisionRight[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<DecisionRight | null>(null)
  const [form, setForm] = useState<Partial<DecisionRight>>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    api.get<DecisionRight[]>('/api/decision-rights').then(setItems).catch(console.error)
  }

  useRealtimeRefresh('decision_rights', load)
  useEffect(() => { load() }, [])

  const sections = Array.from(new Set(items.map(i => i.section).filter(Boolean)))

  function openCreate() {
    setEditItem(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(item: DecisionRight) {
    setEditItem(item)
    setForm({ ...item })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.decision?.trim()) return
    setSaving(true)
    try {
      if (editItem) {
        await api.put(`/api/decision-rights/${editItem.id}`, form)
      } else {
        await api.post('/api/decision-rights', form)
      }
      setModalOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/decision-rights/${deleteId}`)
      setDeleteId(null)
      load()
    } finally { setDeleting(false) }
  }

  const grouped = sections.map(section => ({
    section,
    items: items.filter(i => i.section === section),
  }))
  const ungrouped = items.filter(i => !i.section)
  if (ungrouped.length) grouped.push({ section: 'Other', items: ungrouped })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
      <PageHeader
        title="Decision Rights"
        description="Who decides, recommends, approves, or is informed for each action."
        actions={isAdmin ? (
          <Button variant="secondary" size="sm" onClick={openCreate}>+ Add</Button>
        ) : undefined}
      />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted py-12 text-center">
          No decision rights yet.{isAdmin && <> <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button></>}
        </p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pt-6">
          {grouped.map(group => (
            <Card key={group.section} className="overflow-hidden">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{group.section}</p>
              </CardHeader>

              <div className="divide-y divide-border-subtle">
                {group.items.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                    <p className="flex-1 text-sm text-foreground">{item.decision}</p>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-4">
                        <div className="text-center min-w-[72px]">
                          <p className="text-[10px] text-text-muted mb-1">Myko</p>
                          <RoleBadge val={item.myko} />
                        </div>
                        <div className="text-center min-w-[72px]">
                          <p className="text-[10px] text-text-muted mb-1">Abigél</p>
                          <RoleBadge val={item.abigel} />
                        </div>
                        <div className="text-center min-w-[72px]">
                          <p className="text-[10px] text-text-muted mb-1">Owner</p>
                          <RoleBadge val={item.owner} />
                        </div>
                      </div>

                      {/* Mobile: compact role badges inline */}
                      <div className="flex sm:hidden items-center gap-1.5">
                        <RoleBadge val={item.myko} />
                        <RoleBadge val={item.abigel} />
                        <RoleBadge val={item.owner} />
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Edit decision' : 'Add decision'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.decision?.trim()}>
              {saving ? 'Saving…' : editItem ? 'Save changes' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Section">
            <Input
              value={form.section ?? ''}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
              placeholder="e.g. Build / Process Decisions"
              list="section-list"
            />
            <datalist id="section-list">
              {sections.map(s => <option key={s} value={s} />)}
            </datalist>
          </FormField>

          <FormField label="Decision">
            <textarea
              rows={3}
              value={form.decision ?? ''}
              onChange={e => setForm(f => ({ ...f, decision: e.target.value }))}
              placeholder="Describe the decision…"
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            {(['myko', 'abigel', 'owner'] as const).map(person => (
              <FormField key={person} label={person === 'abigel' ? 'Abigél' : person.charAt(0).toUpperCase() + person.slice(1)}>
                <select
                  className={SELECT_CLS}
                  value={form[person] ?? '—'}
                  onChange={e => setForm(f => ({ ...f, [person]: e.target.value }))}
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            ))}
          </div>

          <FormField label="Sort order">
            <Input
              type="number"
              mono
              value={form.sort_order ?? 0}
              onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete decision"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">This decision right will be permanently removed.</p>
      </Modal>
    </div>
  )
}
