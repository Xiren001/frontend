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
import { Plus, Trash2, RefreshCw, Copy, Check as CheckIcon, Download, FileText, Send, X } from 'lucide-react'

const PIPELINE_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'build_target_days',  label: 'Build target',          unit: 'days' },
  { key: 'proof_target_days',  label: 'Proofread target',      unit: 'days' },
  { key: 'test_target_days',   label: 'Testing target',        unit: 'days' },
  { key: 'expand_target_days', label: 'Expand target',         unit: 'days' },
  { key: 'total_target_days',  label: 'Total pipeline target', unit: 'days' },
]

const REPORT_TARGET_FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'proofread_turnaround_target_days', label: 'Proofreader turnaround',  unit: 'days' },
  { key: 'web_revision_target_days',         label: 'Web revision',            unit: 'days' },
  { key: 'ads_revision_target_days',         label: 'Ads revision',            unit: 'days' },
  { key: 'en_completion_target_days',        label: 'EN completion',           unit: 'days' },
  { key: 'es_de_translation_target_days',    label: 'ES+DE translation',       unit: 'days' },
  { key: 'total_translation_target_days',    label: 'Total translation cycle', unit: 'days' },
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

interface NotifConfig {
  languages: string[]
  emailMap: Record<string, string[]>
  delayMinutes: number
  pendingCount: Record<string, number>
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

  const [tab, setTab] = useState<'pipeline' | 'roles' | 'notifications' | 'waves' | 'sops'>('pipeline')

