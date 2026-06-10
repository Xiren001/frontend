'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { formatDate } from '@/lib/utils'
import type { Build } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function norm(s: string) { return s.toLowerCase().trim() }

function isWinner(productName: string, winningTitles: Set<string>): boolean {
  const n = norm(productName)
  for (const t of winningTitles) {
    if (n === t || n.includes(t) || t.includes(n)) return true
  }
  return false
}

function loadWinningTitles(): Set<string> {
  const titles = new Set<string>()
  for (const key of ['wp-demand', 'wp-momentum']) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const stored = JSON.parse(raw) as { rows: { title: string }[] }
      for (const r of stored.rows ?? []) {
        if (r.title) titles.add(norm(r.title))
      }
    } catch {}
  }
  return titles
}

type TabId = 'testing' | 'expanding'

function makeTestingColumns(winningTitles: Set<string>): ResponsiveColumn<Build>[] {
  return [
    {
      key: 'product',
      header: 'Product',
      render: b => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{b.product_name}</span>
          {isWinner(b.product_name, winningTitles) && (
            <Badge variant="accent">Winner</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: b => (
        <Badge variant={b.type === 'jewelry' ? 'accent' : 'default'}>
          {b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}
        </Badge>
      ),
      hideOnMobile: true,
    },
    {
      key: 'lang',
      header: 'Lang',
      align: 'center',
      mono: true,
      hideOnMobile: true,
      render: b => <span className="text-text-muted">{b.language ?? '—'}</span>,
    },
    {
      key: 'week',
      header: 'Week',
      align: 'center',
      mono: true,
      hideOnMobile: true,
      render: b => <span className="text-text-muted">W{b.week_number}</span>,
    },
    {
      key: 'since',
      header: 'Into Testing',
      align: 'right',
      mono: true,
      render: b => <span className="text-text-secondary">{formatDate(b.into_testing)}</span>,
    },
    {
      key: 'days',
      header: 'Days Testing',
      align: 'right',
      mono: true,
      render: b => {
        const d = daysSince(b.into_testing)
        return <span className={d !== null && d > 14 ? 'text-warn font-medium' : 'text-text-muted'}>{d ?? '—'}</span>
      },
    },
  ]
}

const expandingColumns: ResponsiveColumn<Build>[] = [
  {
    key: 'product',
    header: 'Product',
    render: b => <span className="font-medium text-foreground">{b.product_name}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: b => (
      <Badge variant={b.type === 'jewelry' ? 'accent' : 'default'}>
        {b.type === 'jewelry' ? 'Jewelry' : 'Funnel'}
      </Badge>
    ),
    hideOnMobile: true,
  },
  {
    key: 'lang',
    header: 'Lang',
    align: 'center',
    mono: true,
    hideOnMobile: true,
    render: b => <span className="text-text-muted">{b.language ?? '—'}</span>,
  },
  {
    key: 'week',
    header: 'Week',
    align: 'center',
    mono: true,
    hideOnMobile: true,
    render: b => <span className="text-text-muted">W{b.week_number}</span>,
  },
  {
    key: 'decided',
    header: 'Decided',
    align: 'right',
    mono: true,
    render: b => <span className="text-text-secondary">{formatDate(b.outcome_decided)}</span>,
  },
  {
    key: 'testing',
    header: 'Into Testing',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    render: b => <span className="text-text-muted">{formatDate(b.into_testing)}</span>,
  },
  {
    key: 'days',
    header: 'Days Expanding',
    align: 'right',
    mono: true,
    render: b => {
      const d = daysSince(b.outcome_decided)
      return <span className="font-medium text-foreground">{d ?? '—'}</span>
    },
  },
]

export default function ProductRankingPage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [tab, setTab] = useState<TabId>('testing')
  const [winningTitles, setWinningTitles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'jewelry' | 'funnel'>('all')
  const [langFilter, setLangFilter] = useState('all')

  async function load() {
    const data = await api.get<Build[]>('/api/builds')
    setBuilds(data)
  }

  useRealtimeRefresh('builds', load)
  useEffect(() => {
    load()
    setWinningTitles(loadWinningTitles())
  }, [])

  const uniqueLangs = Array.from(new Set(builds.map(b => b.language).filter(Boolean))).sort() as string[]

  function applyFilters(list: Build[]) {
    const q = searchQuery.trim().toLowerCase()
    return list.filter(b => {
      if (typeFilter !== 'all' && b.type !== typeFilter) return false
      if (langFilter !== 'all' && b.language !== langFilter) return false
      if (q && !b.product_name.toLowerCase().includes(q)) return false
      return true
    })
  }

  const allTesting = builds
    .filter(b => b.outcome === 'testing')
    .sort((a, b) => (a.into_testing ?? '').localeCompare(b.into_testing ?? ''))
  const allExpanding = builds
    .filter(b => b.outcome === 'expanding')
    .sort((a, b) => (b.outcome_decided ?? '').localeCompare(a.outcome_decided ?? ''))

  const testing  = applyFilters(allTesting)
  const expanding = applyFilters(allExpanding)

  const tabs = [
    { id: 'testing' as TabId,   label: 'Testing',   count: allTesting.length  },
    { id: 'expanding' as TabId, label: 'Expanding', count: allExpanding.length },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
      <PageHeader
        title="Product Ranking"
        description="All products currently in testing or expanding, across both jewelry and funnel."
      />
      </div>

      <div className="border border-border-subtle rounded-xl bg-surface-elevated overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-4 flex items-end justify-between gap-3 flex-wrap">
          <Tabs tabs={tabs} active={tab} onChange={id => setTab(id as TabId)} />
        </div>

        {/* Search + filters */}
        <div className="px-4 pb-3 pt-3 border-b border-border-subtle flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'jewelry', 'funnel'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border capitalize',
                  typeFilter === t
                    ? 'bg-accent-muted text-accent-bright border-accent-border/50'
                    : 'text-text-secondary border-transparent hover:bg-surface-hover',
                )}
              >{t === 'all' ? 'All types' : t}</button>
            ))}
          </div>
          {uniqueLangs.length > 1 && (
            <select
              value={langFilter}
              onChange={e => setLangFilter(e.target.value)}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
            >
              <option value="all">All langs</option>
              {uniqueLangs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {(searchQuery || typeFilter !== 'all' || langFilter !== 'all') && (
            <span className="text-xs text-text-muted ml-auto">
              {(tab === 'testing' ? testing : expanding).length} result{(tab === 'testing' ? testing : expanding).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === 'testing' && (
            <ResponsiveTable
              columns={makeTestingColumns(winningTitles)}
              data={testing}
              rowKey={b => b.id}
              emptyMessage={searchQuery || typeFilter !== 'all' || langFilter !== 'all' ? 'No matching products.' : 'No products currently in testing.'}
              rowClassName={b =>
                isWinner(b.product_name, winningTitles)
                  ? 'bg-accent-muted/40'
                  : undefined
              }
            />
          )}
          {tab === 'expanding' && (
            <ResponsiveTable
              columns={expandingColumns}
              data={expanding}
              rowKey={b => b.id}
              emptyMessage={searchQuery || typeFilter !== 'all' || langFilter !== 'all' ? 'No matching products.' : 'No products currently expanding.'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
