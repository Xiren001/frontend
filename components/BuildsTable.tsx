'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { PhaseBadge } from './PhaseBadge'
import { formatDate, currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

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
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Build>>({})
  const [adding, setAdding] = useState(false)
  const [newBuild, setNewBuild] = useState<Partial<Build>>({ type, week_number: 1, month_year: currentMonth() + '-01' })

  const weeks = [1, 2, 3, 4]

  function startEdit(b: Build) {
    setEditId(b.id)
    setEditData({ ...b })
  }

  async function saveEdit() {
    if (!editId) return
    await api.put(`/api/builds/${editId}`, editData)
    setEditId(null)
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this build?')) return
    await api.delete(`/api/builds/${id}`)
    onRefresh()
  }

  async function handleAdd() {
    await api.post('/api/builds', newBuild)
    setAdding(false)
    setNewBuild({ type, week_number: 1, month_year: currentMonth() + '-01' })
    onRefresh()
  }

  return (
    <div className="space-y-10">
      {weeks.map(w => {
        const wb = builds.filter(b => b.week_number === w)
        return (
          <div key={w}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-medium text-foreground">Week {w}</h3>
              <Badge variant="muted">{wb.length} build{wb.length !== 1 ? 's' : ''}</Badge>
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
                {wb.map(b => (
                  <TableRow key={b.id}>
                    {editId === b.id ? (
                      <>
                        <TableCell>
                          <Input className="w-44 py-1" value={editData.product_name ?? ''} onChange={e => setEditData(d => ({ ...d, product_name: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Input className="w-20 py-1" value={editData.language ?? ''} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))} />
                        </TableCell>
                        {DATE_FIELDS.map(f => (
                          <TableCell key={f.key}>
                            <Input type="date" className="py-1" value={(editData[f.key] as string) ?? ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value || null }))} />
                          </TableCell>
                        ))}
                        <TableCell>
                          <select className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40" value={editData.outcome ?? ''} onChange={e => setEditData(d => ({ ...d, outcome: (e.target.value as Build['outcome']) || null }))}>
                            <option value="">—</option>
                            <option value="winner">winner</option>
                            <option value="killed">killed</option>
                          </select>
                        </TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="primary" onClick={saveEdit} className="mr-2">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
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
                            <button onClick={() => startEdit(b)} className="text-xs text-text-secondary hover:text-foreground mr-3">Edit</button>
                            <button onClick={() => handleDelete(b.id)} className="text-xs text-danger/70 hover:text-danger">Del</button>
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
                {wb.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-text-muted py-8">
                      No builds in Week {w}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )
      })}

      {isAdmin && (
        <div>
          {!adding ? (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>+ Add build</Button>
          ) : (
            <Card>
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">New build</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Input placeholder="Product name" className="flex-1 min-w-48" value={newBuild.product_name ?? ''} onChange={e => setNewBuild(d => ({ ...d, product_name: e.target.value }))} />
                  <Input placeholder="Language" className="w-28" value={newBuild.language ?? ''} onChange={e => setNewBuild(d => ({ ...d, language: e.target.value }))} />
                  <select className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40" value={newBuild.week_number} onChange={e => setNewBuild(d => ({ ...d, week_number: Number(e.target.value) }))}>
                    {[1,2,3,4].map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-4">
                  {DATE_FIELDS.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-text-muted mb-1">{f.label}</label>
                      <Input type="date" value={(newBuild[f.key] as string) ?? ''} onChange={e => setNewBuild(d => ({ ...d, [f.key]: e.target.value || null }))} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
