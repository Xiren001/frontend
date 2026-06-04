'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Pipeline targets and approval thresholds. These drive KPI colours and the proofread flag."
      />

      <Card className="max-w-lg divide-y divide-border-subtle">
        {FIELDS.map(f => (
          <div key={f.key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">{f.label}</p>
              <p className="text-xs text-text-muted font-mono">{f.unit}</p>
            </div>
            {isAdmin ? (
              <Input
                type="number"
                value={draft[f.key] as number ?? ''}
                onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                className="w-24 text-right"
                mono
              />
            ) : (
              <span className="text-sm font-mono font-medium text-foreground">{settings[f.key]}</span>
            )}
          </div>
        ))}
      </Card>

      {isAdmin && (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="mt-6"
        >
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save settings'}
        </Button>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-text-muted">Admin access required to edit settings.</p>
      )}
    </div>
  )
}
