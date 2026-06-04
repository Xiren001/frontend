'use client'
import { useState, useEffect, useRef, CSSProperties } from 'react'
import { api } from '@/lib/api'
import { BuildFormModal } from './BuildFormModal'
import { BuildNoteModal } from './BuildNoteModal'
import { cn, formatDate } from '@/lib/utils'
import type { Build, BuildOutcome, BuildType, Settings } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmModal } from '@/components/ui/modal'
import { ClipboardList, Pencil, Trash2, Download, Upload, FileDown, ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Phase config ─────────────────────────────────────────────────────────────

const PHASE_FIELDS: {
  key: keyof Build
  label: string
  status: string
  variant: 'default' | 'warn' | 'accent'
  showFrom?: 'md'
}[] = [
  { key: 'phase1_start',    label: 'Phase 1',   status: 'Building',     variant: 'default' },
  { key: 'into_proofread',  label: 'Proofread', status: 'Proofreading', variant: 'warn',   showFrom: 'md' },
  { key: 'into_testing',    label: 'Testing',   status: 'Testing',      variant: 'default', showFrom: 'md' },
  { key: 'outcome_decided', label: 'Decided',   status: 'Decided',      variant: 'accent',  showFrom: 'md' },
]

const OUTCOME_VARIANT: Record<NonNullable<BuildOutcome>, 'accent' | 'warn' | 'danger'> = {
  expanding: 'accent',
  testing:   'warn',
  stopped:   'danger',
}

const PHASE_BTN: Record<string, string> = {
  default: 'text-text-secondary border-border hover:border-text-secondary bg-surface-elevated/60',
  warn:    'text-yellow-500 border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/5',
  accent:  'text-accent border-accent/30 hover:border-accent/60 bg-accent-muted/20',
}

const PHASE_BADGE_CLS: Record<string, string> = {
  pending:  'text-text-muted bg-surface-elevated border-border-subtle',
  building: 'text-text-secondary bg-surface-elevated border-border',
  proofread:'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  testing:  'text-accent bg-accent-muted border-accent-border',
  decided:  'text-accent bg-accent-muted border-accent-border',
}

function getNextPhaseKey(b: Build): keyof Build | null {
  for (const { key } of PHASE_FIELDS) if (!b[key]) return key
  return null
}

const showClass = (from?: 'md' | 'lg') =>
  from === 'md' ? 'hidden md:table-cell' : from === 'lg' ? 'hidden lg:table-cell' : ''

const SELECT_CLS =
  'rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'

// ── Marquee name ─────────────────────────────────────────────────────────────

function MarqueeName({ name, className = '' }: { name: string; className?: string }) {
  const cRef = useRef<HTMLDivElement>(null)
  const tRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!cRef.current || !tRef.current) return
    setOverflow(Math.max(0, tRef.current.scrollWidth - cRef.current.offsetWidth))
  }, [name])

  return (
    <div
      ref={cRef}
      className={`overflow-hidden ${className}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <span
        ref={tRef}
        className="block whitespace-nowrap"
        style={
          active && overflow > 0
            ? ({ animation: 'marquee-bounce 3s ease-in-out infinite', '--marquee-offset': `-${overflow}px` } as CSSProperties)
            : {}
        }
      >
        {name}
      </span>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function avgNum(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}

function statColor(val: number | null, target: number): string {
  if (val === null) return 'text-text-muted'
  if (val <= target) return 'text-accent'
  if (val <= target * 1.3) return 'text-yellow-500'
  return 'text-danger'
}

// ── Mobile card ──────────────────────────────────────────────────────────────

interface CardProps {
  b: Build
  isAdmin: boolean
  advancing: string | null
  onOpenNotes: (b: Build) => void
  onOpenEdit: (b: Build) => void
  onDelete: (id: string) => void
  onPhaseSet: (id: string, field: keyof Build) => void
  onPhaseClear: (id: string, field: keyof Build) => void
  onOutcomeChange: (id: string, outcome: BuildOutcome) => void
}

function BuildCard({ b, isAdmin, advancing, onOpenNotes, onOpenEdit, onDelete, onPhaseSet, onPhaseClear, onOutcomeChange }: CardProps) {
  const nextKey = getNextPhaseKey(b)
  const nextField = PHASE_FIELDS.find(f => f.key === nextKey)

  // Most recent set phase date for display
  const phases = PHASE_FIELDS.filter(f => b[f.key])
  const latest = phases[phases.length - 1]

  return (
    <div
      className="bg-surface-elevated border border-border-subtle rounded-lg p-4 cursor-pointer hover:bg-surface-hover transition-colors active:scale-[0.995]"
      onClick={() => onOpenNotes(b)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{b.product_name}</p>
          <p className="text-xs text-text-muted font-mono mt-0.5">
            {[b.language, `Wk ${b.week_number}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {/* Admin action icons — stop propagation so they don't open notes */}
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Link
              href={`/qa-checklist/${b.id}`}
              className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent-muted transition-colors"
              title="QA checklist"
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => onOpenEdit(b)}
              className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(b.id)}
              className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Phase status + advance */}
      <div className="flex items-center gap-2 mb-3" onClick={e => e.stopPropagation()}>
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PHASE_BADGE_CLS[b.phase] ?? PHASE_BADGE_CLS.pending}`}>
          {b.phase.charAt(0).toUpperCase() + b.phase.slice(1)}
        </span>
        {isAdmin && nextField && (
          <button
            onClick={() => onPhaseSet(b.id, nextField.key)}
            disabled={advancing === b.id + String(nextField.key)}
            className={`text-xs font-medium px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${PHASE_BTN[nextField.variant]}`}
          >
            {advancing === b.id + String(nextField.key) ? '…' : `${nextField.status} →`}
          </button>
        )}
        {isAdmin && latest && (
          <button
            onClick={() => onPhaseClear(b.id, latest.key)}
            disabled={advancing === b.id + String(latest.key)}
            className="text-danger hover:text-red-400 font-bold text-sm leading-none disabled:opacity-40"
            title="Return to previous phase"
          >
            ←
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-text-muted" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {b.approved_date && <span>Approved {formatDate(b.approved_date)}</span>}
          {b.total_days !== null && <span className="font-mono font-medium text-foreground">{b.total_days}d</span>}
        </div>
        {isAdmin ? (
          <select
            value={b.outcome ?? ''}
            onChange={e => onOutcomeChange(b.id, (e.target.value as BuildOutcome) || null)}
            className="text-xs bg-surface-elevated border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option value="">—</option>
            <option value="stopped">Stopped</option>
            <option value="testing">Testing</option>
            <option value="expanding">Expanding</option>
          </select>
        ) : b.outcome ? (
          <Badge variant={OUTCOME_VARIANT[b.outcome]}>{b.outcome}</Badge>
        ) : null}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// ── xlsx column map ───────────────────────────────────────────────────────────

const IMPORT_COLS = [
  { label: 'Product Name',    key: 'product_name',    width: 22 },
  { label: 'Language',        key: 'language',        width: 10 },
  { label: 'Week',            key: 'week_number',     width: 6  },
  { label: 'Approved Date',   key: 'approved_date',   width: 14 },
  { label: 'Phase 1 Start',   key: 'phase1_start',    width: 14 },
  { label: 'Into Proofread',  key: 'into_proofread',  width: 14 },
  { label: 'Into Testing',    key: 'into_testing',    width: 14 },
  { label: 'Outcome Decided', key: 'outcome_decided', width: 14 },
  { label: 'Outcome',         key: 'outcome',         width: 12 },
  { label: 'Proofreader',     key: 'proofreader',     width: 14 },
  { label: 'Notes',           key: 'notes',           width: 30 },
] as const

const EXPORT_EXTRA = [
  { label: 'Build Days',  key: 'build_days'  },
  { label: 'Proof Days',  key: 'proof_days'  },
  { label: 'Test Days',   key: 'test_days'   },
  { label: 'Total Days',  key: 'total_days'  },
] as const

function toDateStr(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  builds: Build[]
  type: BuildType
  month: string   // e.g. "2026-06"
  onRefresh: () => void
  isAdmin: boolean
}

export function BuildsTable({ builds, type, month, onRefresh, isAdmin }: Props) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editBuild, setEditBuild] = useState<Build | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notesBuild, setNotesBuild] = useState<Build | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<Settings>('/api/settings').then(setSettings).catch(() => {})
  }, [])

  const weeks = [1, 2, 3, 4]
  const weekBuilds = builds.filter(b => b.week_number === activeWeek)

  const buildAvg = avgNum(weekBuilds.map(b => b.build_days))
  const proofAvg = avgNum(weekBuilds.map(b => b.proof_days))
  const testAvg  = avgNum(weekBuilds.map(b => b.test_days))
  const totalAvg = avgNum(weekBuilds.map(b => b.total_days))

  const tabs = weeks.map(w => ({
    id: w,
    label: `Week ${w}`,
    count: builds.filter(b => b.week_number === w).length,
  }))

  function openCreate() { setFormMode('create'); setEditBuild(null); setFormOpen(true) }
  function openEdit(b: Build) { setFormMode('edit'); setEditBuild(b); setFormOpen(true) }

  async function handleSave(data: Partial<Build>) {
    setSaving(true)
    try {
      if (formMode === 'create') await api.post('/api/builds', data)
      else if (editBuild) await api.put(`/api/builds/${editBuild.id}`, data)
      setFormOpen(false)
      onRefresh()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/builds/${deleteId}`)
      setDeleteId(null)
      onRefresh()
    } finally { setDeleting(false) }
  }

  async function handlePhaseSet(buildId: string, field: keyof Build) {
    setAdvancing(buildId + String(field))
    try {
      await api.put(`/api/builds/${buildId}`, { [field]: new Date().toISOString().split('T')[0] })
      onRefresh()
    } finally { setAdvancing(null) }
  }

  async function handlePhaseClear(buildId: string, field: keyof Build) {
    setAdvancing(buildId + String(field))
    const idx = PHASE_FIELDS.findIndex(f => f.key === field)
    const update: Record<string, null> = {}
    for (let i = idx; i < PHASE_FIELDS.length; i++) update[PHASE_FIELDS[i].key as string] = null
    try {
      await api.put(`/api/builds/${buildId}`, update)
      onRefresh()
    } finally { setAdvancing(null) }
  }

  async function handleOutcomeChange(buildId: string, outcome: BuildOutcome) {
    await api.put(`/api/builds/${buildId}`, { outcome })
    onRefresh()
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    const allCols = [...IMPORT_COLS, ...EXPORT_EXTRA]
    const headers = allCols.map(c => c.label)
    const rows = builds.map(b =>
      allCols.map(c => b[c.key as keyof Build] ?? '')
    )
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = allCols.map((c, i) => ({ wch: i < IMPORT_COLS.length ? (IMPORT_COLS[i] as { width: number }).width : 10 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Builds')
    XLSX.writeFile(wb, `${type}-builds-${month}.xlsx`)
  }

  // ── Template download ─────────────────────────────────────────────────────

  function handleTemplateDownload() {
    const headers = IMPORT_COLS.map(c => c.label)
    const example = [
      'Example Product', 'EN', 1, '2026-06-01', '2026-06-02',
      '2026-06-05', '2026-06-07', '2026-06-14', 'expanding', 'Jane', 'Optional note here',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = IMPORT_COLS.map(c => ({ wch: c.width }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `${type}-import-template.xlsx`)
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
      if (raw.length < 2) return

      const hdrs = (raw[0] as string[]).map(h => h?.toString().trim().toLowerCase())
      const colIdx = (label: string) => hdrs.indexOf(label.toLowerCase())

      let ok = 0
      let err = 0
      for (const row of raw.slice(1)) {
        const r = row as unknown[]
        const productName = r[colIdx('product name')]?.toString().trim()
        if (!productName) continue

        const outcome = r[colIdx('outcome')]?.toString().trim() as Build['outcome'] | undefined
        const build = {
          type,
          month_year: `${month}-01`,
          product_name: productName,
          language:        r[colIdx('language')]?.toString().trim() || null,
          week_number:     Number(r[colIdx('week')]) || 1,
          approved_date:   toDateStr(r[colIdx('approved date')]),
          phase1_start:    toDateStr(r[colIdx('phase 1 start')]),
          into_proofread:  toDateStr(r[colIdx('into proofread')]),
          into_testing:    toDateStr(r[colIdx('into testing')]),
          outcome_decided: toDateStr(r[colIdx('outcome decided')]),
          outcome:         outcome || null,
          proofreader:     r[colIdx('proofreader')]?.toString().trim() || null,
          notes:           r[colIdx('notes')]?.toString().trim() || null,
        }
        try { await api.post('/api/builds', build); ok++ } catch { err++ }
      }
      onRefresh()
      alert(`Import done: ${ok} added${err ? `, ${err} skipped` : ''}.`)
    } catch {
      alert('Failed to read file. Make sure it is a valid .xlsx file.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function closeActionsMenu(e: React.MouseEvent<HTMLElement>) {
    const details = e.currentTarget.closest('details')
    if (details) details.open = false
  }

  return (
    <div className="space-y-6">
      {/* Mobile: week select + actions menu */}
      <div className="flex items-center gap-2 md:hidden">
        <select
          value={activeWeek}
          onChange={e => setActiveWeek(Number(e.target.value))}
          className={cn(SELECT_CLS, 'flex-1 min-w-0')}
          aria-label="Select week"
        >
          {tabs.map(tab => (
            <option key={tab.id} value={tab.id}>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </option>
          ))}
        </select>
        {isAdmin && (
          <details className="relative shrink-0">
            <summary className="flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Actions
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-md border border-border bg-surface-elevated py-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                onClick={e => { closeActionsMenu(e); handleTemplateDownload() }}
              >
                <FileDown className="h-3.5 w-3.5 text-text-muted" />Template
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                disabled={importing}
                onClick={e => { closeActionsMenu(e); fileInputRef.current?.click() }}
              >
                <Upload className="h-3.5 w-3.5 text-text-muted" />{importing ? 'Importing…' : 'Import'}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                onClick={e => { closeActionsMenu(e); handleExport() }}
              >
                <Download className="h-3.5 w-3.5 text-text-muted" />Export
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover border-t border-border-subtle mt-1 pt-2"
                onClick={e => { closeActionsMenu(e); openCreate() }}
              >
                + Add build
              </button>
            </div>
          </details>
        )}
      </div>

      {/* Desktop: week tabs + toolbar */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <Tabs tabs={tabs} active={activeWeek} onChange={id => setActiveWeek(Number(id))} className="flex-1" />
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleTemplateDownload} title="Download import template">
              <FileDown className="h-3.5 w-3.5 mr-1.5" />Template
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} title="Import from .xlsx">
              <Upload className="h-3.5 w-3.5 mr-1.5" />{importing ? 'Importing…' : 'Import'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExport} title="Export to .xlsx">
              <Download className="h-3.5 w-3.5 mr-1.5" />Export
            </Button>
            <Button variant="secondary" size="sm" onClick={openCreate}>
              + Add build
            </Button>
          </div>
        )}
      </div>
      {isAdmin && (
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
      )}

      {/* ── Mobile card layout (< md) ── */}
      <div className="block md:hidden space-y-3">
        {weekBuilds.length === 0 && (
          <p className="text-sm text-text-muted text-center py-10">
            No builds in Week {activeWeek}
            {isAdmin && <> · <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button></>}
          </p>
        )}
        {weekBuilds.map(b => (
          <BuildCard
            key={b.id}
            b={b}
            isAdmin={isAdmin}
            advancing={advancing}
            onOpenNotes={setNotesBuild}
            onOpenEdit={openEdit}
            onDelete={setDeleteId}
            onPhaseSet={handlePhaseSet}
            onPhaseClear={handlePhaseClear}
            onOutcomeChange={handleOutcomeChange}
          />
        ))}
      </div>

      {/* ── Desktop table layout (md+) ── */}
      <div className="hidden md:flex items-start gap-1">
        <div className="flex-1 overflow-x-auto min-w-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Product</TableHeader>
                <TableHeader className={showClass('md')}>Lang</TableHeader>
                <TableHeader className={`${showClass('md')} whitespace-nowrap`}>Approved</TableHeader>
                {PHASE_FIELDS.map(f => (
                  <TableHeader key={f.key as string} className={`whitespace-nowrap ${showClass(f.showFrom)}`}>
                    {f.label}
                  </TableHeader>
                ))}
                <TableHeader>Outcome</TableHeader>
                <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Build d</TableHeader>
                <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Proof d</TableHeader>
                <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Test d</TableHeader>
                <TableHeader className="text-right whitespace-nowrap">Total d</TableHeader>
                {isAdmin && <TableHeader />}
              </TableRow>
            </TableHead>
            <TableBody>
              {weekBuilds.map(b => {
                const nextPhaseKey = getNextPhaseKey(b)
                return (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() => setNotesBuild(b)}
                  >
                    <TableCell className="font-medium text-foreground" onClick={e => e.stopPropagation()}>
                      <MarqueeName name={b.product_name} className="max-w-[180px]" />
                    </TableCell>
                    <TableCell mono className={showClass('md')}>{b.language ?? '—'}</TableCell>
                    <TableCell mono className={`${showClass('md')} whitespace-nowrap`}>
                      {formatDate(b.approved_date)}
                    </TableCell>

                    {PHASE_FIELDS.map(f => {
                      const val = b[f.key] as string | null
                      const advKey = b.id + String(f.key)
                      const isBusy = advancing === advKey
                      const hide = showClass(f.showFrom)

                      if (val) {
                        return (
                          <TableCell key={f.key as string} className={`whitespace-nowrap ${hide}`} onClick={e => e.stopPropagation()}>
                            {isAdmin && (
                              <button
                                onClick={() => handlePhaseClear(b.id, f.key)}
                                disabled={isBusy}
                                title="Return to previous phase"
                                className="mr-1.5 text-danger hover:text-red-400 font-bold text-sm leading-none align-middle disabled:opacity-40 transition-colors"
                              >
                                ←
                              </button>
                            )}
                            <span className="font-mono text-xs text-foreground">{formatDate(val)}</span>
                          </TableCell>
                        )
                      }

                      if (isAdmin && nextPhaseKey === f.key) {
                        return (
                          <TableCell key={f.key as string} className={hide} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handlePhaseSet(b.id, f.key)}
                              disabled={isBusy}
                              className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${PHASE_BTN[f.variant]}`}
                            >
                              {isBusy ? '…' : `${f.status} →`}
                            </button>
                          </TableCell>
                        )
                      }

                      return <TableCell key={f.key as string} className={`text-text-muted ${hide}`}>—</TableCell>
                    })}

                    {/* Inline outcome */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      {isAdmin ? (
                        <select
                          value={b.outcome ?? ''}
                          onChange={e => handleOutcomeChange(b.id, (e.target.value as BuildOutcome) || null)}
                          className="text-xs bg-surface-elevated border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
                        >
                          <option value="">—</option>
                          <option value="stopped">Stopped</option>
                          <option value="testing">Testing</option>
                          <option value="expanding">Expanding</option>
                        </select>
                      ) : b.outcome ? (
                        <Badge variant={OUTCOME_VARIANT[b.outcome]}>{b.outcome}</Badge>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>

                    <TableCell mono className={`${showClass('lg')} text-right text-text-muted`}>{b.build_days ?? '—'}</TableCell>
                    <TableCell mono className={`${showClass('lg')} text-right text-text-muted`}>{b.proof_days ?? '—'}</TableCell>
                    <TableCell mono className={`${showClass('lg')} text-right text-text-muted`}>{b.test_days ?? '—'}</TableCell>
                    <TableCell mono className="text-right text-text-muted">{b.total_days ?? '—'}</TableCell>

                    {isAdmin && (
                      <TableCell className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            href={`/qa-checklist/${b.id}`}
                            className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent-muted transition-colors"
                            title="QA checklist"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => openEdit(b)}
                            className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(b.id)}
                            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {weekBuilds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={99} className="text-center text-text-muted py-12">
                    No builds in Week {activeWeek}
                    {isAdmin && <> · <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button></>}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Stats table ── */}
        <div className="shrink-0 w-44 text-xs border border-border-subtle rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface border-b border-border-subtle">
                <th className="text-left px-3 py-2 text-text-muted font-medium">Phase</th>
                <th className="text-right px-3 py-2 text-text-muted font-medium">Wk avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {([
                ['Building',  buildAvg, settings?.build_target_days],
                ['Proofread', proofAvg, settings?.proof_target_days],
                ['Testing',   testAvg,  settings?.test_target_days],
              ] as [string, number | null, number | undefined][]).map(([label, val, tgt]) => (
                <tr key={label}>
                  <td className="px-3 py-2 text-text-secondary">{label}</td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${tgt !== undefined ? statColor(val, tgt) : 'text-foreground'}`}>
                    {val !== null ? `${val}d` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border">
                <td className="px-3 py-2 text-text-secondary font-medium">Total</td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${settings ? statColor(totalAvg, settings.total_target_days) : 'text-foreground'}`}>
                  {totalAvg !== null ? `${totalAvg}d` : '—'}
                </td>
              </tr>
              {settings && (
                <>
                  <tr className="bg-surface-elevated">
                    <td colSpan={2} className="px-3 py-1.5 text-text-muted text-[10px] uppercase tracking-wider font-medium">Target</td>
                  </tr>
                  {([
                    ['Building',  settings.build_target_days],
                    ['Proofread', settings.proof_target_days],
                    ['Testing',   settings.test_target_days],
                    ['Total',     settings.total_target_days],
                  ] as [string, number][]).map(([label, val]) => (
                    <tr key={label}>
                      <td className="px-3 py-2 text-text-muted">{label}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-muted">{val}d</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <BuildNoteModal
        build={notesBuild}
        onClose={() => setNotesBuild(null)}
        onSaved={onRefresh}
        isAdmin={isAdmin}
      />

      <BuildFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        type={type}
        mode={formMode}
        initial={editBuild ?? undefined}
        defaultWeek={activeWeek}
        saving={saving}
      />

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete build"
        message="This build and its QA checklist will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
