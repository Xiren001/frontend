'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings } from '@/lib/types'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { useRole } from '@/lib/role-context'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const PIPELINE_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'build_target_days',  label: 'Build target',          unit: 'days' },
  { key: 'proof_target_days',  label: 'Proofread target',      unit: 'days' },
  { key: 'test_target_days',   label: 'Testing target',        unit: 'days' },
  { key: 'expand_target_days', label: 'Expand target',         unit: 'days' },
  { key: 'total_target_days',  label: 'Total pipeline target', unit: 'days' },
]

const THRESHOLD_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'tool_approval_threshold',    label: 'Tool approval threshold',  unit: '$/mo' },
  { key: 'payment_approval_threshold', label: 'Payment method approval',  unit: '$'    },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft]       = useState<Partial<Settings>>({})
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const { role } = useRole()
  const isAdmin = role === 'admin'

  function applySettings(s: Settings) { setSettings(s); setDraft(s) }
  function loadSettings() {
    api.get<Settings>('/api/settings').then(applySettings).catch(console.error)
  }

  useRealtimeRefresh('settings', loadSettings)
  useEffect(() => { loadSettings() }, [])

  function cancelEdit() {
    if (settings) setDraft({ ...settings })
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.put<Settings>('/api/settings', draft)
      applySettings(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Pipeline targets and approval thresholds."
      />

      <div className="mt-6 max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">Pipeline Settings</h2>
            <p className="text-xs text-text-muted mt-0.5">Targets and thresholds that drive KPI colours.</p>
          </div>
          {isAdmin && !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        <Card className="divide-y divide-border-subtle">
          <div className="px-5 py-2.5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Pipeline Targets</p>
          </div>
          {PIPELINE_FIELDS.map(f => (
            <div key={f.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">{f.label}</p>
                <p className="text-xs text-text-muted font-mono">{f.unit}</p>
              </div>
              {editing ? (
                <Input
                  type="number"
                  mono
                  className="w-24 text-right"
                  value={draft[f.key] as number ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                />
              ) : (
                <span className="text-sm font-mono font-medium text-foreground">
                  {settings[f.key] as number}
                </span>
              )}
            </div>
          ))}

          <div className="px-5 py-2.5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Approval Thresholds</p>
          </div>
          {THRESHOLD_FIELDS.map(f => (
            <div key={f.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">{f.label}</p>
                <p className="text-xs text-text-muted font-mono">{f.unit}</p>
              </div>
              {editing ? (
                <Input
                  type="number"
                  mono
                  className="w-24 text-right"
                  value={draft[f.key] as number ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                />
              ) : (
                <span className="text-sm font-mono font-medium text-foreground">
                  {settings[f.key] as number}
                </span>
              )}
            </div>
          ))}
        </Card>

        {editing && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
        {!isAdmin && (
          <p className="mt-3 text-xs text-text-muted">Admin access required to edit settings.</p>
        )}
      </div>
    </div>
  )
}
