'use client'
import { useState, useRef } from 'react'
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
    }
  }).filter(r => r.title.trim().length > 0)
}

// Report 1: 35+ units sold AND 50%+ gross margin
function filterQualifiedDemand(rows: ProductRow[]): ProductRow[] {
  return rows.filter(r => r.unitsSold >= 35 && r.grossMargin >= 0.50)
}

// Report 2: 35+ units sold AND growing vs previous period — sorted by growth
function filterMomentum(rows: ProductRow[]): ProductRow[] {
  return rows
    .filter(r => r.unitsSold >= 35 && r.unitGrowthPct > 0)
    .sort((a, b) => b.unitGrowthPct - a.unitGrowthPct)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function fmtPct(v: number) { return (v * 100).toFixed(1) + '%' }
function fmtGrowth(v: number) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%' }

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

interface UploadSlotProps {
  label: string
  description: string
  icon: React.ReactNode
  fileName: string | null
  onFile: (file: File) => void
  onClear: () => void
}

function UploadSlot({ label, description, icon, fileName, onFile, onClear }: UploadSlotProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (file.name.endsWith('.csv')) onFile(file)
  }

  if (fileName) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-elevated px-4 py-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 text-accent">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{label}</p>
            <p className="text-xs text-text-muted font-mono truncate">{fileName}</p>
          </div>
        </div>
        <button onClick={onClear} className="shrink-0 text-text-muted hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors',
        dragging
          ? 'border-accent bg-accent-muted'
          : 'border-border-subtle hover:border-border hover:bg-surface-hover',
      )}
    >
      <div className={cn('transition-colors', dragging ? 'text-accent' : 'text-text-muted')}>{icon}</div>
      <div className="text-center px-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export default function WinningProductsPage() {
  const [demandFileName, setDemandFileName] = useState<string | null>(null)
  const [demandRows, setDemandRows] = useState<ProductRow[] | null>(null)
  const [momentumFileName, setMomentumFileName] = useState<string | null>(null)
  const [momentumRows, setMomentumRows] = useState<ProductRow[] | null>(null)
  const [tab, setTab] = useState<TabId>('demand')

  async function handleDemandFile(file: File) {
    setDemandFileName(file.name)
    const text = await readFile(file)
    setDemandRows(parseCSV(text))
  }

  async function handleMomentumFile(file: File) {
    setMomentumFileName(file.name)
    const text = await readFile(file)
    setMomentumRows(parseCSV(text))
  }

  const demand = demandRows ? filterQualifiedDemand(demandRows) : []
  const momentum = momentumRows ? filterMomentum(momentumRows) : []
  const hasAny = demandRows !== null || momentumRows !== null

  const tabs = [
    {
      id: 'demand' as TabId,
      label: 'Qualified Demand',
      count: demandRows ? demand.length : undefined,
    },
    {
      id: 'momentum' as TabId,
      label: 'Momentum Tracker',
      count: momentumRows ? momentum.length : undefined,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Winning Products"
        description="Upload both Shopify exports to identify your proven sellers and highest-growth products."
      />

      {/* Two upload slots — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <UploadSlot
          label="Qualified Demand"
          description="35+ units/day · 50%+ margin"
          icon={<Trophy className="h-5 w-5" />}
          fileName={demandFileName}
          onFile={handleDemandFile}
          onClear={() => { setDemandFileName(null); setDemandRows(null) }}
        />
        <UploadSlot
          label="Momentum Tracker"
          description="Selling well · growing vs. prior 7d"
          icon={<TrendingUp className="h-5 w-5" />}
          fileName={momentumFileName}
          onFile={handleMomentumFile}
          onClear={() => { setMomentumFileName(null); setMomentumRows(null) }}
        />
      </div>

      {/* Results */}
      {hasAny && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                    <Trophy className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground leading-none">
                      {demandRows ? demand.length : '—'}
                    </p>
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
                    <p className="text-2xl font-semibold text-foreground leading-none">
                      {momentumRows ? momentum.length : '—'}
                    </p>
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
                    Products selling <strong className="text-foreground">5+ units/day</strong> with{' '}
                    <strong className="text-foreground">50%+ gross margin</strong> — proven sellers worth paying attention to.
                  </p>
                  {!demandRows ? (
                    <p className="text-sm text-text-muted text-center py-10">
                      Upload the Qualified Demand CSV to see results.
                    </p>
                  ) : (
                    <ResponsiveTable
                      columns={demandColumns}
                      data={demand}
                      rowKey={r => r.title}
                      emptyMessage="No products meet the criteria."
                    />
                  )}
                </>
              )}
              {tab === 'momentum' && (
                <>
                  <p className="text-xs text-text-muted mb-4 leading-relaxed">
                    Products already selling well that are{' '}
                    <strong className="text-foreground">growing vs. the previous 7 days</strong> — scale ad spend,
                    inventory, and creative testing here.
                  </p>
                  {!momentumRows ? (
                    <p className="text-sm text-text-muted text-center py-10">
                      Upload the Momentum Tracker CSV to see results.
                    </p>
                  ) : (
                    <ResponsiveTable
                      columns={momentumColumns}
                      data={momentum}
                      rowKey={r => r.title}
                      emptyMessage="No products are currently growing."
                    />
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
