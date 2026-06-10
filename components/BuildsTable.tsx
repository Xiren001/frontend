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
import { ClipboardList, Layers, Pencil, Trash2, Download, Upload, FileDown, ChevronDown, Search, X } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Phase config ─────────────────────────────────────────────────────────────

const PHASE_SEQUENCE: (keyof Build)[] = [
  'phase1_start', 'phase1_end', 'into_proofread', 'proof_end', 'into_testing', 'outcome_decided',
]

const FUNNEL_PHASE_SEQUENCE: (keyof Build)[] = [
  'phase1_start', 'phase1_end', 'into_testing', 'outcome_decided',
]

const PHASE_COLS: {
  label:       string
  startKey:    keyof Build
  endKey:      keyof Build | null
  endBtnLabel: string | null
  prereq:      keyof Build | null
  variant:     'default' | 'warn' | 'accent'
  showFrom?:   'md'
}[] = [
  { label: 'Phase 1',  startKey: 'phase1_start',   endKey: 'phase1_end',      endBtnLabel: 'End Build', prereq: null,           variant: 'default' },
  { label: 'Proofread',startKey: 'into_proofread',  endKey: 'proof_end',       endBtnLabel: 'End Proof', prereq: 'phase1_end',   variant: 'warn',   showFrom: 'md' },
  { label: 'Testing',  startKey: 'into_testing',    endKey: 'outcome_decided', endBtnLabel: 'Decided',   prereq: 'proof_end',    variant: 'default', showFrom: 'md' },
  { label: 'Decided',  startKey: 'outcome_decided', endKey: null,              endBtnLabel: null,         prereq: 'into_testing', variant: 'accent', showFrom: 'md' },
]

const FUNNEL_PHASE_COLS: typeof PHASE_COLS = [
  { label: 'Phase 1',  startKey: 'phase1_start',   endKey: 'phase1_end',      endBtnLabel: 'End Build', prereq: null,           variant: 'default' },
  { label: 'Testing',  startKey: 'into_testing',    endKey: 'outcome_decided', endBtnLabel: 'Decided',   prereq: 'phase1_end',   variant: 'default', showFrom: 'md' },
  { label: 'Decided',  startKey: 'outcome_decided', endKey: null,              endBtnLabel: null,         prereq: 'into_testing', variant: 'accent', showFrom: 'md' },
]

const PHASE_KEY_INFO: Record<string, { label: string; variant: 'default' | 'warn' | 'accent' }> = {
  phase1_start:    { label: 'Building',   variant: 'default' },
  phase1_end:      { label: 'End Build',  variant: 'default' },
  into_proofread:  { label: 'Proofread',  variant: 'warn'    },
  proof_end:       { label: 'End Proof',  variant: 'warn'    },
  into_testing:    { label: 'Testing',    variant: 'default' },
  outcome_decided: { label: 'Decided',    variant: 'accent'  },
}

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

function getNextPhaseKey(b: Build, sequence: (keyof Build)[]): keyof Build | null {
  for (const key of sequence) if (!b[key]) return key
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
  phaseSequence: (keyof Build)[]
  onOpenNotes: (b: Build) => void
  onOpenEdit: (b: Build) => void
  onDelete: (id: string) => void
  onPhaseSet: (id: string, field: keyof Build) => void
  onOutcomeChange: (id: string, outcome: BuildOutcome) => void
  batchName?: string
}

