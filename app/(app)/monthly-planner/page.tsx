'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { PlannerNote } from '@/lib/types'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun…6=Sat; convert to Mon=0
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Monthly Planner</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="rounded-lg h-24" />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const note = getNote(dateStr)
          const today = new Date().toISOString().slice(0, 10)
          return (
            <div
              key={i}
              onClick={() => handleDayClick(dateStr)}
              className={`rounded-lg border p-2 h-24 cursor-pointer overflow-hidden transition-colors hover:border-blue-300 ${
                dateStr === today ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 mb-1">{day}</p>
              {note && <p className="text-xs text-gray-600 leading-tight line-clamp-3">{note}</p>}
            </div>
          )
        })}
      </div>

      {editDate && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setEditDate(null)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 mb-3">{editDate}</p>
            <textarea
              rows={6}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
              placeholder="Notes for this day…"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={saveNote} disabled={saving}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditDate(null)} className="text-sm text-gray-400 hover:underline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
