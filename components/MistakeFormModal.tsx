'use client'
import { useEffect, useState } from 'react'
import { Modal, FormField, ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Mistake } from '@/lib/types'

const CATEGORIES = [
  'Translation / proofreading',
  'Pricing / currency / tax (per market)',
  'Payment method missing or broken (Shopify checkout)',
  'Variant / SKU / inventory mapping (size · metal · length)',
  'Product imagery / sizing chart',
  'Shopify page issue (jewelry)',
  'Speed / performance',
  'Product',
]

const CAUGHT_WHERE = ['Phase 1 (Build QA)', 'Phase 2 (Proofread)', 'Phase 3 (Testing)', 'Phase 4 (Expanding)', 'Live']

interface MistakeFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Mistake>) => Promise<void>
  mode: 'create' | 'edit'
  initial?: Partial<Mistake>
  saving?: boolean
}

function emptyMistake(): Partial<Mistake> {
  return { date: new Date().toISOString().slice(0, 10) }
}

export function MistakeFormModal({ open, onClose, onSave, mode, initial, saving = false }: MistakeFormModalProps) {
  const [form, setForm] = useState<Partial<Mistake>>(emptyMistake())

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' && initial ? { ...initial } : emptyMistake())
    }
  }, [open, mode, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Log a mistake' : 'Edit mistake'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add entry' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Date">
            <Input type="date" mono value={form.date ?? ''} onChange={e => setForm(d => ({ ...d, date: e.target.value }))} />
          </FormField>
          <FormField label="Product">
            <Input value={form.product_name ?? ''} onChange={e => setForm(d => ({ ...d, product_name: e.target.value }))} />
          </FormField>
          <FormField label="Category">
            <select
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              value={form.category ?? ''}
              onChange={e => setForm(d => ({ ...d, category: e.target.value }))}
            >
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Caught where">
            <select
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              value={form.caught_where ?? ''}
              onChange={e => setForm(d => ({ ...d, caught_where: e.target.value }))}
            >
              <option value="">Select…</option>
              {CAUGHT_WHERE.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Description">
          <textarea
            rows={3}
            value={form.description ?? ''}
            onChange={e => setForm(d => ({ ...d, description: e.target.value }))}
            className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            placeholder="What happened?"
          />
        </FormField>
        <FormField label="Root cause">
          <Input value={form.root_cause ?? ''} onChange={e => setForm(d => ({ ...d, root_cause: e.target.value }))} placeholder="Optional" />
        </FormField>
        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.sop_updated ?? false}
              onChange={e => setForm(d => ({ ...d, sop_updated: e.target.checked }))}
            />
            SOP updated
          </label>
        )}
      </form>
    </Modal>
  )
}

export { CATEGORIES, CAUGHT_WHERE, ConfirmModal }