function BuildCard({ b, isAdmin, advancing, phaseSequence, onOpenNotes, onOpenEdit, onDelete, onPhaseSet, onOutcomeChange, batchName }: CardProps) {
  const nextKey = getNextPhaseKey(b, phaseSequence)
  const nextInfo = nextKey ? PHASE_KEY_INFO[String(nextKey)] : null

  // Date grid: only show fields that have a value
  const dateFields = [
    { label: 'Approved',   value: b.approved_date   },
    { label: 'Build start', value: b.phase1_start    },
    { label: 'Proofread',  value: b.into_proofread  },
    { label: 'Testing',    value: b.into_testing     },
  ].filter(f => f.value)

  return (
    <div
      className="bg-surface-elevated border border-border-subtle rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors active:scale-[0.995]"
      onClick={() => onOpenNotes(b)}
    >
      {/* ── Name + admin actions ── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[15px] font-medium text-foreground leading-snug line-clamp-2 flex-1">
          {b.product_name}
        </p>
        {isAdmin && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
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

      {/* ── Badges: phase, language, week, batch ── */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PHASE_BADGE_CLS[b.phase] ?? PHASE_BADGE_CLS.pending}`}>
          {b.phase.charAt(0).toUpperCase() + b.phase.slice(1)}
        </span>
        {b.language && (
          <span className="text-xs font-mono bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary">
            {b.language}
          </span>
        )}
        {b.week_number != null && (
          <span className="text-xs font-mono bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">
            Wk {b.week_number}
          </span>
        )}
        {batchName && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border bg-accent-muted text-accent border-accent-border/60">
            <Layers className="h-2.5 w-2.5 shrink-0" />{batchName}
          </span>
        )}
      </div>

      {/* ── Date grid ── */}
      {dateFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
          {dateFields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-text-muted mb-0.5">{f.label}</p>
              <p className="font-mono text-text-secondary text-xs">{formatDate(f.value)}</p>
            </div>
          ))}
          {b.total_days !== null && (
            <div>
              <p className="text-xs text-text-muted mb-0.5">Total days</p>
              <p className="font-mono font-semibold text-foreground text-sm">{b.total_days}d</p>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: next phase action + outcome ── */}
      <div
        className="flex items-center justify-between gap-2 pt-3 border-t border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          {isAdmin && nextKey && nextInfo ? (
            <button
              onClick={() => onPhaseSet(b.id, nextKey)}
              disabled={advancing === b.id + String(nextKey)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded border transition-colors disabled:opacity-40 ${PHASE_BTN[nextInfo.variant]}`}
            >
              {advancing === b.id + String(nextKey) ? '…' : `${nextInfo.label} →`}
            </button>
          ) : (
            b.proofreader ? (
              <span className="text-xs text-text-muted truncate">{b.proofreader}</span>
            ) : null
          )}
        </div>
        {isAdmin ? (
          <select
            value={b.outcome ?? ''}
            onChange={e => onOutcomeChange(b.id, (e.target.value as BuildOutcome) || null)}
            className="text-xs bg-surface-elevated border border-border rounded px-1.5 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40 shrink-0"
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

// ── xlsx column map ───────────────────────────────────────────────────────────

const IMPORT_COLS = [
  { label: 'Product Name',    key: 'product_name',    width: 22 },
  { label: 'Language',        key: 'language',        width: 10 },
  { label: 'Week',            key: 'week_number',     width: 6  },
  { label: 'Approved Date',   key: 'approved_date',   width: 14 },
  { label: 'Phase 1 Start',   key: 'phase1_start',    width: 14 },
  { label: 'Phase 1 End',     key: 'phase1_end',      width: 14 },
  { label: 'Proof Start',     key: 'into_proofread',  width: 14 },
  { label: 'Proof End',       key: 'proof_end',       width: 14 },
  { label: 'Test Start',      key: 'into_testing',    width: 14 },
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
  month: string
  onRefresh: () => void
  isAdmin: boolean
  canBatchManage?: boolean  // management: import/export/template/batch but not add/edit/delete builds
}

export function BuildsTable({ builds, type, month, onRefresh, isAdmin, canBatchManage = false }: Props) {
  const isFunnel = type === 'funnel'
  const phaseSequence = isFunnel ? FUNNEL_PHASE_SEQUENCE : PHASE_SEQUENCE
  const phaseCols     = isFunnel ? FUNNEL_PHASE_COLS     : PHASE_COLS
  const showToolbar = isAdmin || canBatchManage
  const [activeWeek, setActiveWeek] = useState<1|2|3|4>(1)
  const [activeBatch, setActiveBatch] = useState<number | null>(null)
  const [renamingBatch, setRenamingBatch] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [grouping, setGrouping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<Settings>('/api/settings').then(setSettings).catch(() => {})
  }, [])

  const weeks = [1, 2, 3, 4]
  const weekBuilds = builds.filter(b => b.week_number === activeWeek)

  // Build batch map
  const batchMap = new Map<number, Build[]>()
  for (const b of builds) {
    if (b.batch_group != null) {
      if (!batchMap.has(b.batch_group)) batchMap.set(b.batch_group, [])
      batchMap.get(b.batch_group)!.push(b)
    }
  }
  const batchEntries = [...batchMap.entries()]
    .filter(([, bb]) => bb.some(b => b.week_number === activeWeek))
    .sort(([a], [b]) => a - b)

  function batchDisplayName(batchNum: number) {
    const batchBuilds = batchMap.get(batchNum)
    return batchBuilds?.[0]?.batch_name ?? `Batch ${batchNum}`
  }

  // When a batch is active it overrides the week filter — show all builds in that batch
  const displayBuilds = activeBatch !== null ? (batchMap.get(activeBatch) ?? []) : weekBuilds

  // Clear selection and search when week or batch changes
  useEffect(() => { setSelectedIds(new Set()); setSearchQuery('') }, [activeWeek, activeBatch])

  // Clear active batch if it doesn't belong to the current week
  useEffect(() => {
    if (activeBatch !== null && !batchEntries.some(([n]) => n === activeBatch)) {
      setActiveBatch(null)
    }
  }, [activeWeek])

  const bq = searchQuery.trim().toLowerCase()
  const filteredBuilds = bq
    ? displayBuilds.filter(b =>
        b.product_name.toLowerCase().includes(bq) ||
        (b.language ?? '').toLowerCase().includes(bq) ||
        (b.proofreader ?? '').toLowerCase().includes(bq)
      )
    : displayBuilds

  const buildAvg = avgNum(displayBuilds.map(b => b.build_days))
  const proofAvg = avgNum(displayBuilds.map(b => b.proof_days))
  const testAvg  = avgNum(displayBuilds.map(b => b.test_days))
  const totalAvg = avgNum(displayBuilds.map(b => b.total_days))

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

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/api/builds/${id}`)))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      onRefresh()
    } finally { setBulkDeleting(false) }
  }

  async function handleGroupAsBatch() {
    setGrouping(true)
    try {
      const existing = builds.map(b => b.batch_group).filter((n): n is number => n != null)
      const nextBatch = existing.length > 0 ? Math.max(...existing) + 1 : 1
      await Promise.all([...selectedIds].map(id => api.put(`/api/builds/${id}`, { batch_group: nextBatch })))
      setSelectedIds(new Set())
      onRefresh()
    } finally { setGrouping(false) }
  }

  async function handleUngroup(batchNum: number) {
    const toUngroup = builds.filter(b => b.batch_group === batchNum)
    await Promise.all(toUngroup.map(b => api.put(`/api/builds/${b.id}`, { batch_group: null, batch_name: null })))
    if (activeBatch === batchNum) setActiveBatch(null)
    onRefresh()
  }

  async function handleRemoveFromBatch() {
    if (activeBatch === null) return
    setGrouping(true)
    try {
      await Promise.all([...selectedIds].map(id =>
        api.put(`/api/builds/${id}`, { batch_group: null, batch_name: null })
      ))
      setSelectedIds(new Set())
      const remaining = builds.filter(b => b.batch_group === activeBatch && !selectedIds.has(b.id))
      if (remaining.length === 0) setActiveBatch(null)
      onRefresh()
    } finally { setGrouping(false) }
  }

  async function handleRenameCommit() {
    if (renamingBatch === null) return
    const toRename = builds.filter(b => b.batch_group === renamingBatch)
    const newName = renameValue.trim() || null
    await Promise.all(toRename.map(b => api.put(`/api/builds/${b.id}`, { batch_name: newName })))
    setRenamingBatch(null)
    onRefresh()
  }

  function startRename(batchNum: number) {
    if (!isAdmin) return
    setRenamingBatch(batchNum)
    setRenameValue(batchDisplayName(batchNum))
    setTimeout(() => renameInputRef.current?.select(), 10)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === filteredBuilds.length
        ? new Set()
        : new Set(filteredBuilds.map(b => b.id))
    )
  }

  async function handlePhaseSet(buildId: string, field: keyof Build) {
    setAdvancing(buildId + String(field))
    try {
      await api.put(`/api/builds/${buildId}`, { [field]: new Date().toISOString().split('T')[0] })
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
    const rows = builds.map(b => allCols.map(c => b[c.key as keyof Build] ?? ''))
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = allCols.map((c, i) => ({ wch: i < IMPORT_COLS.length ? (IMPORT_COLS[i] as { width: number }).width : 10 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Builds')
    XLSX.writeFile(wb, `${type}-builds-${month}.xlsx`)
  }

  function handleTemplateDownload() {
    const headers = IMPORT_COLS.map(c => c.label)
    const example = [
      'Example Product', 'EN', 1,
      '2026-06-01', '2026-06-02', '2026-06-05', '2026-06-07',
      '2026-06-14', '2026-06-16', '2026-06-20',
      'expanding', 'Jane', 'Optional note here',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = IMPORT_COLS.map(c => ({ wch: c.width }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `${type}-import-template.xlsx`)
  }

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

      let ok = 0; let err = 0
      for (const row of raw.slice(1)) {
        const r = row as unknown[]
        const productName = r[colIdx('product name')]?.toString().trim()
        if (!productName) continue
        const outcome = r[colIdx('outcome')]?.toString().trim() as Build['outcome'] | undefined
        const build = {
          type, month_year: `${month}-01`, product_name: productName,
          language:        r[colIdx('language')]?.toString().trim() || null,
          week_number:     Number(r[colIdx('week')]) || 1,
          approved_date:   toDateStr(r[colIdx('approved date')]),
          phase1_start:    toDateStr(r[colIdx('phase 1 start')]),
          phase1_end:      toDateStr(r[colIdx('phase 1 end')]),
          into_proofread:  toDateStr(r[colIdx('proof start')]),
          proof_end:       toDateStr(r[colIdx('proof end')]),
          into_testing:    toDateStr(r[colIdx('test start')]),
          outcome_decided: toDateStr(r[colIdx('outcome decided')]),
          outcome: outcome || null,
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

  // ── Batch sub-tab row ──────────────────────────────────────────────────────

  const BatchSubTabs = () => {
    if (batchEntries.length === 0) return null
    return (
      <div className="border-t border-border-subtle pt-2 pb-1">
        {/* Label row */}
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-xs text-text-muted font-medium">Batches</span>
          </div>
          {activeBatch !== null && isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => handleUngroup(activeBatch)}>
              Ungroup
            </Button>
          )}
        </div>

        {/* Pills — horizontal scroll on mobile, wrap on desktop */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 no-scrollbar md:flex-wrap md:overflow-x-visible">
          {batchEntries.map(([batchNum, batchBuilds]) => {
            const name = batchDisplayName(batchNum)
            const isActive = activeBatch === batchNum
            const isRenaming = renamingBatch === batchNum
            const count = batchBuilds.length
            return (
              <div key={batchNum} className="shrink-0">
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={handleRenameCommit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleRenameCommit() }
                      if (e.key === 'Escape') setRenamingBatch(null)
                    }}
                    className="text-xs px-2.5 py-2 rounded-lg border border-accent/60 bg-surface-elevated text-foreground w-32 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                ) : (
                  <div className={cn(
                    'flex items-center rounded-lg border transition-colors',
                    isActive
                      ? 'bg-accent-muted border-accent-border'
                      : 'border-border-subtle hover:border-border hover:bg-surface-hover',
                  )}>
                    <button
                      onClick={() => setActiveBatch(isActive ? null : batchNum)}
                      className={cn(
                        'flex items-center gap-2 text-xs font-medium px-3 py-2 select-none',
                        isActive ? 'text-accent' : 'text-text-secondary',
                      )}
                    >
                      {name}
                      <span className={cn(
                        'text-[10px] tabular-nums px-1.5 py-0.5 rounded-full font-normal',
                        isActive
                          ? 'bg-accent/20 text-accent'
                          : 'bg-surface text-text-muted',
                      )}>
                        {count}
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => startRename(batchNum)}
                        title="Rename"
                        className={cn(
                          'pr-2.5 pl-0.5 py-2 rounded-r-lg transition-colors',
                          isActive
                            ? 'text-accent/60 hover:text-accent'
                            : 'text-text-muted hover:text-foreground',
                        )}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Mobile: search ── */}
      <div className="relative md:hidden">
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

      {/* ── Mobile: week select + actions menu ── */}
      <div className="flex items-center gap-2 md:hidden">
        <select
          value={activeWeek}
          onChange={e => { setActiveWeek(Number(e.target.value) as 1|2|3|4); setActiveBatch(null) }}
          className={cn(SELECT_CLS, 'flex-1 min-w-0')}
          aria-label="Select week"
        >
          {tabs.map(tab => (
            <option key={tab.id} value={tab.id}>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </option>
          ))}
        </select>
        {showToolbar && (
          <details className="relative shrink-0">
            <summary className="flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Actions
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-md border border-border bg-surface-elevated py-1 shadow-lg">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                onClick={e => { closeActionsMenu(e); handleTemplateDownload() }}>
                <FileDown className="h-3.5 w-3.5 text-text-muted" />Template
              </button>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                disabled={importing} onClick={e => { closeActionsMenu(e); fileInputRef.current?.click() }}>
                <Upload className="h-3.5 w-3.5 text-text-muted" />{importing ? 'Importing…' : 'Import'}
              </button>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                onClick={e => { closeActionsMenu(e); handleExport() }}>
                <Download className="h-3.5 w-3.5 text-text-muted" />Export
              </button>
              {isAdmin && (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover border-t border-border-subtle mt-1 pt-2"
                  onClick={e => { closeActionsMenu(e); openCreate() }}>
                  + Add build
                </button>
              )}
              {selectedIds.size > 0 && activeBatch === null && (
                <button type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover border-t border-border-subtle mt-1 pt-2"
                  disabled={grouping} onClick={e => { closeActionsMenu(e); handleGroupAsBatch() }}>
                  <Layers className="h-3.5 w-3.5 text-text-muted" />{grouping ? 'Grouping…' : `Batch ${selectedIds.size}`}
                </button>
              )}
              {selectedIds.size > 0 && activeBatch !== null && (
                <button type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover border-t border-border-subtle mt-1 pt-2"
                  disabled={grouping} onClick={e => { closeActionsMenu(e); handleRemoveFromBatch() }}>
                  <Layers className="h-3.5 w-3.5 text-text-muted" />{grouping ? 'Removing…' : `Remove from ${batchDisplayName(activeBatch)}`}
                </button>
              )}
              {isAdmin && selectedIds.size > 0 && activeBatch === null && (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-muted"
                  onClick={e => { closeActionsMenu(e); setBulkDeleteOpen(true) }}>
                  <Trash2 className="h-3.5 w-3.5" />Delete {selectedIds.size} selected
                </button>
              )}
            </div>
          </details>
        )}
      </div>

      {/* ── Desktop: week tabs + toolbar ── */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <Tabs
          tabs={tabs}
          active={activeWeek}
          onChange={id => { setActiveWeek(Number(id) as 1|2|3|4); setActiveBatch(null) }}
          className="flex-1"
        />
        {showToolbar && (
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
            {selectedIds.size > 0 && activeBatch === null && (
              <Button variant="secondary" size="sm" onClick={handleGroupAsBatch} disabled={grouping}>
                <Layers className="h-3.5 w-3.5 mr-1.5" />{grouping ? 'Grouping…' : `Batch ${selectedIds.size}`}
              </Button>
            )}
            {selectedIds.size > 0 && activeBatch !== null && (
              <Button variant="secondary" size="sm" onClick={handleRemoveFromBatch} disabled={grouping}>
                {grouping ? 'Removing…' : `Remove from ${batchDisplayName(activeBatch)}`}
              </Button>
            )}
            {isAdmin && selectedIds.size > 0 && activeBatch === null && (
              <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete {selectedIds.size}
              </Button>
            )}
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={openCreate}>
                + Add build
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: search bar ── */}
      <div className="hidden md:block relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by product, language, or proofreader…"
          className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Batch sub-tabs (below week tabs, both mobile + desktop) ── */}
      <BatchSubTabs />

      {isAdmin && (
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
      )}

      {/* ── Builds (filtered by batch pill or week tab) ── */}
      <>
        {/* Mobile card layout */}
        <div className="block md:hidden space-y-3">
          {filteredBuilds.length === 0 && (
            <p className="text-sm text-text-muted text-center py-10">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : activeBatch !== null ? 'No builds in this batch.' : `No builds in Week ${activeWeek}`}
              {isAdmin && !searchQuery && activeBatch === null && <> · <button onClick={openCreate} className="text-accent hover:text-accent-bright">Add one</button></>}
            </p>
          )}
          {filteredBuilds.map(b => (
            <BuildCard
              key={b.id}
              b={b}
              isAdmin={isAdmin}
              advancing={advancing}
              phaseSequence={phaseSequence}
              onOpenNotes={setNotesBuild}
              onOpenEdit={openEdit}
              onDelete={setDeleteId}
              onPhaseSet={handlePhaseSet}
              onOutcomeChange={handleOutcomeChange}
              batchName={b.batch_group != null ? batchDisplayName(b.batch_group) : undefined}
            />
          ))}
        </div>

          {/* Desktop table layout */}
          <div className="hidden md:flex items-start gap-1">
            <div className="flex-1 overflow-x-auto min-w-0">
              <Table>
                <TableHead>
                  <TableRow>
                    {isAdmin && (
                      <TableHeader className="w-8 pr-0">
                        <input
                          type="checkbox"
                          checked={filteredBuilds.length > 0 && selectedIds.size === filteredBuilds.length}
                          ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredBuilds.length }}
                          onChange={toggleSelectAll}
                          className="cursor-pointer accent-accent"
                        />
                      </TableHeader>
                    )}
                    <TableHeader>Product</TableHeader>
                    <TableHeader className={`${showClass('md')} whitespace-nowrap`}>Approved</TableHeader>
                    {phaseCols.map(col => (
                      <TableHeader key={col.label} className={`whitespace-nowrap ${showClass(col.showFrom)}`}>
                        {col.label}
                      </TableHeader>
                    ))}
                    <TableHeader>Outcome</TableHeader>
                    <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Build d</TableHeader>
                    {!isFunnel && <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Proof d</TableHeader>}
                    <TableHeader className={`${showClass('lg')} text-right whitespace-nowrap`}>Test d</TableHeader>
                    <TableHeader className="text-right whitespace-nowrap">Total d</TableHeader>
                    {isAdmin && <TableHeader />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredBuilds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={99} className="text-center text-text-muted py-12">
                        {searchQuery ? `No results for "${searchQuery}"` : activeBatch !== null ? 'No builds in this batch.' : `No builds in Week ${activeWeek}`}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredBuilds.map(b => (
                    <TableRow
                      key={b.id}
                      className={cn('cursor-pointer', selectedIds.has(b.id) && 'bg-accent-muted/30')}
                      onClick={() => setNotesBuild(b)}
                    >
                      {isAdmin && (
                        <TableCell className="pr-0 w-8" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            className="cursor-pointer accent-accent"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-foreground" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-0.5">
                          <MarqueeName name={b.product_name} className="max-w-[180px]" />
                          {b.language && (
                            <span className="text-[11px] font-mono text-text-muted">{b.language}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell mono className={`${showClass('md')} whitespace-nowrap`}>
                        {formatDate(b.approved_date)}
                      </TableCell>

                      {phaseCols.map(col => {
                        const hide = showClass(col.showFrom)
                        const startVal = b[col.startKey] as string | null
                        const endVal = col.endKey ? b[col.endKey] as string | null : null

                        if (!col.endKey) {
                          return (
                            <TableCell key={col.label} className={`${hide} whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                              {startVal ? (
                                <span className="font-mono text-xs text-foreground">{formatDate(startVal)}</span>
                              ) : isAdmin && (!col.prereq || !!b[col.prereq]) ? (
                                <button
                                  onClick={() => handlePhaseSet(b.id, col.startKey)}
                                  disabled={advancing === b.id + String(col.startKey)}
                                  className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${PHASE_BTN[col.variant]}`}
                                >
                                  {advancing === b.id + String(col.startKey) ? '…' : `${col.label} →`}
                                </button>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </TableCell>
                          )
                        }

                        return (
                          <TableCell key={col.label} className={`${hide} whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-0.5 min-w-[88px]">
                              <div>
                                {startVal ? (
                                  <span className="font-mono text-xs text-foreground">{formatDate(startVal)}</span>
                                ) : isAdmin && (!col.prereq || !!b[col.prereq]) ? (
                                  <button
                                    onClick={() => handlePhaseSet(b.id, col.startKey)}
                                    disabled={advancing === b.id + String(col.startKey)}
                                    className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${PHASE_BTN[col.variant]}`}
                                  >
                                    {advancing === b.id + String(col.startKey) ? '…' : `${col.label} →`}
                                  </button>
                                ) : (
                                  <span className="font-mono text-xs text-text-muted">—</span>
                                )}
                              </div>
                              {startVal && (
                                <div>
                                  {endVal ? (
                                    <span className="font-mono text-xs text-text-muted">{formatDate(endVal)}</span>
                                  ) : isAdmin ? (
                                    <button
                                      onClick={() => handlePhaseSet(b.id, col.endKey!)}
                                      disabled={advancing === b.id + String(col.endKey)}
                                      className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${PHASE_BTN[col.variant]}`}
                                    >
                                      {advancing === b.id + String(col.endKey) ? '…' : `${col.endBtnLabel} →`}
                                    </button>
                                  ) : (
                                    <span className="font-mono text-xs text-text-muted">—</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        )
                      })}

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
                      {!isFunnel && <TableCell mono className={`${showClass('lg')} text-right text-text-muted`}>{b.proof_days ?? '—'}</TableCell>}
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
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Stats table */}
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
                    ...(!isFunnel ? [['Proofread', proofAvg, settings?.proof_target_days] as [string, number | null, number | undefined]] : []),
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
                        ...(!isFunnel ? [['Proofread', settings.proof_target_days] as [string, number]] : []),
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
        </>

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

      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} build${selectedIds.size !== 1 ? 's' : ''}`}
        message={`This will permanently delete ${selectedIds.size} build${selectedIds.size !== 1 ? 's' : ''} and their QA checklists. This cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size}`}
        loading={bulkDeleting}
      />
    </div>
  )
}
