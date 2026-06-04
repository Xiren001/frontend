'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import type { QAItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Modal, FormField } from '@/components/ui/modal'

const SECTION_LABELS: Record<string, string> = {
  shopify:      'Shopify Product & Checkout (Both Operations)',
  jewelry:      'Jewelry — Shopify Page (Operation 1)',
  funnel:       'Funnel Product — Funnelish 2-page funnel (Operation 2)',
  localization: 'Localization',
}

export default function QAChecklistPage() {
  const { buildId } = useParams<{ buildId: string }>()
  const router = useRouter()
  const [items, setItems] = useState<QAItem[]>([])
  const [editItem, setEditItem] = useState<QAItem | null>(null)
  const [editDone, setEditDone] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  function loadItems() {
    api.get<QAItem[]>(`/api/qa/${buildId}`).then(setItems).catch(console.error)
  }

  useRealtimeRefresh('qa_items', loadItems)
  useEffect(() => { loadItems() }, [buildId])

  function openEditItem(item: QAItem) {
    setEditItem(item)
    setEditDone(item.done)
    setEditNotes(item.notes ?? '')
  }

  function applyEdit() {
    if (!editItem) return
    setItems(prev => prev.map(i =>
      i.key === editItem.key ? { ...i, done: editDone, notes: editNotes || null } : i
    ))
    setEditItem(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put(`/api/qa/${buildId}`, items.map(i => ({ key: i.key, done: i.done, notes: i.notes ?? '' })))
      setSaveOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const sections = ['shopify', 'jewelry', 'funnel', 'localization'] as const
  const allDone = items.length > 0 && items.every(i => i.done)
  const doneCount = items.filter(i => i.done).length

  return (
    <div>
      <PageHeader
        title="Build QA Checklist"
        description="Run on every build before it leaves Building. Nothing moves to Proofread with an open box."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={allDone ? 'accent' : 'muted'}>
              {doneCount}/{items.length} done
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => setSaveOpen(true)}>Save checklist</Button>
            <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
          </div>
        }
      />

      <div className="space-y-6">
        {sections.map(section => {
          const sectionItems = items.filter(i => i.section === section)
          return (
            <Card key={section} className="overflow-hidden">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{SECTION_LABELS[section]}</p>
              </CardHeader>
              <div className="divide-y divide-border-subtle">
                {sectionItems.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => openEditItem(item)}
                    className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-surface-hover/50 transition-colors text-left"
                  >
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${
                      item.done
                        ? 'bg-accent-muted border-accent-border text-accent'
                        : 'border-border bg-surface-elevated'
                    }`}>
                      {item.done ? '✓' : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.done ? 'text-text-muted line-through' : 'text-foreground'}`}>{item.label}</p>
                      {item.notes && (
                        <p className="mt-1 text-xs font-mono text-text-muted truncate">{item.notes}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        title="Checklist item"
        description={editItem?.label}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button size="sm" onClick={applyEdit}>Apply</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={editDone}
              onChange={e => setEditDone(e.target.checked)}
              className="h-4 w-4"
            />
            Mark as done
          </label>
          <FormField label="Notes">
            <textarea
              rows={3}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-mono text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
              placeholder="Notes…"
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save checklist"
        description={`${doneCount} of ${items.length} items marked done.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm save'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          {allDone
            ? 'All items complete — this build is ready to move to Proofread.'
            : `${items.length - doneCount} item(s) still open. Save anyway?`}
        </p>
      </Modal>
    </div>
  )
}
