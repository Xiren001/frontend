'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, X, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { useRole } from '@/lib/role-context'

interface ProofProduct {
  id: string
  language: string | null
  proofreader: string | null
  product_name: string
  pdp_url: string | null
  monday_url: string | null
  drive_folder: string | null
  done: boolean
  website_done: boolean
  ads_done: boolean
  ready_for_revision: boolean
  week_number: number | null
  month_year: string | null
  created_at: string
  updated_at: string
  website_done_at: string | null
  ads_done_at: string | null
  correction_count: number
}

type ViewMode = 'active' | 'done'

function daysInProofread(b: ProofProduct): number {
  const start = new Date(b.created_at).getTime()
  const end = b.done
    ? Math.max(
        b.ads_done_at     ? new Date(b.ads_done_at).getTime()     : 0,
        b.website_done_at ? new Date(b.website_done_at).getTime() : 0,
        new Date(b.updated_at).getTime(),
      )
    : Date.now()
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

export default function BioedgeProofreadQueuePage() {
  const { role } = useRole()
  const isProofreader = role === 'proofreader'
  const [items, setItems]             = useState<ProofProduct[]>([])
  const [viewMode, setViewMode]       = useState<ViewMode>('active')
  const [langTab, setLangTab]         = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(() => {
    api.get<ProofProduct[]>('/api/bioedge-proof-corrections/products')
      .then(setItems).catch(console.error)
  }, [])

  useRealtimeRefresh(['bioedge_proof_products', 'bioedge_proof_corrections'], load)
  useEffect(() => { load() }, [load])
  useEffect(() => { setLangTab('all'); setSearchQuery('') }, [viewMode])

  const activeItems = items.filter(b => !b.done)
  const doneItems   = items.filter(b => b.done)
  const baseItems   = viewMode === 'active' ? activeItems : doneItems

  const uniqueLangs = Array.from(new Set(baseItems.map(b => b.language).filter(Boolean))).sort() as string[]

  const langFiltered = langTab === 'all' ? baseItems : baseItems.filter(b => b.language === langTab)

  const q = searchQuery.trim().toLowerCase()
  const visible = q
    ? langFiltered.filter(b =>
        b.product_name.toLowerCase().includes(q) ||
        (b.language ?? '').toLowerCase().includes(q)
      )
    : langFiltered

  const langPills = [
    { id: 'all', label: 'All', count: baseItems.length },
    ...uniqueLangs.map(lang => ({ id: lang, label: lang, count: baseItems.filter(b => b.language === lang).length })),
  ]

  const emptyMsg = searchQuery
    ? `No results for "${searchQuery}"`
    : viewMode === 'done'
      ? 'No completed items.'
      : 'Queue is empty — all clear.'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <PageHeader
          title="BioEdge Proofread Queue"
          description="BioEdge products currently in the proofreading pipeline."
        />

        {/* View mode toggle */}
        <div className="flex gap-2 mb-5">
          {([
            { id: 'active', label: 'Active',    shortLabel: 'Active', icon: Clock,        count: activeItems.length },
            { id: 'done',   label: 'Done',       shortLabel: 'Done',   icon: CheckCircle2, count: doneItems.length  },
          ] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={cn(
                'flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                viewMode === v.id
                  ? v.id === 'done'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-accent-muted text-accent-bright border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
              )}
            >
              <v.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden">{v.shortLabel}</span>
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                viewMode === v.id
                  ? v.id === 'done' ? 'text-green-400 bg-green-500/10' : 'text-accent bg-accent-muted'
                  : 'text-text-muted bg-surface',
              )}>
                {v.count}
              </span>
            </button>
          ))}
        </div>

        {/* Lang pills + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 mb-4 border-b border-border-subtle">
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            {langPills.map(p => (
              <button
                key={p.id}
                onClick={() => setLangTab(p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                  langTab === p.id
                    ? 'bg-accent-muted text-accent-bright border-accent-border/50'
                    : 'text-text-secondary hover:bg-surface-hover border-border-subtle',
                )}
              >
                {p.label}
                <span className={cn('font-mono', langTab === p.id ? 'text-accent' : 'text-text-muted')}>{p.count}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-52 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Mobile: card list */}
        <div className="md:hidden">
          {visible.length === 0 ? (
            <p className="text-center text-text-muted py-12 text-sm">{emptyMsg}</p>
          ) : (
            <div className="space-y-3">
              {visible.map(b => (
                <div
                  key={b.id}
                  className={cn(
                    'rounded-xl border bg-surface-elevated p-4',
                    b.done ? 'border-border-subtle opacity-75' : 'border-border-subtle',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {!isProofreader && b.monday_url ? (
                      <a
                        href={b.monday_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1 group flex-1"
                      >
                        <span className="text-[15px] font-medium text-accent group-hover:text-accent-bright transition-colors leading-snug line-clamp-2">{b.product_name}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-colors shrink-0 mt-0.5" />
                      </a>
                    ) : (
                      <span className="text-[15px] font-medium text-foreground leading-snug flex-1">{b.product_name}</span>
                    )}
                    <span className="text-xs font-mono text-text-muted shrink-0">{formatDate(b.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {b.language && <Badge variant="accent">{b.language}</Badge>}
                    {b.ready_for_revision && !b.done && <Badge variant="default">Ready</Badge>}
                    {(b.website_done || b.done) && <Badge variant="default">Web ✓</Badge>}
                    {(b.ads_done || b.done) && <Badge variant="default">Ads ✓</Badge>}
                    {!b.ready_for_revision && !b.done && (
                      <span className="text-xs text-text-muted">In progress</span>
                    )}
                    <span className="text-xs font-mono text-text-muted ml-auto">
                      {daysInProofread(b)}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Product</TableHeader>
                <TableHeader>Lang</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Corrections</TableHeader>
                <TableHeader className="text-right">Days</TableHeader>
                <TableHeader>Added</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-12">
                    {emptyMsg}
                  </TableCell>
                </TableRow>
              )}
              {visible.map(b => (
                <TableRow key={b.id} className={b.done ? 'opacity-70' : undefined}>
                  <TableCell className="font-medium text-foreground">
                    {!isProofreader && b.monday_url ? (
                      <a
                        href={b.monday_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 group text-accent hover:text-accent-bright transition-colors"
                      >
                        {b.product_name}
                        <ExternalLink className="h-3 w-3 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                      </a>
                    ) : (
                      <span>{b.product_name}</span>
                    )}
                  </TableCell>
                  <TableCell mono>{b.language ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {b.ready_for_revision && !b.done && <Badge variant="default">Ready</Badge>}
                      {(b.website_done || b.done) && <Badge variant="default">Web ✓</Badge>}
                      {(b.ads_done || b.done) && <Badge variant="default">Ads ✓</Badge>}
                      {!b.ready_for_revision && !b.done && (
                        <span className="text-xs text-text-muted">In progress</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell mono>{b.correction_count > 0 ? b.correction_count : <span className="text-text-muted">—</span>}</TableCell>
                  <TableCell mono className="text-right">{daysInProofread(b)}d</TableCell>
                  <TableCell mono className="whitespace-nowrap text-text-secondary">{formatDate(b.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
