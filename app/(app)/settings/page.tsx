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
import { Modal, FormField } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Plus, Trash2, RefreshCw, Copy, Check as CheckIcon } from 'lucide-react'

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

interface AdminUser {
  id: string
  email: string
  role: string
  created_at: string
}

function emptyUserForm() {
  return { email: '', password: '', role: '' }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft]       = useState<Partial<Settings>>({})
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const { role } = useRole()
  const isAdmin = role === 'admin'

  // Language roles state
  const [languages, setLanguages] = useState<string[]>([])
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm, setUserForm]   = useState(emptyUserForm())
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pwCopied, setPwCopied] = useState(false)

  function applySettings(s: Settings) { setSettings(s); setDraft(s) }
  function loadSettings() {
    api.get<Settings>('/api/settings').then(applySettings).catch(console.error)
  }

  useRealtimeRefresh('settings', loadSettings)
  useEffect(() => { loadSettings() }, [])

  useEffect(() => {
    if (!isAdmin) return
    api.get<string[]>('/api/admin/users/languages').then(setLanguages).catch(console.error)
    api.get<AdminUser[]>('/api/admin/users/users').then(setUsers).catch(console.error)
  }, [isAdmin])

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

  function generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghjkmnpqrstuvwxyz'
    const digits = '23456789'
    const special = '!@#$%&*'
    const all = upper + lower + digits + special
    const arr = new Uint8Array(14)
    crypto.getRandomValues(arr)
    let pw = upper[arr[0] % upper.length] + lower[arr[1] % lower.length]
      + digits[arr[2] % digits.length] + special[arr[3] % special.length]
    for (let i = 4; i < 14; i++) pw += all[arr[i] % all.length]
    return pw.split('').sort(() => Math.random() - 0.5).join('')
  }

  function openCreateUser(lang: string) {
    setUserForm({
      email: `${lang.toLowerCase()}@faszik.com`,
      password: generatePassword(),
      role: `proofreader_${lang.toLowerCase()}`,
    })
    setUserError(null)
    setPwCopied(false)
    setUserModalOpen(true)
  }

  function regeneratePassword() {
    setUserForm(f => ({ ...f, password: generatePassword() }))
    setPwCopied(false)
  }

  function copyPassword() {
    navigator.clipboard.writeText(userForm.password)
    setPwCopied(true)
    setTimeout(() => setPwCopied(false), 2000)
  }

  async function handleCreateUser() {
    setUserSaving(true)
    setUserError(null)
    try {
      const created = await api.post<AdminUser>('/api/admin/users/users', userForm)
      setUsers(u => [...u, created])
      setUserModalOpen(false)
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : 'Failed to create user')
    } finally { setUserSaving(false) }
  }

  async function handleDeleteUser(id: string) {
    try {
      await api.delete(`/api/admin/users/users/${id}`)
      setUsers(u => u.filter(x => x.id !== id))
    } catch { /* ignore */ }
    setDeleteConfirm(null)
  }

  function roleLabelForLang(lang: string) {
    return `${lang} Proofreader`
  }

  function roleKey(lang: string) {
    return `proofreader_${lang.toLowerCase()}`
  }

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Pipeline targets and approval thresholds."
      />

      <div className="mt-6 max-w-lg space-y-8">
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

        {/* ── Language Roles (admin only) ── */}
        {isAdmin && (
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-medium text-foreground">Language Roles</h2>
              <p className="text-xs text-text-muted mt-0.5">
                One proofreader role per language. Users in a language role see only that language&apos;s products.
              </p>
            </div>

            <Card className="divide-y divide-border-subtle">
              {languages.length === 0 ? (
                <p className="px-5 py-6 text-sm text-text-muted text-center">
                  No languages found. Add products to the proofreading module first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 px-5 py-2.5 gap-4">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Role</p>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Language</p>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider text-right">Users</p>
                  </div>
                  {languages.map(lang => {
                    const key = roleKey(lang)
                    const langUsers = users.filter(u => u.role === key)
                    return (
                      <div key={lang}>
                        <div className="grid grid-cols-3 px-5 py-3.5 gap-4 items-center">
                          <p className="text-sm text-foreground font-medium">{roleLabelForLang(lang)}</p>
                          <Badge variant="accent">{lang}</Badge>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-mono text-text-muted">{langUsers.length}</span>
                            <button
                              onClick={() => openCreateUser(lang)}
                              className="p-1.5 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                              title={`Add ${roleLabelForLang(lang)} user`}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {langUsers.length > 0 && (
                          <div className="px-5 pb-3 space-y-1">
                            {langUsers.map(u => (
                              <div key={u.id} className={cn(
                                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg',
                                'bg-surface text-sm',
                              )}>
                                <span className="text-text-secondary truncate">{u.email}</span>
                                {deleteConfirm === u.id ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-text-muted">Delete?</span>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="text-xs text-danger hover:text-danger/80 font-medium"
                                    >Yes</button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="text-xs text-text-muted hover:text-foreground"
                                    >No</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(u.id)}
                                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Create user modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={`Create ${userForm.role ? userForm.role.replace('proofreader_', '').toUpperCase() + ' Proofreader' : 'User'}`}
      >
        <div className="space-y-4">
          <FormField label="Email">
            <Input
              type="email"
              value={userForm.email}
              onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Password">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Input
                  type="text"
                  mono
                  value={userForm.password}
                  onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
              </div>
              <button
                type="button"
                onClick={regeneratePassword}
                title="Generate new password"
                className="shrink-0 p-2 rounded-md border border-border text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={copyPassword}
                title="Copy password"
                className={cn(
                  'shrink-0 p-2 rounded-md border transition-colors',
                  pwCopied
                    ? 'border-green-500/40 text-green-400 bg-green-500/10'
                    : 'border-border text-text-muted hover:text-foreground hover:bg-surface-hover',
                )}
              >
                {pwCopied ? <CheckIcon className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Role">
            <p className="text-sm font-mono text-text-secondary px-3 py-2 rounded-md bg-surface border border-border">
              {userForm.role}
            </p>
          </FormField>
          {userError && <p className="text-sm text-danger">{userError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setUserModalOpen(false)} disabled={userSaving}>Cancel</Button>
            <Button size="sm" onClick={handleCreateUser} disabled={userSaving}>
              {userSaving ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
