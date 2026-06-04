'use client'
import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { Build } from '@/lib/types'
import { Trash2, Plus } from 'lucide-react'

interface Item { text: string; done: boolean }

function parse(notes: string | null): Item[] {
  if (!notes?.trim()) return []
  return notes
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      if (l.startsWith('[x] ')) return { text: l.slice(4), done: true }
      if (l.startsWith('[ ] ')) return { text: l.slice(4), done: false }
      return { text: l, done: false }
    })
}

function serialize(items: Item[]): string {
  return items.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n')
}

interface Props {
  build: Build | null
  onClose: () => void
  onSaved: () => void
  isAdmin: boolean
}

export function BuildNoteModal({ build, onClose, onSaved, isAdmin }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync items whenever the build (or its notes) changes
  useEffect(() => {
    setItems(parse(build?.notes ?? null))
    setNewText('')
  }, [build?.id, build?.notes])

  function toggle(idx: number) {
    if (!isAdmin) return
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, done: !it.done } : it))
  }

  function remove(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function addItem() {
    const text = newText.trim()
    if (!text) return
    setItems(prev => [...prev, { text, done: false }])
    setNewText('')
    inputRef.current?.focus()
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addItem() }
  }

  async function handleSave() {
    if (!build) return
    setSaving(true)
    try {
      await api.put(`/api/builds/${build.id}`, { notes: serialize(items) || null })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const done = items.filter(i => i.done).length

  return (
    <Modal
      open={!!build}
      onClose={onClose}
      title={build ? `${build.product_name}${build.language ? ` · ${build.language}` : ''}` : ''}
      description={items.length > 0 ? `${done} / ${items.length} done` : 'No notes yet'}
      size="md"
      footer={
        isAdmin ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="space-y-1 min-h-[80px]">
        {items.length === 0 && (
          <p className="text-sm text-text-muted py-6 text-center">
            {isAdmin ? 'No notes yet — add one below.' : 'No notes.'}
          </p>
        )}

        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-elevated group transition-colors"
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(idx)}
              disabled={!isAdmin}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
            />
            <span className={`flex-1 text-sm leading-snug select-none ${item.done ? 'line-through text-text-muted' : 'text-foreground'}`}>
              {item.text}
            </span>
            {isAdmin && (
              <button
                onClick={() => remove(idx)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all p-0.5 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-border-subtle">
          <Input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={onKey}
            placeholder="Add a note…"
            className="flex-1"
            autoFocus={false}
          />
          <Button variant="secondary" size="sm" onClick={addItem} disabled={!newText.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Modal>
  )
}
