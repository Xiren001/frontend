'use client'
import { useEffect, useState } from 'react'
import { Modal, FormField } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'

interface BuildFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Build>) => Promise<void>
  type: BuildType
  mode: 'create' | 'edit'
  initial?: Partial<Build>
  defaultWeek?: number
  saving?: boolean
}

function emptyBuild(type: BuildType, week: number): Partial<Build> {
  return { type, week_number: week, month_year: currentMonth() + '-01', product_name: '', language: '' }
}

export function BuildFormModal({
  open,
  onClose,
  onSave,
  type,
  mode,
  initial,
  defaultWeek = 1,
  saving = false,
}: BuildFormModalProps) {
  const [form, setForm] = useState<Partial<Build>>(emptyBuild(type, defaultWeek))

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' && initial ? { ...initial } : emptyBuild(type, defaultWeek))
    }
  }, [open, mode, initial, type, defaultWeek])

  function setField<K extends keyof Build>(key: K, value: Build[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add build' : 'Edit build'}
      description={mode === 'create' ? `New ${type} build for Week ${form.week_number}.` : form.product_name}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.product_name?.trim()}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add build' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Product name" className="sm:col-span-2">
            <Input
              value={form.product_name ?? ''}
              onChange={e => setField('product_name', e.target.value)}
              placeholder="Product name"
              autoFocus
            />
          </FormField>
          <FormField label="Language">
            <Input
              value={form.language ?? ''}
              onChange={e => setField('language', e.target.value || null)}
              placeholder="e.g. DE"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FormField label="Week">
            <select
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              value={form.week_number ?? 1}
              onChange={e => setField('week_number', Number(e.target.value))}
            >
              {[1, 2, 3, 4].map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </FormField>
          <FormField label="Approved date">
            <Input
              type="date"
              mono
              value={(form.approved_date as string) ?? ''}
              onChange={e => setField('approved_date', (e.target.value || null) as Build['approved_date'])}
            />
          </FormField>
          <FormField label="Outcome">
            <select
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              value={form.outcome ?? ''}
              onChange={e => setField('outcome', (e.target.value as Build['outcome']) || null)}
            >
              <option value="">—</option>
              <option value="stopped">Stopped</option>
              <option value="testing">Testing</option>
              <option value="expanding">Expanding</option>
            </select>
          </FormField>
          <FormField label="Proofreader">
            <Input
              value={form.proofreader ?? ''}
              onChange={e => setField('proofreader', e.target.value || null)}
              placeholder="Proofreader"
            />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            rows={2}
            value={form.notes ?? ''}
            onChange={e => setField('notes', e.target.value || null)}
            className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            placeholder="Optional notes…"
          />
        </FormField>
      </form>
    </Modal>
  )
}
