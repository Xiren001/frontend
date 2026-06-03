'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { WeekStats } from '@/lib/types'

interface ReportNarrative { id: string; week_number: number; narrative_text: string }

export default function WeeklyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [weekStats, setWeekStats] = useState<WeekStats[]>([])
  const [narratives, setNarratives] = useState<ReportNarrative[]>([])
  const [saving, setSaving] = useState<number | null>(null)

  async function load() {
    const data = await api.get<{ weekStats: WeekStats[]; narratives: ReportNarrative[] }>(`/api/reports/weekly?month=${month}`)
    setWeekStats(data.weekStats)
    setNarratives(data.narratives)
  }

  useEffect(() => { load() }, [month])

  function getNarrative(week: number) {
    return narratives.find(n => n.week_number === week)?.narrative_text ?? ''
  }

  async function saveNarrative(week: number, text: string) {
    setSaving(week)
    await api.put('/api/reports/narrative', {
      type: 'weekly',
      week_number: week,
      month_year: `${month}-01`,
      narrative_text: text,
    })
    setSaving(null)
    load()
  }

  const METRICS: { key: keyof WeekStats; label: string }[] = [
    { key: 'logged', label: 'Builds logged' },
    { key: 'completed', label: 'Completed (live)' },
    { key: 'winners', label: 'Winners' },
    { key: 'killed', label: 'Killed' },
    { key: 'avgBuildDays', label: 'Avg build (days)' },
    { key: 'avgTotalDays', label: 'Avg total: approved → live (days)' },
  ]

  const monthTotal = (key: keyof WeekStats) => {
    const vals = weekStats.map(w => w[key] as number | null).filter((v): v is number => v !== null)
    if (vals.length === 0) return '—'
    if (key === 'avgBuildDays' || key === 'avgTotalDays') {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return Math.round(avg * 10) / 10
    }
    return vals.reduce((a, b) => a + b, 0)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Weekly Report to Abigél</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <p className="text-xs text-gray-400 mb-6">Auto counts from trackers. Fill narrative cells each Friday — send by 2pm.</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
        <table className="min-w-full text-sm divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Metric</th>
              {[1,2,3,4].map(w => <th key={w} className="px-4 py-3 text-center text-xs font-medium text-gray-500">Week {w}</th>)}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {METRICS.map(m => (
              <tr key={m.key} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{m.label}</td>
                {weekStats.map(w => (
                  <td key={w.week} className="px-4 py-3 text-center text-gray-700">
                    {w[m.key] ?? '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-medium">{monthTotal(m.key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1,2,3,4].map(w => (
          <div key={w} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Week {w} — narrative</p>
            <NarrativeField
              value={getNarrative(w)}
              onSave={text => saveNarrative(w, text)}
              saving={saving === w}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function NarrativeField({ value, onSave, saving }: { value: string; onSave: (t: string) => void; saving: boolean }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <div>
      <textarea
        rows={4}
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
        placeholder="Notes for Abigél…"
      />
      <button
        onClick={() => onSave(text)}
        disabled={saving}
        className="mt-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
