'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, currentMonth } from '@/lib/utils'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase'
import { Search, X } from 'lucide-react'

interface ProofQueueItem {
  id: string
  build_id: string | null
  product_name: string
  language: string | null
  proofreader: string | null
  type: string | null
  week_number: number | null
  month_year: string | null
  into_proofread: string | null
  proof_end: string | null
  proof_days: number | null
  outcome: string | null
  source: 'build' | 'proof_product'
}

type TypeFilter = 'all' | 'jewelry' | 'funnel'

function daysInProofread(item: ProofQueueItem): number | null {
  if (!item.into_proofread) return null
  if (item.proof_days !== null) return item.proof_days
  return Math.round((Date.now() - new Date(item.into_proofread).getTime()) / 86_400_000)
}

function formatMonthYear(monthYear: string): string {
  const d = new Date(monthYear + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function ProofreadQueuePage() {
  const [items, setItems] = useState<ProofQueueItem[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<ProofQueueItem[]>(`/api/builds/proofread-queue?month=${month}`)
      .then(setItems).catch(console.error)
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

  async function endProofread(item: ProofQueueItem) {
    if (!item.build_id) return
    setAdvancing(item.id)
    try {
      await api.put(`/api/builds/${item.build_id}`, {
        proof_end: new Date().toISOString().split('T')[0],
      })
      load()
    } finally {
      setAdvancing(null)
    }
  }

  const byType = items.filter(b =>
    filter === 'all' ||
    (filter === 'jewelry' && b.type === 'jewelry') ||
    (filter === 'funnel'  && b.type === 'funnel')
  )
  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? byType.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.proofreader ?? '').toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : byType

  const jewelryCount = items.filter(b => b.type === 'jewelry').length
  const funnelCount  = items.filter(b => b.type === 'funnel').length
  const directCount  = items.filter(b => b.source === 'proof_product').length

  const FILTERS: { key: TypeFilter; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: items.length },
    { key: 'jewelry', label: 'Jewelry', count: jewelryCount  },
    { key: 'funnel',  label: 'Funnel',  count: funnelCount   },
  ]

  // Group by week — items without week_number go into a "directly added" group
  type WeekGroup = { key: string; monthYear: string | null; week: number | null; items: ProofQueueItem[] }
  const weekGroups = visible
    .reduce<WeekGroup[]>((acc, b) => {
      const key = b.week_number != null ? `${b.month_year}-w${b.week_number}` : 'direct'
      let group = acc.find(g => g.key === key)
      if (!group) {
        group = { key, monthYear: b.month_year, week: b.week_number, items: [] }
        acc.push(group)
      }
      group.items.push(b)
      return acc
    }, [])
    .sort((a, b) => {
      if (a.key === 'direct') return 1
      if (b.key === 'direct') return -1
      return a.key.localeCompare(b.key)
    })

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
          {directCount > 0 && (
            <span className="ml-2 text-xs text-text-muted font-mono">
              +{directCount} added directly
            </span>
          )}
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
                        {group.week != null ? `Week ${group.week}` : 'Added directly'}
                      </span>
                      {group.monthYear && (
                        <span className="text-xs text-text-muted font-mono">
                          {formatMonthYear(group.monthYear)}
                        </span>
                      )}
                      <span className="ml-auto text-xs font-mono text-text-muted">
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {group.items.map(b => {
                  const days = daysInProofread(b)
                  const done = b.proof_end !== null
                  const flagged = !done && days !== null && days > 3
                  const trackerHref = b.type === 'jewelry' ? '/jewelry-tracker' : b.type === 'funnel' ? '/funnel-tracker' : '/copy-review'

                  return (
                    <TableRow key={b.id} className={flagged ? 'bg-danger-muted/20' : done ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={trackerHref} className="hover:text-accent transition-colors">
                          {b.product_name}
                        </Link>
                      </TableCell>

                      <TableCell>
                        {b.type === 'jewelry' ? (
                          <Badge variant="accent">Jewelry</Badge>
                        ) : b.type === 'funnel' ? (
                          <Badge variant="default">Funnel</Badge>
                        ) : (
                          <span className="text-text-muted text-sm">—</span>
                        )}
                      </TableCell>

                      <TableCell mono>{b.language ?? '—'}</TableCell>
                      <TableCell mono className="whitespace-nowrap">
                        {b.into_proofread ? formatDate(b.into_proofread) : <span className="text-text-muted">—</span>}
                      </TableCell>

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
                          {!done && b.build_id && (
                            <div className="flex items-center justify-end gap-3">
                              <Link href={`/qa-checklist/${b.build_id}`} className="text-sm text-accent hover:text-accent-bright">
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
