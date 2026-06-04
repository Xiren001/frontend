'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings, ApproverPermissions } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal, FormField } from '@/components/ui/modal'
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

const PERM_PAGES: { key: keyof ApproverPermissions; label: string }[] = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'jewelry_tracker', label: 'Jewelry Tracker' },
  { key: 'funnel_tracker',  label: 'Funnel Tracker' },
  { key: 'proofread_queue', label: 'Proofread Queue' },
  { key: 'mistake_log',     label: 'Mistake Log' },
  { key: 'monthly_planner', label: 'Monthly Planner' },
  { key: 'decision_rights', label: 'Decision Rights' },
  { key: 'settings',        label: 'Settings (view only)' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permDraft, setPermDraft] = useState<ApproverPermissions | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  useEffect(() => {
    api.get<Settings>('/api/settings').then(s => {
      setSettings(s)
      setDraft(s)
      if (s.approver_permissions) setPermDraft(s.approver_permissions)
    }).catch(console.error)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [])

  function openEdit() {
    if (settings) setDraft({ ...settings })
    setEditOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.put<Settings>('/api/settings', draft)
      setSettings(updated)
      setDraft(updated)
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePerms() {
    if (!permDraft) return
    setSavingPerms(true)
    try {
      const updated = await api.put<Settings>('/api/settings', { approver_permissions: permDraft })
      setSettings(updated)
    } finally {
      setSavingPerms(false)
    }
  }

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Pipeline targets and approval thresholds. These drive KPI colours and the proofread flag."
        actions={
          isAdmin ? (
            <Button variant="secondary" size="sm" onClick={openEdit}>Edit settings</Button>
          ) : undefined
        }
      />

      <Card className="max-w-lg divide-y divide-border-subtle">
        {FIELDS.map(f => (
          <div key={f.key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">{f.label}</p>
              <p className="text-xs text-text-muted font-mono">{f.unit}</p>
            </div>
            <span className="text-sm font-mono font-medium text-foreground">{settings[f.key] as number}</span>
          </div>
        ))}
      </Card>

      {!isAdmin && (
        <p className="mt-4 text-xs text-text-muted">Admin access required to edit settings.</p>
      )}

      {isAdmin && permDraft && (
        <div className="mt-8 max-w-lg">
          <h2 className="text-sm font-medium text-foreground mb-1">Approver Access</h2>
          <p className="text-xs text-text-muted mb-4">
            Configure which pages approvers can access. Weekly Report and Monthly Report are always visible to approvers.
          </p>
          <Card className="divide-y divide-border-subtle">
            {PERM_PAGES.map(p => (
              <div key={p.key} className="px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-foreground">{p.label}</p>
                <input
                  type="checkbox"
                  checked={permDraft[p.key]}
                  onChange={e => setPermDraft(d => d ? { ...d, [p.key]: e.target.checked } : d)}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            ))}
          </Card>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleSavePerms} disabled={savingPerms}>
              {savingPerms ? 'Saving…' : 'Save permissions'}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit settings"
        description="Update pipeline targets and approval thresholds."
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {FIELDS.map(f => (
            <FormField key={f.key} label={`${f.label} (${f.unit})`}>
              <Input
                type="number"
                mono
                value={draft[f.key] as number ?? ''}
                onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
              />
            </FormField>
          ))}
        </div>
      </Modal>
    </div>
  )
}
