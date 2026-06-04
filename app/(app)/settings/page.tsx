'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings, ApproverPermissions, ViewerPermissions } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'

const PIPELINE_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'build_target_days',  label: 'Build target',          unit: 'days' },
  { key: 'proof_target_days',  label: 'Proofread target',      unit: 'days' },
  { key: 'test_target_days',   label: 'Testing target',        unit: 'days' },
  { key: 'expand_target_days', label: 'Expand target',         unit: 'days' },
  { key: 'total_target_days',  label: 'Total pipeline target', unit: 'days' },
]

const THRESHOLD_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'tool_approval_threshold',    label: 'Tool approval threshold',     unit: '$/mo' },
  { key: 'payment_approval_threshold', label: 'Payment method approval',     unit: '$'    },
]

const PERM_PAGES: { key: keyof ApproverPermissions; label: string }[] = [
  { key: 'dashboard',       label: 'Dashboard'              },
  { key: 'jewelry_tracker', label: 'Jewelry Tracker'        },
  { key: 'funnel_tracker',  label: 'Funnel Tracker'         },
  { key: 'proofread_queue', label: 'Proofread Queue'        },
  { key: 'mistake_log',     label: 'Mistake Log'            },
  { key: 'monthly_planner', label: 'Monthly Planner'        },
  { key: 'decision_rights', label: 'Decision Rights'        },
  { key: 'settings',        label: 'Settings (view only)'   },
]

const ACCESS_TABS = [
  { id: 'approver', label: 'Approver' },
  { id: 'viewer',   label: 'Viewer'   },
]

const EMPTY_PERMS: ViewerPermissions = {
  dashboard: false, jewelry_tracker: false, funnel_tracker: false,
  proofread_queue: false, mistake_log: false, monthly_planner: false,
  decision_rights: false, settings: false,
}

export default function SettingsPage() {
  const [settings, setSettings]       = useState<Settings | null>(null)
  const [draft, setDraft]             = useState<Partial<Settings>>({})
  const [isAdmin, setIsAdmin]         = useState(false)
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [permDraft, setPermDraft]     = useState<ApproverPermissions | null>(null)
  const [viewerDraft, setViewerDraft] = useState<ViewerPermissions>(EMPTY_PERMS)
  const [activeTab, setActiveTab]     = useState<string | number>('approver')
  const [savingPerms, setSavingPerms] = useState(false)

  function applySettings(s: Settings) {
    setSettings(s)
    setDraft(s)
    if (s.approver_permissions) setPermDraft(s.approver_permissions)
    setViewerDraft(s.viewer_permissions ?? EMPTY_PERMS)
  }

  function loadSettings() {
    api.get<Settings>('/api/settings').then(applySettings).catch(console.error)
  }

  useRealtimeRefresh('settings', loadSettings)

  useEffect(() => {
    loadSettings()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [])

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
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePerms() {
    setSavingPerms(true)
    try {
      const body = activeTab === 'approver'
        ? { approver_permissions: permDraft }
        : { viewer_permissions: viewerDraft }
      const updated = await api.put<Settings>('/api/settings', body)
      applySettings(updated)
    } finally {
      setSavingPerms(false)
    }
  }

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Pipeline targets, approval thresholds, and role access."
      />

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Pipeline Settings ── */}
        <div>
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

        {/* ── Access Control ── */}
        {isAdmin && (
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-medium text-foreground">Access Control</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Configure page access per role. Weekly Report and Monthly Report are always visible.
              </p>
            </div>

            <Card>
              <div className="px-5 pt-1">
                <Tabs tabs={ACCESS_TABS} active={activeTab} onChange={setActiveTab} />
              </div>

              <div className="divide-y divide-border-subtle">
                {PERM_PAGES.map(p => {
                  const checked = activeTab === 'approver'
                    ? (permDraft?.[p.key] ?? false)
                    : viewerDraft[p.key]
                  return (
                    <div key={p.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <p className="text-sm text-foreground">{p.label}</p>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (activeTab === 'approver') {
                            setPermDraft(d => d ? { ...d, [p.key]: e.target.checked } : d)
                          } else {
                            setViewerDraft(d => ({ ...d, [p.key]: e.target.checked }))
                          }
                        }}
                        className="h-4 w-4 accent-accent cursor-pointer"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="px-5 py-3.5 border-t border-border-subtle flex justify-end">
                <Button size="sm" onClick={handleSavePerms} disabled={savingPerms}>
                  {savingPerms ? 'Saving…' : 'Save access'}
                </Button>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  )
}
