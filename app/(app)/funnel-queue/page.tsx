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
import { Search, X } from 'lucide-react'

function daysInProofread(b: Build): number | null {
  if (!b.into_proofread) return null
  if (b.proof_days !== null) return b.proof_days
  return Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86_400_000)
}

export default function FunnelQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Build[]>('/api/builds/proofread-queue?type=funnel').then(setBuilds).catch(console.error)
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
    } finally { setAdvancing(null) }
  }

  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? builds.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.proofreader ?? '').toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : builds

  return (
    <div>
      <PageHeader
        title="Funnel Queue"
        description="Funnel builds currently in the Proofread phase. Items flagged red exceed the 3-day target."
      />

      <div className="flex items-center gap-2 mb-6">
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search product or proofreader…"
            className="rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 w-64"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Product</TableHeader>
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
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-text-muted py-12">
                  {searchQuery ? `No results for "${searchQuery}"` : 'Queue is empty — all clear.'}
                </TableCell>
              </TableRow>
            )}
            {visible.map(b => {
              const days = daysInProofread(b)
              const flagged = days !== null && days > 3

              return (
                <TableRow key={b.id} className={flagged ? 'bg-danger-muted/20' : undefined}>
                  <TableCell className="font-medium text-foreground">
                    <Link href="/funnel-tracker" className="hover:text-accent transition-colors" title="View in Funnel Tracker">
                      {b.product_name}
                    </Link>
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
