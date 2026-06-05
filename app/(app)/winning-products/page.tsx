'use client'
import { useState, useCallback, useRef } from 'react'
import { Upload, Trophy, TrendingUp, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { cn } from '@/lib/utils'

interface ProductRow {
  rank: number
  title: string
  unitsSold: number
  avgPerDay: number
  grossMargin: number
  prevUnitsSold: number
  unitGrowthPct: number
  grossSales: number
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): ProductRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  return lines.slice(1).map((line, i) => {
    const cols = parseCSVLine(line)
    return {
      rank: i + 1,
      title: cols[0] ?? '',
      unitsSold: parseFloat(cols[1]) || 0,
      avgPerDay: (parseFloat(cols[1]) || 0) / 7,
      grossMargin: parseFloat(cols[6]) || 0,
      prevUnitsSold: parseFloat(cols[8]) || 0,
      unitGrowthPct: parseFloat(cols[15]) || 0,
      grossSales: parseFloat(cols[3]) || 0,
    }
  }).filter(r => r.title.trim().length > 0)
}

// Report 1: 35+ units/7-day period AND 50%+ gross margin
function qualifiedDemand(rows: ProductRow[]): ProductRow[] {
  return rows.filter(r => r.unitsSold >= 35 && r.grossMargin >= 0.50)
}

// Report 2: 35+ units/7-day period AND positive growth vs previous 7 days
function momentumTracker(rows: ProductRow[]): ProductRow[] {
  return rows
    .filter(r => r.unitsSold >= 35 && r.unitGrowthPct > 0)
    .sort((a, b) => b.unitGrowthPct - a.unitGrowthPct)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function fmtPct(v: number) {
  return (v * 100).toFixed(1) + '%'
}

function fmtGrowth(v: number) {
  const sign = v >= 0 ? '+' : ''
  return sign + v.toFixed(1) + '%'
}

const demandColumns: ResponsiveColumn<ProductRow>[] = [
  {
    key: 'rank',
    header: '#',
    render: r => <span className="text-text-muted font-mono text-xs">{r.rank}</span>,
    cellClassName: 'w-8',
  },
  {
    key: 'title',
    header: 'Product',
    render: r => <span className="text-foreground font-medium">{r.title}</span>,
  },
  {
    key: 'units',
    header: 'Units (7d)',
    align: 'right',
    mono: true,
    render: r => <span className="font-medium">{r.unitsSold}</span>,
  },
  {
    key: 'avg',
    header: 'Avg / day',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    render: r => <span>{r.avgPerDay.toFixed(1)}</span>,
  },
  {
    key: 'margin',
    header: 'Gross Margin',
    align: 'right',
    render: r => (
      <Badge variant={r.grossMargin >= 0.80 ? 'accent' : 'default'}>
        {fmtPct(r.grossMargin)}
      </Badge>
    ),
  },
]

const momentumColumns: ResponsiveColumn<ProductRow>[] = [
  {
    key: 'rank',
    header: '#',
    render: r => <span className="text-text-muted font-mono text-xs">{r.rank}</span>,
    cellClassName: 'w-8',
  },
  {
    key: 'title',
    header: 'Product',
    render: r => <span className="text-foreground font-medium">{r.title}</span>,
  },
  {
    key: 'units',
    header: 'Units (7d)',
    align: 'right',
    mono: true,
    render: r => <span className="font-medium">{r.unitsSold}</span>,
  },
  {
    key: 'prev',
    header: 'Prev 7d',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    render: r => <span className="text-text-muted">{r.prevUnitsSold}</span>,
  },
  {
    key: 'growth',
    header: 'Growth',
    align: 'right',
    render: r => (
      <Badge variant={r.unitGrowthPct >= 20 ? 'accent' : 'default'}>
        {fmtGrowth(r.unitGrowthPct)}
      </Badge>
    ),
  },
  {
    key: 'margin',
    header: 'Margin',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    render: r => <span>{fmtPct(r.grossMargin)}</span>,
  },
]

type TabId = 'demand' | 'momentum'

export default function WinningProductsPage() {
  const [rows, setRows] = useState<ProductRow[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('demand')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  function clearFile() {
    setRows(null)
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const demand = rows ? qualifiedDemand(rows) : []
  const momentum = rows ? momentumTracker(rows) : []

  const tabs = [
    { id: 'demand' as TabId, label: 'Qualified Demand', count: rows ? demand.length : undefined },
    { id: 'momentum' as TabId, label: 'Momentum Tracker', count: rows ? momentum.length : undefined },
  ]

  return (
    <div>
      <PageHeader
        title="Winning Products"
        description="Upload a Shopify product sales CSV to identify top performers and growth opportunities."
      />

      {/* Upload area */}
      {!rows ? (
        <Card>
          <CardBody>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-16 cursor-pointer transition-colors',
                dragging
                  ? 'border-accent bg-accent-muted'
                  : 'border-border-subtle hover:border-border hover:bg-surface-hover',
              )}
            >
              <Upload className={cn('h-8 w-8', dragging ? 'text-accent' : 'text-text-muted')} />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Drop your CSV file here</p>
                <p className="text-xs text-text-muted mt-1">or click to browse — Shopify product sales export</p>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* File info bar */}
          <div className="flex items-center justify-between rounded-lg bg-surface-elevated border border-border-subtle px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Upload className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span className="text-xs text-text-secondary font-mono truncate">{fileName}</span>
              <span className="text-xs text-text-muted">· {rows.length} products loaded</span>
            </div>
            <button
              onClick={clearFile}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground transition-colors shrink-0 ml-4"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                    <Trophy className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground leading-none">{demand.length}</p>
                    <p className="text-xs text-text-muted mt-1">Qualified Demand</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-3 leading-relaxed">
                  35+ units / 7 days &amp; 50%+ gross margin
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground leading-none">{momentum.length}</p>
                    <p className="text-xs text-text-muted mt-1">Momentum Tracker</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-3 leading-relaxed">
                  Selling well &amp; growing vs. prior 7 days
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Tabs + table */}
          <Card>
            <div className="px-4 pt-4">
              <Tabs tabs={tabs} active={tab} onChange={id => setTab(id as TabId)} />
            </div>
            <CardBody>
              {tab === 'demand' && (
                <>
                  <p className="text-xs text-text-muted mb-4 leading-relaxed">
                    Products selling <strong className="text-foreground">5+ units/day</strong> (35+ in the period) with{' '}
                    <strong className="text-foreground">50%+ gross margin</strong> — your proven sellers worth paying attention to.
                  </p>
                  <ResponsiveTable
                    columns={demandColumns}
                    data={demand}
                    rowKey={r => r.title}
                    emptyMessage="No products meet the criteria."
                  />
                </>
              )}
              {tab === 'momentum' && (
                <>
                  <p className="text-xs text-text-muted mb-4 leading-relaxed">
                    Products already selling well (35+/period) that are{' '}
                    <strong className="text-foreground">growing vs. the previous 7 days</strong> — scale ad spend,
                    inventory, and creative testing here.
                  </p>
                  <ResponsiveTable
                    columns={momentumColumns}
                    data={momentum}
                    rowKey={r => r.title}
                    emptyMessage="No products are currently growing."
                  />
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
