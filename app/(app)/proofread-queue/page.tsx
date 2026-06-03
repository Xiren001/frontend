'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Build } from '@/lib/types'
import Link from 'next/link'

export default function ProofreadQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])

  useEffect(() => {
    api.get<Build[]>('/api/builds/proofread-queue').then(setBuilds).catch(console.error)
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Proofread Queue (Phase 2)</h1>
      {builds.length === 0 ? (
        <p className="text-sm text-gray-400">Queue is empty — all clear.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Build</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Language</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Week</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Entered Proofread</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Days in proofread</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Flag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Proofreader</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {builds.map(b => {
                const daysIn = b.proof_days ?? (b.into_proofread ? Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86400000) : null)
                const flagged = daysIn !== null && daysIn > 3
                return (
                  <tr key={b.id} className={flagged ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-medium">{b.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.language ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.week_number}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(b.into_proofread)}</td>
                    <td className="px-4 py-3 text-right font-medium">{daysIn ?? '—'}</td>
                    <td className="px-4 py-3">
                      {flagged
                        ? <span className="text-xs font-medium text-red-600 bg-red-100 rounded-full px-2 py-0.5">RED</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.proofreader ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/qa-checklist/${b.id}`} className="text-xs text-indigo-500 hover:underline">QA</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
