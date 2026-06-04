'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate } from '@/lib/utils'
import type { Build } from '@/lib/types'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase'

type TypeFilter = 'all' | 'jewelry' | 'funnel'

function daysInProofread(b: Build): number | null {
  if (!b.into_proofread) return null
  if (b.proof_days !== null) return b.proof_days
  return Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86_400_000)
}

export default function ProofreadQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Build[]>('/api/builds/proofread-queue').then(setBuilds).catch(console.error)
  }, [])

  useRealtimeRefresh('builds', load)

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [load])

  async function endProofread(b: Build) {
    setAdvancing(b.id)
    try {
      await api.put(`/api/builds/${b.id}`, {
        proof_end: new Date().toISOString().split('T')[0],
      })
      load()
    } finally {
      setAdvancing(null) }
  }

  const visible = builds.filter(b => filter === 'all' || b.type === filter)
  const jewelryCount = builds.filter(b => b.type === 'jewelry').length
  const funnelCount  = builds.filter(b => b.type === 'funnel').length

  const FILTERS: { key: TypeFilter; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: builds.length },
    { key: 'jewelry', label: 'Jewelry', count: jewelryCount  },
    { key: 'funnel',  label: 'Funnel',  count: funnelCount   },
  ]

  return (
    <div>
      <PageHeader
        title="Proofread Queue"
        description="Builds currently in the Proofread phase. Items flagged red exceed the 3-day target."
      />

      <div className="flex items-center gap-1 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${filter === f.key
                ? 'bg-accent-muted text-accent-bright border border-accent-border/50'
                : 'text-text-secondary hover:bg-surface-hover border border-transparent'
              }`}
          >
            {f.label}
            <span className={`text-[10px] font-mono px-1 rounded ${filter === f.key ? 'text-accent' : 'text-text-muted'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Product</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Lang</TableHeader>
              <TableHeader>Wk</TableHeader>
              <TableHeader>In Proofread Since</TableHeader>
              <TableHeader className="text-right">Days</TableHeader>
              <TableHeader>Flag</TableHeader>
              <TableHeader>Proofreader</TableHeader>
              {isAdmin && <TableHeader />}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-text-muted py-12">
                  Queue is empty — all clear.
                </TableCell>
              </TableRow>
            )}
            {visible.map(b => {
              const days = daysInProofread(b)
              const flagged = days !== null && days > 3
              const trackerHref = b.type === 'jewelry' ? '/jewelry-tracker' : '/funnel-tracker'

              return (
                <TableRow key={b.id} className={flagged ? 'bg-danger-muted/20' : undefined}>
                  <TableCell className="font-medium text-foreground">
                    <Link href={trackerHref} className="hover:text-accent transition-colors"
                      title={`View in ${b.type === 'jewelry' ? 'Jewelry' : 'Funnel'} Tracker`}>
                      {b.product_name}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <Badge variant={b.type === 'jewelry' ? 'accent' : 'default'}>
                      {b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}
                    </Badge>
                  </TableCell>

                  <TableCell mono>{b.language ?? '—'}</TableCell>
                  <TableCell mono>{b.week_number}</TableCell>
                  <TableCell mono className="whitespace-nowrap">{formatDate(b.into_proofread)}</TableCell>

                  <TableCell mono className="text-right">
                    <span className={flagged ? 'text-danger font-medium' : 'text-foreground'}>
                      {days ?? '—'}
                    </span>
                  </TableCell>

                  <TableCell>
                    {flagged
                      ? <Badge variant="danger">RED</Badge>
                      : <span className="text-text-muted">—</span>}
                  </TableCell>

                  <TableCell>{b.proofreader ?? <span className="text-text-muted">—</span>}</TableCell>

                  {isAdmin && (
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright">
                          QA
                        </Link>
                        <button
                          onClick={() => endProofread(b)}
                          disabled={advancing === b.id}
                          className="text-xs font-medium px-2 py-0.5 rounded border text-text-secondary border-border hover:border-text-secondary transition-colors disabled:opacity-40"
                        >
                          {advancing === b.id ? '…' : 'Done →'}
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
