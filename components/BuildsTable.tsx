'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { PhaseBadge } from './PhaseBadge'
import { BuildFormModal } from './BuildFormModal'
import { formatDate } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmModal } from '@/components/ui/modal'

const DATE_FIELDS: { key: keyof Build; label: string }[] = [
  { key: 'approved_date',  label: 'Approved' },
  { key: 'phase1_start',   label: 'Phase 1 Start' },
  { key: 'into_proofread', label: 'Into Proofread' },
  { key: 'into_testing',   label: 'Into Testing' },
  { key: 'outcome_decided',label: 'Outcome Decided' },
  { key: 'live_all_geos',  label: 'Live All Geos' },
]

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

  const weeks = [1, 2, 3, 4]
  const weekBuilds = builds.filter(b => b.week_number === activeWeek)

  const tabs = weeks.map(w => ({
    id: w,
    label: `Week ${w}`,
    count: builds.filter(b => b.week_number === w).length,
  }))

  function openCreate() {
    setFormMode('create')
    setEditBuild(null)
    setFormOpen(true)
  }

  function openEdit(b: Build) {
    setFormMode('edit')
    setEditBuild(b)
    setFormOpen(true)
  }

  async function handleSave(data: Partial<Build>) {
    setSaving(true)
    try {
      if (formMode === 'create') {
        await api.post('/api/builds', data)
      } else if (editBuild) {
        await api.put(`/api/builds/${editBuild.id}`, data)
      }
      setFormOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/builds/${deleteId}`)
      setDeleteId(null)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

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

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Product</TableHeader>
            <TableHeader>Lang</TableHeader>
            {DATE_FIELDS.map(f => (
              <TableHeader key={f.key} className="whitespace-nowrap">{f.label}</TableHeader>
            ))}
            <TableHeader>Outcome</TableHeader>
            <TableHeader>Phase</TableHeader>
            <TableHeader className="text-right">Days</TableHeader>
            {isAdmin && <TableHeader />}
          </TableRow>
        </TableHead>
        <TableBody>
          {weekBuilds.map(b => (
            <TableRow key={b.id}>
              <TableCell className="font-medium text-foreground max-w-xs truncate">{b.product_name}</TableCell>
              <TableCell mono>{b.language ?? '—'}</TableCell>
              {DATE_FIELDS.map(f => (
                <TableCell key={f.key} mono className="whitespace-nowrap">{formatDate(b[f.key] as string)}</TableCell>
              ))}
              <TableCell>
                {b.outcome
                  ? <Badge variant={b.outcome === 'winner' ? 'accent' : 'danger'}>{b.outcome}</Badge>
                  : <span className="text-text-muted">—</span>}
              </TableCell>
              <TableCell><PhaseBadge phase={b.phase} /></TableCell>
              <TableCell mono className="text-right text-text-muted">{b.total_days ?? '—'}</TableCell>
              {isAdmin && (
                <TableCell className="text-right whitespace-nowrap">
                  <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright mr-3">QA</Link>
                  <button onClick={() => openEdit(b)} className="text-xs text-text-secondary hover:text-foreground mr-3">Edit</button>
                  <button onClick={() => setDeleteId(b.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {weekBuilds.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-text-muted py-12">
                No builds in Week {activeWeek}
                {isAdmin && (
                  <>
                    {' · '}
                    <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button>
                  </>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
