'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, currentMonth } from '@/lib/utils'
import type { Build } from '@/lib/types'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase'
import { Search, X } from 'lucide-react'

type TypeFilter = 'all' | 'jewelry' | 'funnel'

function daysInProofread(b: Build): number | null {
  if (!b.into_proofread) return null
  if (b.proof_days !== null) return b.proof_days
  return Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86_400_000)
}

function formatMonthYear(monthYear: string): string {
  const d = new Date(monthYear + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function ProofreadQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Build[]>(`/api/builds/proofread-queue?month=${month}`).then(setBuilds).catch(console.error)
  }, [month])

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
      setAdvancing(null)
    }
  }

  const byType = builds.filter(b => filter === 'all' || b.type === filter)
  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? byType.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.proofreader ?? '').toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : byType

  const jewelryCount = builds.filter(b => b.type === 'jewelry').length
  const funnelCount  = builds.filter(b => b.type === 'funnel').length

  const FILTERS: { key: TypeFilter; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: builds.length },
    { key: 'jewelry', label: 'Jewelry', count: jewelryCount  },
    { key: 'funnel',  label: 'Funnel',  count: funnelCount   },
  ]

  // Group visible builds by month_year + week_number, sorted chronologically
  const weekGroups = visible
    .reduce<{ key: string; monthYear: string; week: number; builds: Build[] }[]>((acc, b) => {
      const key = `${b.month_year}-w${b.week_number}`
      let group = acc.find(g => g.key === key)
      if (!group) {
        group = { key, monthYear: b.month_year, week: b.week_number, builds: [] }
        acc.push(group)
      }
      group.builds.push(b)
      return acc
    }, [])
    .sort((a, b) => a.key.localeCompare(b.key))

  const colSpan = isAdmin ? 8 : 7

  return (
    <div>
      <PageHeader
        title="Proofread Queue"
        description="Proofread builds grouped by week. Items flagged red exceed the 3-day target."
        actions={
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-auto"
            mono
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${filter === f.key
                  ? 'bg-accent-muted text-accent-bright border border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border border-transparent'
                }`}
            >
              {f.label}
              <span className={`text-xs font-mono px-1 rounded ${filter === f.key ? 'text-accent' : 'text-text-muted'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search product or proofreader…"
            className="rounded-md border border-border bg-surface pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 w-72"
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
              <TableHeader>Type</TableHeader>
              <TableHeader>Lang</TableHeader>
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
                <TableCell colSpan={colSpan} className="text-center text-text-muted py-12">
                  {searchQuery ? `No results for "${searchQuery}"` : 'Queue is empty — all clear.'}
                </TableCell>
              </TableRow>
            )}
            {weekGroups.map(group => (
              <>
                <TableRow key={group.key + '-header'} className="bg-surface-elevated/60 border-t-2 border-border-subtle">
                  <TableCell colSpan={colSpan} className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Week {group.week}
                      </span>
                      <span className="text-xs text-text-muted font-mono">
                        {formatMonthYear(group.monthYear)}
                      </span>
                      <span className="ml-auto text-xs font-mono text-text-muted">
                        {group.builds.length} {group.builds.length === 1 ? 'build' : 'builds'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {group.builds.map(b => {
                  const days = daysInProofread(b)
                  const done = b.proof_end !== null
                  const flagged = !done && days !== null && days > 3
                  const trackerHref = b.type === 'jewelry' ? '/jewelry-tracker' : '/funnel-tracker'

                  return (
                    <TableRow key={b.id} className={flagged ? 'bg-danger-muted/20' : done ? 'opacity-60' : undefined}>
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
                      <TableCell mono className="whitespace-nowrap">{formatDate(b.into_proofread)}</TableCell>

                      <TableCell mono className="text-right">
                        <span className={flagged ? 'text-danger font-medium' : 'text-foreground'}>
                          {days ?? '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        {done
                          ? <Badge variant="muted">Done</Badge>
                          : flagged
                            ? <Badge variant="danger">RED</Badge>
                            : <span className="text-text-muted">—</span>}
                      </TableCell>

                      <TableCell>{b.proofreader ?? <span className="text-text-muted">—</span>}</TableCell>

                      {isAdmin && (
                        <TableCell className="text-right whitespace-nowrap">
                          {!done && (
                            <div className="flex items-center justify-end gap-3">
                              <Link href={`/qa-checklist/${b.id}`} className="text-sm text-accent hover:text-accent-bright">
                                QA
                              </Link>
                              <button
                                onClick={() => endProofread(b)}
                                disabled={advancing === b.id}
                                className="text-sm font-medium px-3 py-1 rounded border text-text-secondary border-border hover:border-text-secondary transition-colors disabled:opacity-40"
                              >
                                {advancing === b.id ? '…' : 'Done →'}
                              </button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
