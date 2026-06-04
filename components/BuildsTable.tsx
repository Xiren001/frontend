'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { BuildFormModal } from './BuildFormModal'
import { formatDate } from '@/lib/utils'
import type { Build, BuildOutcome, BuildType, Settings } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmModal } from '@/components/ui/modal'

const PHASE_FIELDS: {
  key: keyof Build
  label: string
  status: string
  variant: 'default' | 'warn' | 'accent' | 'muted'
}[] = [
  { key: 'phase1_start',    label: 'Phase 1',   status: 'Building',     variant: 'default' },
  { key: 'into_proofread',  label: 'Proofread', status: 'Proofreading', variant: 'warn'    },
  { key: 'into_testing',    label: 'Testing',   status: 'Testing',      variant: 'default' },
  { key: 'outcome_decided', label: 'Decided',   status: 'Decided',      variant: 'accent'  },
]

const OUTCOME_VARIANT: Record<NonNullable<BuildOutcome>, 'accent' | 'warn' | 'danger'> = {
  expanding: 'accent',
  testing:   'warn',
  stopped:   'danger',
}

const PHASE_BTN: Record<string, string> = {
  default: 'text-text-secondary border-border hover:border-text-secondary bg-surface-elevated/60',
  warn:    'text-yellow-500 border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/5',
  accent:  'text-accent border-accent/30 hover:border-accent/60 bg-accent-muted/20',
  muted:   'text-text-muted border-border-subtle',
}

function avgNum(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}

function statColor(val: number | null, target: number): string {
  if (val === null) return 'text-text-muted'
  if (val <= target) return 'text-accent'
  if (val <= target * 1.3) return 'text-yellow-500'
  return 'text-danger'
}

function getNextPhaseKey(b: Build): keyof Build | null {
  for (const { key } of PHASE_FIELDS) {
    if (!b[key]) return key
  }
  return null
}

interface Props {
  builds: Build[]
  type: BuildType
  onRefresh: () => void
  isAdmin: boolean
}

