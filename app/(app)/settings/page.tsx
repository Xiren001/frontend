'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings } from '@/lib/types'
import { createClient } from '@/lib/supabase'

const FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'build_target_days', label: 'Build target (days)', unit: 'days' },
  { key: 'proof_target_days', label: 'Proofread target (days)', unit: 'days' },
  { key: 'test_target_days', label: 'Testing target (days)', unit: 'days' },
  { key: 'expand_target_days', label: 'Expand target (days)', unit: 'days' },
  { key: 'total_target_days', label: 'Total pipeline target (days)', unit: 'days' },
  { key: 'tool_approval_threshold', label: 'Tool approval threshold', unit: '$/mo' },
  { key: 'payment_approval_threshold', label: 'Payment method approval threshold', unit: '$' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get<Settings>('/api/settings').then(s => { setSettings(s); setDraft(s) }).catch(console.error)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await api.put('/api/settings', draft)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Pipeline targets and approval thresholds. These drive KPI colours and the proofread flag.</p>

      <div className="max-w-lg rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {FIELDS.map(f => (
          <div key={f.key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-700">{f.label}</p>
              <p className="text-xs text-gray-400">{f.unit}</p>
            </div>
            {isAdmin ? (
              <input
                type="number"
                value={draft[f.key] as number ?? ''}
                onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                className="w-24 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            ) : (
              <span className="text-sm font-medium text-gray-700">{settings[f.key]}</span>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save settings'}
        </button>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-gray-400">Admin access required to edit settings.</p>
      )}
    </div>
  )
}
