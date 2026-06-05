'use client'
import { useState, useRef, useEffect } from 'react'
import { Upload, Trophy, TrendingUp, X, HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
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

function filterQualifiedDemand(rows: ProductRow[], minPerDay: number, minMarginPct: number): ProductRow[] {
  const minUnits = minPerDay * 7
  const minMargin = minMarginPct / 100
  return rows.filter(r => r.unitsSold >= minUnits && r.grossMargin >= minMargin)
}

function filterMomentum(rows: ProductRow[], minPerDay: number): ProductRow[] {
  const minUnits = minPerDay * 7
  return rows
    .filter(r => r.unitsSold >= minUnits && r.unitGrowthPct > 0)
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

const STORAGE_DEMAND   = 'wp-demand'
const STORAGE_MOMENTUM = 'wp-momentum'

interface Stored { fileName: string; rows: ProductRow[] }

function loadStored(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch { return null }
}

function saveStored(key: string, value: Stored) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function clearStored(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

export default function WinningProductsPage() {
  const [demandFileName, setDemandFileName] = useState<string | null>(null)
  const [demandRows, setDemandRows] = useState<ProductRow[] | null>(null)
  const [momentumFileName, setMomentumFileName] = useState<string | null>(null)
  const [momentumRows, setMomentumRows] = useState<ProductRow[] | null>(null)
  const [tab, setTab] = useState<TabId>('demand')
  const [minPerDay, setMinPerDay] = useState(5)
  const [minMarginPct, setMinMarginPct] = useState(50)
  const [infoOpen, setInfoOpen] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    const d = loadStored(STORAGE_DEMAND)
    if (d) { setDemandFileName(d.fileName); setDemandRows(d.rows) }
    const m = loadStored(STORAGE_MOMENTUM)
    if (m) { setMomentumFileName(m.fileName); setMomentumRows(m.rows) }
  }, [])

  async function handleDemandFile(file: File) {
    const text = await readFile(file)
    const rows = parseCSV(text)
    setDemandFileName(file.name)
    setDemandRows(rows)
    saveStored(STORAGE_DEMAND, { fileName: file.name, rows })
  }

  async function handleMomentumFile(file: File) {
    const text = await readFile(file)
    const rows = parseCSV(text)
    setMomentumFileName(file.name)
    setMomentumRows(rows)
    saveStored(STORAGE_MOMENTUM, { fileName: file.name, rows })
  }

  const demand = demandRows ? filterQualifiedDemand(demandRows, minPerDay, minMarginPct) : []
  const momentum = momentumRows ? filterMomentum(momentumRows, minPerDay) : []
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
        actions={
          <Button variant="ghost" size="sm" onClick={() => setInfoOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-1.5" />
            How it works
          </Button>
        }
      />

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="How Winning Products Works"
        size="lg"
        footer={<Button size="sm" onClick={() => setInfoOpen(false)}>Got it</Button>}
      >
        <div className="space-y-6 text-sm">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted mt-0.5">
              <Trophy className="h-4 w-4 text-accent" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Report 1 — Qualified Demand</p>
              <p className="text-text-secondary leading-relaxed">
                Products that are selling at least <strong className="text-foreground">{minPerDay} units per day</strong> ({minPerDay * 7}+ in 7 days)
                and making at least <strong className="text-foreground">{minMarginPct}% gross margin</strong>.
              </p>
              <p className="text-text-muted leading-relaxed italic">
                "Which products are already proven sellers?"
              </p>
              <p className="text-text-secondary leading-relaxed">
                Outcome: a list of products with enough demand and profit to be worth paying attention to.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted mt-0.5">
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Report 2 — Momentum Tracker</p>
              <p className="text-text-secondary leading-relaxed">
                Products that are already selling well and <strong className="text-foreground">growing</strong> compared to the previous 7 days.
                Sorted by highest growth first.
              </p>
              <p className="text-text-muted leading-relaxed italic">
                "Which products should I scale right now?"
              </p>
              <p className="text-text-secondary leading-relaxed">
                Outcome: a list of products gaining momentum and deserving more ad spend, inventory, and creative testing.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3 space-y-1">
            <p className="text-text-secondary"><span className="font-medium text-foreground">Report 1</span> = What's selling?</p>
            <p className="text-text-secondary"><span className="font-medium text-foreground">Report 2</span> = What's growing?</p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3 space-y-1.5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest">Current thresholds</p>
            <p className="text-text-secondary">Min sales / day: <span className="font-mono font-medium text-foreground">{minPerDay}</span></p>
            <p className="text-text-secondary">Min gross margin: <span className="font-mono font-medium text-foreground">{minMarginPct}%</span></p>
            <p className="text-xs text-text-muted mt-1">Adjust these at the top of the page.</p>
          </div>
        </div>
      </Modal>

      {/* Thresholds */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted whitespace-nowrap">Min sales / day</label>
          <input
            type="number"
            min={1}
            value={minPerDay}
            onChange={e => setMinPerDay(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 rounded-md border border-border bg-surface-elevated px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted whitespace-nowrap">Min gross margin %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={minMarginPct}
            onChange={e => setMinMarginPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
            className="w-16 rounded-md border border-border bg-surface-elevated px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
      </div>

      {/* Two upload slots — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <UploadSlot
          label="Qualified Demand"
          description="35+ units/day · 50%+ margin"
          icon={<Trophy className="h-5 w-5" />}
          fileName={demandFileName}
          onFile={handleDemandFile}
          onClear={() => { setDemandFileName(null); setDemandRows(null); clearStored(STORAGE_DEMAND) }}
        />
        <UploadSlot
          label="Momentum Tracker"
          description="Selling well · growing vs. prior 7d"
          icon={<TrendingUp className="h-5 w-5" />}
          fileName={momentumFileName}
          onFile={handleMomentumFile}
          onClear={() => { setMomentumFileName(null); setMomentumRows(null); clearStored(STORAGE_MOMENTUM) }}
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
