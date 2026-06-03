'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { QAItem } from '@/lib/types'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<QAItem[]>(`/api/qa/${buildId}`).then(setItems).catch(console.error)
  }, [buildId])

  function toggle(key: string) {
    setItems(prev => prev.map(item => item.key === key ? { ...item, done: !item.done } : item))
  }

  function setNote(key: string, notes: string) {
    setItems(prev => prev.map(item => item.key === key ? { ...item, notes } : item))
  }

  async function handleSave() {
    setSaving(true)
    await api.put(`/api/qa/${buildId}`, items.map(i => ({ key: i.key, done: i.done, notes: i.notes ?? '' })))
    setSaving(false)
  }

  const sections = ['shopify', 'jewelry', 'funnel', 'localization'] as const
  const allDone = items.length > 0 && items.every(i => i.done)
  const doneCount = items.filter(i => i.done).length

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:underline">← Back</button>
        <h1 className="text-xl font-semibold">Build QA Checklist</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {doneCount}/{items.length} done
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-6">Run on every build before it leaves Building. Nothing moves to Proofread with an open box.</p>

      <div className="space-y-6">
        {sections.map(section => {
          const sectionItems = items.filter(i => i.section === section)
          return (
            <div key={section} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{SECTION_LABELS[section]}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {sectionItems.map(item => (
                  <div key={item.key} className="px-4 py-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggle(item.key)}
                      className="mt-0.5 cursor-pointer h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</p>
                      <input
                        type="text"
                        value={item.notes ?? ''}
                        onChange={e => setNote(item.key, e.target.value)}
                        placeholder="Notes…"
                        className="mt-1 w-full text-xs border-0 border-b border-gray-100 focus:border-gray-300 focus:outline-none py-0.5 text-gray-500 bg-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save checklist'}
        </button>
      </div>
    </div>
  )
}
