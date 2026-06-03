'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'

interface MonthlyReport {
  totalCompleted: number
  jewelryCompleted: number
  funnelCompleted: number
  byWeek: number[]
  winners: number
  killed: number
  winRate: string
  avgBuildDays: number | null
  avgTotalDays: number | null
  narrative: { narrative_text: string } | null
}

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await api.get<MonthlyReport>(`/api/reports/monthly?month=${month}`)
    setReport(data)
    setNarrativeText(data.narrative?.narrative_text ?? '')
  }

  useEffect(() => { load() }, [month])

  async function saveNarrative() {
    setSaving(true)
    await api.put('/api/reports/narrative', {
      type: 'monthly',
      week_number: null,
      month_year: `${month}-01`,
      narrative_text: narrativeText,
    })
    setSaving(false)
  }

  const rows = report ? [
    ['Builds completed (went live)', report.totalCompleted],
    ['  · Jewelry (Shopify)', report.jewelryCompleted],
    ['  · Funnel (Funnelish)', report.funnelCompleted],
    ['Completed by week — W1/W2/W3/W4', report.byWeek.join(' / ')],
    ['Winners decided', report.winners],
    ['Killed', report.killed],
    ['Win rate (decided)', report.winRate],
    ['Build cycle avg (days)', report.avgBuildDays ?? '—'],
    ['Total pipeline avg (days)', report.avgTotalDays ?? '—'],
  ] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Monthly Report to Abigél</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Metric</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map(([label, val], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{label}</td>
                  <td className="px-4 py-3 text-right font-medium">{val}</td>
                </tr>
              ))}
              {!report && <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Monthly narrative</p>
          <textarea
            rows={10}
            value={narrativeText}
            onChange={e => setNarrativeText(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            placeholder="End-of-month summary for Abigél…"
          />
          <button
            onClick={saveNarrative}
            disabled={saving}
            className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save narrative'}
          </button>
        </div>
      </div>
    </div>
  )
}
