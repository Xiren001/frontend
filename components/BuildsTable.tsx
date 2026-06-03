'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { PhaseBadge } from './PhaseBadge'
import { formatDate, currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import Link from 'next/link'

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
    <div className="space-y-8">
      {weeks.map(w => {
        const wb = builds.filter(b => b.week_number === w)
        return (
          <div key={w}>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Week {w} — {wb.length} build{wb.length !== 1 ? 's' : ''}</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Product</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Lang</th>
                    {DATE_FIELDS.map(f => (
                      <th key={f.key} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Outcome</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Phase</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Days</th>
                    {isAdmin && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {wb.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      {editId === b.id ? (
                        <>
                          <td className="px-3 py-1.5">
                            <input className="border rounded px-1 py-0.5 w-44" value={editData.product_name ?? ''} onChange={e => setEditData(d => ({ ...d, product_name: e.target.value }))} />
                          </td>
                          <td className="px-3 py-1.5">
                            <input className="border rounded px-1 py-0.5 w-20" value={editData.language ?? ''} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))} />
                          </td>
                          {DATE_FIELDS.map(f => (
                            <td key={f.key} className="px-3 py-1.5">
                              <input type="date" className="border rounded px-1 py-0.5" value={(editData[f.key] as string) ?? ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value || null }))} />
                            </td>
                          ))}
                          <td className="px-3 py-1.5">
                            <select className="border rounded px-1 py-0.5" value={editData.outcome ?? ''} onChange={e => setEditData(d => ({ ...d, outcome: (e.target.value as Build['outcome']) || null }))}>
                              <option value="">—</option>
                              <option value="winner">winner</option>
                              <option value="killed">killed</option>
                            </select>
                          </td>
                          <td colSpan={2} />
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <button onClick={saveEdit} className="text-xs text-blue-600 hover:underline mr-2">Save</button>
                            <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-medium max-w-xs truncate">{b.product_name}</td>
                          <td className="px-3 py-2 text-gray-500">{b.language ?? '—'}</td>
                          {DATE_FIELDS.map(f => (
                            <td key={f.key} className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(b[f.key] as string)}</td>
                          ))}
                          <td className="px-3 py-2">{b.outcome ? <span className={b.outcome === 'winner' ? 'text-green-600 font-medium' : 'text-red-500'}>{b.outcome}</span> : '—'}</td>
                          <td className="px-3 py-2"><PhaseBadge phase={b.phase} /></td>
                          <td className="px-3 py-2 text-right text-gray-400">{b.total_days ?? '—'}</td>
                          {isAdmin && (
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <Link href={`/qa-checklist/${b.id}`} className="text-xs text-indigo-500 hover:underline mr-2">QA</Link>
                              <button onClick={() => startEdit(b)} className="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                              <button onClick={() => handleDelete(b.id)} className="text-xs text-red-400 hover:underline">Del</button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                  {wb.length === 0 && (
                    <tr><td colSpan={12} className="px-3 py-4 text-center text-gray-400">No builds in Week {w}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {isAdmin && (
        <div>
          {!adding ? (
            <button onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline">+ Add build</button>
          ) : (
            <div className="rounded-lg border border-gray-200 p-4 bg-white space-y-3">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">New build</p>
              <div className="flex flex-wrap gap-3">
                <input placeholder="Product name" className="border rounded px-2 py-1 text-sm flex-1 min-w-48" value={newBuild.product_name ?? ''} onChange={e => setNewBuild(d => ({ ...d, product_name: e.target.value }))} />
                <input placeholder="Language" className="border rounded px-2 py-1 text-sm w-28" value={newBuild.language ?? ''} onChange={e => setNewBuild(d => ({ ...d, language: e.target.value }))} />
                <select className="border rounded px-2 py-1 text-sm" value={newBuild.week_number} onChange={e => setNewBuild(d => ({ ...d, week_number: Number(e.target.value) }))}>
                  {[1,2,3,4].map(w => <option key={w} value={w}>Week {w}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {DATE_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{f.label}</label>
                    <input type="date" className="border rounded px-2 py-1 text-sm" value={(newBuild[f.key] as string) ?? ''} onChange={e => setNewBuild(d => ({ ...d, [f.key]: e.target.value || null }))} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">Add</button>
                <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
