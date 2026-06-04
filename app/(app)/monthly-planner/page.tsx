'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { PlannerNote } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7
}

export default function MonthlyPlannerPage() {
  const [month, setMonth] = useState(currentMonth())
  const [notes, setNotes] = useState<PlannerNote[]>([])
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = getDaysInMonth(year, mon)
  const firstDayOffset = getFirstDayOfWeek(year, mon)

  async function load() {
    const data = await api.get<PlannerNote[]>(`/api/planner?month=${month}`)
    setNotes(data)
  }

  useEffect(() => { load() }, [month])

  function getNote(dateStr: string) {
    return notes.find(n => n.date === dateStr)?.notes ?? ''
  }

  function handleDayClick(dateStr: string) {
    setEditDate(dateStr)
    setEditText(getNote(dateStr))
  }

  async function saveNote() {
    if (!editDate) return
    setSaving(true)
    await api.put(`/api/planner/${editDate}`, { notes: editText })
    setSaving(false)
    setEditDate(null)
    load()
  }

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <PageHeader
        title="Monthly Planner"
        description="Daily notes and planning. Click a day to add or edit."
        actions={
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" mono />
        }
      />

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-text-muted py-1 font-mono uppercase tracking-wider">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="rounded-md h-24" />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const note = getNote(dateStr)
          const today = new Date().toISOString().slice(0, 10)
          return (
            <div
              key={i}
              onClick={() => handleDayClick(dateStr)}
              className={`rounded-md border p-2.5 h-24 cursor-pointer overflow-hidden transition-colors hover:border-accent-border hover:bg-surface-hover ${
                dateStr === today
                  ? 'border-accent-border bg-accent-muted/30'
                  : note
                    ? 'border-border bg-surface-elevated'
                    : 'border-border-subtle bg-surface'
              }`}
            >
              <p className={`text-xs font-mono font-medium mb-1 ${dateStr === today ? 'text-accent' : 'text-text-muted'}`}>{day}</p>
              {note && <p className="text-xs text-text-secondary leading-tight line-clamp-3">{note}</p>}
            </div>
          )
        })}
      </div>

      {editDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditDate(null)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardBody>
              <p className="text-sm font-mono font-medium text-foreground mb-4">{editDate}</p>
              <textarea
                rows={6}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
                placeholder="Notes for this day…"
              />
              <div className="flex gap-2 mt-4">
                <Button onClick={saveNote} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="ghost" onClick={() => setEditDate(null)}>Cancel</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