export function BuildsTable({ builds, type, onRefresh, isAdmin }: Props) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editBuild, setEditBuild] = useState<Build | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    api.get<Settings>('/api/settings').then(setSettings).catch(() => {})
  }, [])

  const weeks = [1, 2, 3, 4]
  const weekBuilds = builds.filter(b => b.week_number === activeWeek)

  const buildAvg = avgNum(weekBuilds.map(b => b.build_days))
  const proofAvg = avgNum(weekBuilds.map(b => b.proof_days))
  const testAvg  = avgNum(weekBuilds.map(b => b.test_days))
  const totalAvg = avgNum(weekBuilds.map(b => b.total_days))

  const tabs = weeks.map(w => ({
    id: w,
    label: `Week ${w}`,
    count: builds.filter(b => b.week_number === w).length,
  }))

  function openCreate() { setFormMode('create'); setEditBuild(null); setFormOpen(true) }
  function openEdit(b: Build) { setFormMode('edit'); setEditBuild(b); setFormOpen(true) }

  async function handleSave(data: Partial<Build>) {
    setSaving(true)
    try {
      if (formMode === 'create') await api.post('/api/builds', data)
      else if (editBuild) await api.put(`/api/builds/${editBuild.id}`, data)
      setFormOpen(false)
      onRefresh()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/builds/${deleteId}`)
      setDeleteId(null)
      onRefresh()
    } finally { setDeleting(false) }
  }

  async function handlePhaseSet(buildId: string, field: keyof Build) {
    const advKey = buildId + String(field)
    setAdvancing(advKey)
    const today = new Date().toISOString().split('T')[0]
    try {
      await api.put(`/api/builds/${buildId}`, { [field]: today })
      onRefresh()
    } finally { setAdvancing(null) }
  }

  async function handlePhaseClear(buildId: string, field: keyof Build) {
    const advKey = buildId + String(field)
    setAdvancing(advKey)
    const idx = PHASE_FIELDS.findIndex(f => f.key === field)
    const update: Record<string, null> = {}
    for (let i = idx; i < PHASE_FIELDS.length; i++) {
      update[PHASE_FIELDS[i].key as string] = null
    }
    try {
      await api.put(`/api/builds/${buildId}`, update)
      onRefresh()
    } finally { setAdvancing(null) }
  }

  async function handleOutcomeChange(buildId: string, outcome: BuildOutcome) {
    await api.put(`/api/builds/${buildId}`, { outcome })
    onRefresh()
  }

  // total col count for empty-state colspan
  const colCount = 3 + PHASE_FIELDS.length + 1 + 4 + (isAdmin ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Tabs tabs={tabs} active={activeWeek} onChange={id => setActiveWeek(Number(id))} className="flex-1" />
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={openCreate} className="shrink-0">
            + Add build
          </Button>
        )}
      </div>

      <div className="flex items-start" style={{ gap: '0.25rem' }}>
        {/* ── Main tracker table ── */}
        <div className="flex-1 overflow-x-auto min-w-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Product</TableHeader>
                <TableHeader>Lang</TableHeader>
                <TableHeader>Approved</TableHeader>
                {PHASE_FIELDS.map(f => (
                  <TableHeader key={f.key as string} className="whitespace-nowrap">{f.label}</TableHeader>
                ))}
                <TableHeader>Outcome</TableHeader>
                <TableHeader className="text-right whitespace-nowrap">Build d</TableHeader>
                <TableHeader className="text-right whitespace-nowrap">Proof d</TableHeader>
                <TableHeader className="text-right whitespace-nowrap">Test d</TableHeader>
                <TableHeader className="text-right whitespace-nowrap">Total d</TableHeader>
                {isAdmin && <TableHeader />}
              </TableRow>
            </TableHead>
            <TableBody>
              {weekBuilds.map(b => {
                const nextPhaseKey = getNextPhaseKey(b)
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-foreground max-w-xs truncate">{b.product_name}</TableCell>
                    <TableCell mono>{b.language ?? '—'}</TableCell>
                    <TableCell mono className="whitespace-nowrap">{formatDate(b.approved_date)}</TableCell>

                    {PHASE_FIELDS.map(f => {
                      const val = b[f.key] as string | null
                      const advKey = b.id + String(f.key)
                      const isBusy = advancing === advKey

                      if (val) {
                        return (
                          <TableCell key={f.key as string} className="whitespace-nowrap">
                            {isAdmin && (
                              <button
                                onClick={() => handlePhaseClear(b.id, f.key)}
                                disabled={isBusy}
                                title="Return to previous phase"
                                className="mr-1.5 text-danger hover:text-red-400 font-bold text-sm leading-none align-middle disabled:opacity-40 transition-colors"
                              >
                                ←
                              </button>
                            )}
                            <span className="font-mono text-xs text-foreground">{formatDate(val)}</span>
                          </TableCell>
                        )
                      }

                      if (isAdmin && nextPhaseKey === f.key) {
                        return (
                          <TableCell key={f.key as string}>
                            <button
                              onClick={() => handlePhaseSet(b.id, f.key)}
                              disabled={isBusy}
                              className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${PHASE_BTN[f.variant]}`}
                            >
                              {isBusy ? '…' : `${f.status} →`}
                            </button>
                          </TableCell>
                        )
                      }

                      return <TableCell key={f.key as string} className="text-text-muted">—</TableCell>
                    })}

                    {/* Inline outcome */}
                    <TableCell>
                      {isAdmin ? (
                        <select
                          value={b.outcome ?? ''}
                          onChange={e => handleOutcomeChange(b.id, (e.target.value as BuildOutcome) || null)}
                          className="text-xs bg-surface-elevated border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
                        >
                          <option value="">—</option>
                          <option value="stopped">Stopped</option>
                          <option value="testing">Testing</option>
                          <option value="expanding">Expanding</option>
                        </select>
                      ) : b.outcome ? (
                        <Badge variant={OUTCOME_VARIANT[b.outcome]}>{b.outcome}</Badge>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>

                    {/* 4 days columns */}
                    <TableCell mono className="text-right text-text-muted">{b.build_days ?? '—'}</TableCell>
                    <TableCell mono className="text-right text-text-muted">{b.proof_days ?? '—'}</TableCell>
                    <TableCell mono className="text-right text-text-muted">{b.test_days  ?? '—'}</TableCell>
                    <TableCell mono className="text-right text-text-muted">{b.total_days ?? '—'}</TableCell>

                    {isAdmin && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright mr-3">QA</Link>
                        <button onClick={() => openEdit(b)} className="text-xs text-text-secondary hover:text-foreground mr-3">Edit</button>
                        <button onClick={() => setDeleteId(b.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {weekBuilds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center text-text-muted py-12">
                    No builds in Week {activeWeek}
                    {isAdmin && (
                      <> · <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button></>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Stats table ── */}
        <div className="shrink-0 w-44 text-xs border border-border-subtle rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface border-b border-border-subtle">
                <th className="text-left px-3 py-2 text-text-muted font-medium">Phase</th>
                <th className="text-right px-3 py-2 text-text-muted font-medium">Wk avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="px-3 py-2 text-text-secondary">Building</td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${settings ? statColor(buildAvg, settings.build_target_days) : 'text-foreground'}`}>
                  {buildAvg !== null ? `${buildAvg}d` : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-text-secondary">Proofread</td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${settings ? statColor(proofAvg, settings.proof_target_days) : 'text-foreground'}`}>
                  {proofAvg !== null ? `${proofAvg}d` : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-text-secondary">Testing</td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${settings ? statColor(testAvg, settings.test_target_days) : 'text-foreground'}`}>
                  {testAvg !== null ? `${testAvg}d` : '—'}
                </td>
              </tr>
              <tr className="border-t-2 border-border">
                <td className="px-3 py-2 text-text-secondary font-medium">Total</td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${settings ? statColor(totalAvg, settings.total_target_days) : 'text-foreground'}`}>
                  {totalAvg !== null ? `${totalAvg}d` : '—'}
                </td>
              </tr>

              {settings && (
                <>
                  <tr className="bg-surface-elevated">
                    <td colSpan={2} className="px-3 py-1.5 text-text-muted text-[10px] uppercase tracking-wider font-medium">
                      Target
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-text-muted">Building</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{settings.build_target_days}d</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-text-muted">Proofread</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{settings.proof_target_days}d</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-text-muted">Testing</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{settings.test_target_days}d</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-text-muted">Total</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{settings.total_target_days}d</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BuildFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        type={type}
        mode={formMode}
        initial={editBuild ?? undefined}
        defaultWeek={activeWeek}
        saving={saving}
      />

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete build"
        message="This build and its QA checklist will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
