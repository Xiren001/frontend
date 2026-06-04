'use client'
import { useState, useRef, KeyboardEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { CATEGORIES, CAUGHT_WHERE } from '@/components/MistakeFormModal'
import { Trash2, Plus } from 'lucide-react'

interface Row {
  _id: string
  date: string
  product_name: string
  category: string
  caught_where: string
  description: string
}

function today() { return new Date().toISOString().slice(0, 10) }

function blankRow(): Row {
  return { _id: crypto.randomUUID(), date: today(), product_name: '', category: '', caught_where: '', description: '' }
}

const SELECT_CLS = 'w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'
const INPUT_CLS  = 'w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/40'

interface Props {
  open: boolean
  month: string      // e.g. "2026-06"
  onClose: () => void
  onSaved: () => void
}

export function MistakeBulkModal({ open, month, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>(() => [blankRow(), blankRow(), blankRow()])
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  function update(id: string, field: keyof Row, val: string) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r))
  }

  function addRow() {
    setRows(prev => [...prev, blankRow()])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev)
  }

  function onKey(e: KeyboardEvent, isLastField: boolean) {
    if (e.key === 'Enter' && isLastField) { e.preventDefault(); addRow() }
  }

  const validRows = rows.filter(r => r.product_name.trim() || r.description.trim())

  async function handleSave() {
    if (!validRows.length) return
    setSaving(true)
    try {
      const payload = validRows.map(({ _id, ...r }) => ({
        ...r,
        month_year: `${month}-01`,
        product_name: r.product_name || null,
        category:     r.category     || null,
        caught_where: r.caught_where || null,
        description:  r.description  || null,
      }))
      await api.post('/api/mistakes/bulk', payload)
      setRows([blankRow(), blankRow(), blankRow()])
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setRows([blankRow(), blankRow(), blankRow()])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk log mistakes"
      description={`Fill in rows and save. Empty rows are skipped. ${validRows.length > 0 ? `${validRows.length} ready to save.` : ''}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || validRows.length === 0}>
            {saving ? 'Saving…' : `Save ${validRows.length || ''} entr${validRows.length === 1 ? 'y' : 'ies'}`}
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left text-text-muted font-medium pb-2 pr-2 w-[110px]">Date</th>
              <th className="text-left text-text-muted font-medium pb-2 pr-2 w-[120px]">Product</th>
              <th className="text-left text-text-muted font-medium pb-2 pr-2 w-[160px]">Category</th>
              <th className="text-left text-text-muted font-medium pb-2 pr-2 w-[130px]">Caught where</th>
              <th className="text-left text-text-muted font-medium pb-2 pr-2">Description</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/50">
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1
              const isEmpty = !row.product_name && !row.description
              return (
                <tr key={row._id} className={isEmpty ? 'opacity-60' : ''}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="date"
                      value={row.date}
                      onChange={e => update(row._id, 'date', e.target.value)}
                      className={INPUT_CLS + ' font-mono'}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.product_name}
                      onChange={e => update(row._id, 'product_name', e.target.value)}
                      placeholder="Product…"
                      className={INPUT_CLS}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select value={row.category} onChange={e => update(row._id, 'category', e.target.value)} className={SELECT_CLS}>
                      <option value="">Category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select value={row.caught_where} onChange={e => update(row._id, 'caught_where', e.target.value)} className={SELECT_CLS}>
                      <option value="">Where…</option>
                      {CAUGHT_WHERE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.description}
                      onChange={e => update(row._id, 'description', e.target.value)}
                      onKeyDown={e => onKey(e, isLast)}
                      placeholder="What happened…"
                      className={INPUT_CLS}
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => removeRow(row._id)}
                      className="text-text-muted hover:text-danger transition-colors p-0.5 rounded"
                      title="Remove row"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div ref={bottomRef} />
      </div>

      <button
        onClick={addRow}
        className="mt-3 flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors py-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Add row
      </button>
    </Modal>
  )
}