  const [languages, setLanguages] = useState<string[]>([])
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm, setUserForm]   = useState(emptyUserForm())
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pwCopied, setPwCopied] = useState(false)

  const [notifConfig, setNotifConfig] = useState<NotifConfig | null>(null)
  const [notifEmailDraft, setNotifEmailDraft] = useState<Record<string, string[]>>({})
  const [notifEmailInput, setNotifEmailInput] = useState<Record<string, string>>({})
  const [notifDelay, setNotifDelay] = useState<number>(1)
  const [notifSending, setNotifSending] = useState<string | null>(null)
  const [notifSaved, setNotifSaved] = useState<string | null>(null)

  const [cronSchedule, setCronSchedule] = useState<{ day: number; hour: number; minute: number; timezone: string } | null>(null)
  const [cronDraft, setCronDraft]       = useState<{ day: number; hour: number; minute: number; timezone: string } | null>(null)
  const [cronSaving, setCronSaving]     = useState(false)
  const [cronSaved,  setCronSaved]      = useState(false)
  const [snapshotTriggering, setSnapshotTriggering] = useState(false)

  const [monthlyCronSchedule, setMonthlyCronSchedule] = useState<{ dayOfMonth: number; hour: number; minute: number; timezone: string } | null>(null)
  const [monthlyCronDraft, setMonthlyCronDraft]       = useState<{ dayOfMonth: number; hour: number; minute: number; timezone: string } | null>(null)
  const [monthlyCronSaving, setMonthlyCronSaving]     = useState(false)
  const [monthlyCronSaved,  setMonthlyCronSaved]      = useState(false)
  const [monthlySnapshotTriggering, setMonthlySnapshotTriggering] = useState(false)

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

  useEffect(() => {
    if (!isAdmin) return
    api.get<NotifConfig>('/api/proof-notifications/config').then(cfg => {
      setNotifConfig(cfg)
      setNotifEmailDraft(cfg.emailMap)
      setNotifDelay(cfg.delayMinutes)
    }).catch(console.error)

    api.get<{ day: number; hour: number; minute: number; timezone: string }>('/api/monday/wave-report-cron')
      .then(s => { setCronSchedule(s); setCronDraft(s) })
      .catch(console.error)

    api.get<{ dayOfMonth: number; hour: number; minute: number; timezone: string }>('/api/monday/wave-report-monthly-cron')
      .then(s => { setMonthlyCronSchedule(s); setMonthlyCronDraft(s) })
      .catch(console.error)
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
    setUserForm({ email: `${lang.toLowerCase()}@faszik.com`, password: generatePassword(), role: `proofreader_${lang.toLowerCase()}` })
    setUserError(null)
    setPwCopied(false)
    setUserModalOpen(true)
  }

  function regeneratePassword() { setUserForm(f => ({ ...f, password: generatePassword() })); setPwCopied(false) }

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

  function roleLabelForLang(lang: string) { return `${lang} Proofreader` }
  function roleKey(lang: string) { return `proofreader_${lang.toLowerCase()}` }
  function notifEmails(lang: string): string[] { return notifEmailDraft[lang] ?? [] }

  function addNotifEmail(lang: string) {
    const val = (notifEmailInput[lang] ?? '').trim()
    if (!val || notifEmails(lang).includes(val)) return
    const updated = [...notifEmails(lang), val]
    setNotifEmailDraft(d => ({ ...d, [lang]: updated }))
    setNotifEmailInput(i => ({ ...i, [lang]: '' }))
    api.put('/api/proof-notifications/emails', { language: lang, emails: updated }).catch(console.error)
  }

  function removeNotifEmail(lang: string, email: string) {
    const updated = notifEmails(lang).filter(e => e !== email)
    setNotifEmailDraft(d => ({ ...d, [lang]: updated }))
    api.put('/api/proof-notifications/emails', { language: lang, emails: updated }).catch(console.error)
  }

  async function saveNotifDelay(val: number) {
    setNotifDelay(val)
    await api.put('/api/proof-notifications/delay', { delayMinutes: val }).catch(console.error)
  }

  async function sendNotifEmails(lang: string) {
    setNotifSending(lang)
    try {
      await api.post('/api/proof-notifications/send', { language: lang })
      setNotifSaved(lang)
      const cfg = await api.get<NotifConfig>('/api/proof-notifications/config')
      setNotifConfig(cfg)
      setNotifEmailDraft(cfg.emailMap)
      setTimeout(() => setNotifSaved(null), 2500)
    } finally { setNotifSending(null) }
  }

  if (!settings) return <p className="text-sm text-text-muted font-mono">Loading…</p>

  const fieldRow = (f: { key: keyof Settings; label: string; unit: string }) => (
    <div key={f.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-foreground">{f.label}</p>
        <p className="text-xs text-text-muted font-mono">{f.unit}</p>
      </div>
      {editing ? (
        <Input
          type="number" mono className="w-24 text-right"
          value={draft[f.key] as number ?? ''}
          onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
        />
      ) : (
        <span className="text-sm font-mono font-medium text-foreground">{settings[f.key] as number}</span>
      )}
    </div>
  )

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const TIMEZONES = [
    'Asia/Manila', 'UTC', 'Europe/Amsterdam', 'America/New_York',
    'America/Los_Angeles', 'America/Chicago', 'Europe/London',
    'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
  ]

  async function saveCronSchedule() {
    if (!cronDraft) return
    setCronSaving(true)
    try {
      await api.put('/api/monday/wave-report-cron', cronDraft)
      setCronSchedule({ ...cronDraft })
      setCronSaved(true)
      setTimeout(() => setCronSaved(false), 2500)
    } finally { setCronSaving(false) }
  }

  async function triggerSnapshotNow() {
    setSnapshotTriggering(true)
    try {
      await api.post('/api/monday/wave-report-snapshot', {})
      alert('Snapshot saved for the current week.')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to trigger snapshot')
    } finally { setSnapshotTriggering(false) }
  }

  async function saveMonthlyCronSchedule() {
    if (!monthlyCronDraft) return
    setMonthlyCronSaving(true)
    try {
      await api.put('/api/monday/wave-report-monthly-cron', monthlyCronDraft)
      setMonthlyCronSchedule({ ...monthlyCronDraft })
      setMonthlyCronSaved(true)
      setTimeout(() => setMonthlyCronSaved(false), 2500)
    } finally { setMonthlyCronSaving(false) }
  }

  async function triggerMonthlySnapshotNow() {
    setMonthlySnapshotTriggering(true)
    try {
      await api.post('/api/monday/wave-report-monthly-snapshot', {})
      alert('Snapshot saved for the current month.')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to trigger snapshot')
    } finally { setMonthlySnapshotTriggering(false) }
  }

  type Tab = 'pipeline' | 'roles' | 'notifications' | 'waves' | 'sops'
  const allTabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'pipeline',      label: 'Pipeline'      },
    { id: 'roles',         label: 'Language Roles', adminOnly: true },
    { id: 'notifications', label: 'Notifications',  adminOnly: true },
    { id: 'waves',         label: 'Waves Report',   adminOnly: true },
    { id: 'sops',          label: 'SOPs'          },
  ]
  const visibleTabs = allTabs.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title="Settings" description="Pipeline targets, users, notifications, and resources." />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border-subtle mt-6 mb-6">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px border-b-2',
              tab === t.id
                ? 'text-foreground border-foreground'
                : 'text-text-muted border-transparent hover:text-text-secondary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div>

        {/* Pipeline */}
        {tab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Targets and thresholds that drive KPI colours.</p>
              {isAdmin && !editing && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="divide-y divide-border-subtle">
                <div className="px-5 py-2.5">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Pipeline Targets</p>
                </div>
                {PIPELINE_FIELDS.map(fieldRow)}
              </Card>
              <Card className="divide-y divide-border-subtle">
                <div className="px-5 py-2.5">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Report Targets</p>
                </div>
                {REPORT_TARGET_FIELDS.map(fieldRow)}
              </Card>
              <Card className="divide-y divide-border-subtle">
                <div className="px-5 py-2.5">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Approval Thresholds</p>
                </div>
                {THRESHOLD_FIELDS.map(fieldRow)}
              </Card>
            </div>

            {editing && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            )}
            {!isAdmin && <p className="text-xs text-text-muted">Admin access required to edit settings.</p>}
          </div>
        )}

        {/* Language Roles */}
        {tab === 'roles' && isAdmin && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">One proofreader role per language. Users in a language role see only that language&apos;s products.</p>
            <Card className="divide-y divide-border-subtle">
              {languages.length === 0 ? (
                <p className="px-5 py-6 text-sm text-text-muted text-center">No languages found. Add products to the proofreading module first.</p>
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
                              <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface text-sm">
                                <span className="text-text-secondary truncate">{u.email}</span>
                                {deleteConfirm === u.id ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-text-muted">Delete?</span>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-xs text-danger hover:text-danger/80 font-medium">Yes</button>
                                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-text-muted hover:text-foreground">No</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirm(u.id)} className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0">
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

        {/* Notifications */}
        {tab === 'notifications' && isAdmin && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Email alerts when products enter the proofreading queue. Sent automatically after the delay.</p>

            <Card>
              <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">Send delay</p>
                  <p className="text-xs text-text-muted font-mono">minutes after product is queued</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" mono className="w-20 text-right"
                    value={notifDelay} min={0}
                    onChange={e => setNotifDelay(Number(e.target.value))}
                    onBlur={e => saveNotifDelay(Number(e.target.value))}
                  />
                  <span className="text-sm text-text-muted shrink-0">min</span>
                </div>
              </div>
            </Card>

            {!notifConfig ? (
              <p className="text-sm text-text-muted font-mono">Loading…</p>
            ) : notifConfig.languages.length === 0 ? (
              <Card><p className="px-5 py-6 text-sm text-text-muted text-center">No languages in the proofreading queue yet.</p></Card>
            ) : (
              <Card className="divide-y divide-border-subtle">
                {notifConfig.languages.map(lang => {
                  const pending   = notifConfig.pendingCount[lang] ?? 0
                  const emails    = notifEmails(lang)
                  const isSending = notifSending === lang
                  const isSent    = notifSaved === lang
                  const canSend   = pending > 0 && emails.length > 0 && !isSending
                  return (
                    <div key={lang} className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Badge variant="accent">{lang}</Badge>
                          {pending > 0
                            ? <span className="text-xs font-mono text-amber-500 font-medium">{pending} pending</span>
                            : <span className="text-xs text-text-muted font-mono">0 pending</span>
                          }
                        </div>
                        <Button size="sm" variant={canSend ? 'primary' : 'secondary'} disabled={!canSend} onClick={() => sendNotifEmails(lang)}>
                          {isSent
                            ? <><CheckIcon className="h-3.5 w-3.5 mr-1.5" />Sent</>
                            : <><Send className="h-3.5 w-3.5 mr-1.5" />{isSending ? 'Sending…' : 'Send now'}</>
                          }
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {emails.map(email => (
                          <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-surface-elevated border border-border text-text-secondary">
                            {email}
                            <button onClick={() => removeNotifEmail(lang, email)} className="text-text-muted hover:text-danger transition-colors ml-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="email" placeholder="Add email address…"
                          value={notifEmailInput[lang] ?? ''}
                          onChange={e => setNotifEmailInput(i => ({ ...i, [lang]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNotifEmail(lang) } }}
                          className="text-sm"
                        />
                        <Button size="sm" variant="secondary" onClick={() => addNotifEmail(lang)} disabled={!(notifEmailInput[lang] ?? '').trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </Card>
            )}
          </div>
        )}

        {/* Waves Report */}
        {tab === 'waves' && isAdmin && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Configure the automatic weekly snapshot schedule for the Waves Report.</p>

            {!cronDraft ? (
              <p className="text-sm text-text-muted font-mono">Loading…</p>
            ) : (
              <>
                <Card className="divide-y divide-border-subtle">
                  <div className="px-5 py-2.5">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Snapshot Schedule</p>
                  </div>

                  {/* Day of week */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Day of week</p>
                      <p className="text-xs text-text-muted font-mono">when the snapshot runs</p>
                    </div>
                    <select
                      value={cronDraft.day}
                      onChange={e => setCronDraft(d => d ? { ...d, day: Number(e.target.value) } : d)}
                      className="h-9 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    >
                      {DAY_NAMES.map((name, i) => (
                        <option key={i} value={i}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Time */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Time</p>
                      <p className="text-xs text-text-muted font-mono">hour : minute (24h)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" mono className="w-16 text-center"
                        min={0} max={23}
                        value={cronDraft.hour}
                        onChange={e => setCronDraft(d => d ? { ...d, hour: Math.min(23, Math.max(0, Number(e.target.value))) } : d)}
                      />
                      <span className="text-text-muted font-mono">:</span>
                      <Input
                        type="number" mono className="w-16 text-center"
                        min={0} max={59}
                        value={cronDraft.minute}
                        onChange={e => setCronDraft(d => d ? { ...d, minute: Math.min(59, Math.max(0, Number(e.target.value))) } : d)}
                      />
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Timezone</p>
                      <p className="text-xs text-text-muted font-mono">IANA timezone</p>
                    </div>
                    <select
                      value={cronDraft.timezone}
                      onChange={e => setCronDraft(d => d ? { ...d, timezone: e.target.value } : d)}
                      className="h-9 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Current value summary */}
                  {cronSchedule && (
                    <div className="px-5 py-3 bg-surface-page">
                      <p className="text-xs text-text-muted">
                        Currently set to: <span className="font-mono text-foreground">
                          {DAY_NAMES[cronSchedule.day]} at {String(cronSchedule.hour).padStart(2, '0')}:{String(cronSchedule.minute).padStart(2, '0')} ({cronSchedule.timezone})
                        </span>
                      </p>
                    </div>
                  )}
                </Card>

                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="secondary" size="sm"
                    onClick={triggerSnapshotNow}
                    disabled={snapshotTriggering}
                  >
                    {snapshotTriggering ? 'Saving…' : 'Save snapshot now'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveCronSchedule}
                    disabled={cronSaving}
                  >
                    {cronSaved ? 'Saved ✓' : cronSaving ? 'Saving…' : 'Save schedule'}
                  </Button>
                </div>
              </>
            )}

            <div className="pt-2">
              <p className="text-xs text-text-muted">Configure the automatic monthly snapshot schedule for the Waves Report.</p>
            </div>

            {!monthlyCronDraft ? (
              <p className="text-sm text-text-muted font-mono">Loading…</p>
            ) : (
              <>
                <Card className="divide-y divide-border-subtle">
                  <div className="px-5 py-2.5">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Monthly Snapshot Schedule</p>
                  </div>

                  {/* Day of month */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Day of month</p>
                      <p className="text-xs text-text-muted font-mono">when the snapshot runs (1–28)</p>
                    </div>
                    <select
                      value={monthlyCronDraft.dayOfMonth}
                      onChange={e => setMonthlyCronDraft(d => d ? { ...d, dayOfMonth: Number(e.target.value) } : d)}
                      className="h-9 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Time */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Time</p>
                      <p className="text-xs text-text-muted font-mono">hour : minute (24h)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" mono className="w-16 text-center"
                        min={0} max={23}
                        value={monthlyCronDraft.hour}
                        onChange={e => setMonthlyCronDraft(d => d ? { ...d, hour: Math.min(23, Math.max(0, Number(e.target.value))) } : d)}
                      />
                      <span className="text-text-muted font-mono">:</span>
                      <Input
                        type="number" mono className="w-16 text-center"
                        min={0} max={59}
                        value={monthlyCronDraft.minute}
                        onChange={e => setMonthlyCronDraft(d => d ? { ...d, minute: Math.min(59, Math.max(0, Number(e.target.value))) } : d)}
                      />
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-foreground">Timezone</p>
                      <p className="text-xs text-text-muted font-mono">IANA timezone</p>
                    </div>
                    <select
                      value={monthlyCronDraft.timezone}
                      onChange={e => setMonthlyCronDraft(d => d ? { ...d, timezone: e.target.value } : d)}
                      className="h-9 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Current value summary */}
                  {monthlyCronSchedule && (
                    <div className="px-5 py-3 bg-surface-page">
                      <p className="text-xs text-text-muted">
                        Currently set to: <span className="font-mono text-foreground">
                          Day {monthlyCronSchedule.dayOfMonth} at {String(monthlyCronSchedule.hour).padStart(2, '0')}:{String(monthlyCronSchedule.minute).padStart(2, '0')} ({monthlyCronSchedule.timezone})
                        </span>
                      </p>
                    </div>
                  )}
                </Card>

                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="secondary" size="sm"
                    onClick={triggerMonthlySnapshotNow}
                    disabled={monthlySnapshotTriggering}
                  >
                    {monthlySnapshotTriggering ? 'Saving…' : 'Save snapshot now'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveMonthlyCronSchedule}
                    disabled={monthlyCronSaving}
                  >
                    {monthlyCronSaved ? 'Saved ✓' : monthlyCronSaving ? 'Saving…' : 'Save schedule'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* SOPs */}
        {tab === 'sops' && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Download SOPs for each team. Open the file in any browser.</p>
            <Card className="divide-y divide-border-subtle">
              {[
                { href: '/sop-management.html', label: 'Management SOP',  description: 'Proofreader payments, queue monitoring, and tracker overview', color: 'text-[#059669]', bg: 'bg-[#d1fae5]' },
                { href: '/sop-proofreader.html',label: 'Proofreader SOP', description: 'Log corrections and mark ready in the Proofreading module',   color: 'text-[#5b4aff]', bg: 'bg-[#ede9ff]' },
                { href: '/sop-web.html',         label: 'Web Team SOP',   description: 'Add product links and apply website corrections in Proofreading',color: 'text-[#0ea5e9]', bg: 'bg-[#e0f2fe]' },
                { href: '/sop-ads.html',         label: 'Ads Team SOP',   description: 'Apply ad copy corrections in the Proofreading module',          color: 'text-[#e85d04]', bg: 'bg-[#fef3e2]' },
              ].map(sop => (
                <div key={sop.href} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg shrink-0', sop.bg)}>
                      <FileText className={cn('h-4 w-4', sop.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{sop.label}</p>
                      <p className="text-xs text-text-muted truncate">{sop.description}</p>
                    </div>
                  </div>
                  <a
                    href={sop.href} download
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-surface-elevated border border-border text-text-secondary hover:text-foreground hover:bg-surface-hover shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              ))}
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
            <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Password">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Input type="text" mono value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
              </div>
              <button type="button" onClick={regeneratePassword} title="Generate new password" className="shrink-0 p-2 rounded-md border border-border text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button" onClick={copyPassword} title="Copy password"
                className={cn('shrink-0 p-2 rounded-md border transition-colors', pwCopied ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-border text-text-muted hover:text-foreground hover:bg-surface-hover')}
              >
                {pwCopied ? <CheckIcon className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Role">
            <p className="text-sm font-mono text-text-secondary px-3 py-2 rounded-md bg-surface border border-border">{userForm.role}</p>
          </FormField>
          {userError && <p className="text-sm text-danger">{userError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setUserModalOpen(false)} disabled={userSaving}>Cancel</Button>
            <Button size="sm" onClick={handleCreateUser} disabled={userSaving}>{userSaving ? 'Creating…' : 'Create user'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
