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

  async function load() {
    const data = await api.get<Build[]>('/api/builds')
    setBuilds(data)
  }

  useRealtimeRefresh('builds', load)
  useEffect(() => {
    load()
    setWinningTitles(loadWinningTitles())
  }, [])

  const testing = builds
    .filter(b => b.outcome === 'testing')
    .sort((a, b) => (a.into_testing ?? '').localeCompare(b.into_testing ?? ''))

  const expanding = builds
    .filter(b => b.outcome === 'expanding')
    .sort((a, b) => (b.outcome_decided ?? '').localeCompare(a.outcome_decided ?? ''))

  const tabs = [
    { id: 'testing' as TabId, label: 'Testing', count: testing.length },
    { id: 'expanding' as TabId, label: 'Expanding', count: expanding.length },
  ]

  return (
    <div>
      <PageHeader
        title="Product Ranking"
        description="All products currently in testing or expanding, across both jewelry and funnel."
      />

      <div className="border border-border-subtle rounded-xl bg-surface-elevated overflow-hidden">
        <div className="px-4 pt-4">
          <Tabs tabs={tabs} active={tab} onChange={id => setTab(id as TabId)} />
        </div>
        <div className="p-4">
          {tab === 'testing' && (
            <ResponsiveTable
              columns={makeTestingColumns(winningTitles)}
              data={testing}
              rowKey={b => b.id}
              emptyMessage="No products currently in testing."
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
              emptyMessage="No products currently expanding."
            />
          )}
        </div>
      </div>
    </div>
  )
}
