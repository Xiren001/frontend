'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal, FormField } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Pencil, Trash2, Plus, ExternalLink, Languages, ArrowLeft, ChevronRight } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { translateSeverity, translateIssueType, translateLocation, UI } from '@/lib/proof-translations'

interface ProofProduct {
  id: string
  language: string | null
  proofreader: string | null
  product_name: string
  pdp_url: string | null
  drive_folder: string | null
  done: boolean
  ready_for_revision: boolean
  created_at: string
  updated_at: string
  correction_count: number
}

type CorrectionSource = 'website' | 'ads'

interface ProofCorrection {
  id: string
  product_id: string
  source: CorrectionSource | null
  location: string | null
  original_text: string | null
  corrected_text: string | null
  issue_type: string | null
  severity: string | null
  notes: string | null
  done: boolean
  created_at: string
}

const SELECT_CLS = 'w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'

function emptyProductForm(): Partial<ProofProduct> {
  return { language: 'ES', proofreader: '', product_name: '', pdp_url: '', drive_folder: '', done: false, ready_for_revision: false }
}

function emptyCorrectionForm(): Partial<ProofCorrection> {
  return { source: null, location: '', original_text: '', corrected_text: '', issue_type: '', severity: '', notes: '', done: false }
}

function normSeverity(s: string | null) {
  if (!s) return ''
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null
  const n = normSeverity(severity)
  if (n.includes('crit') || n === 'high') return <Badge variant="danger">{severity}</Badge>
  if (n.includes('med')) return <Badge variant="warn">{severity}</Badge>
  return <Badge variant="muted">{severity}</Badge>
}

function severityBorder(severity: string | null) {
  const n = normSeverity(severity)
  if (n.includes('crit') || n === 'high') return 'border-l-danger'
  if (n.includes('med')) return 'border-l-yellow-500'
  return 'border-l-border-subtle'
}

export default function CopyReviewPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'

  const [products, setProducts] = useState<ProofProduct[]>([])
  const [langFilter, setLangFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Record<string, ProofCorrection[]>>({})

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProofProduct | null>(null)
  const [productForm, setProductForm] = useState<Partial<ProofProduct>>(emptyProductForm())
  const [savingProduct, setSavingProduct] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // Correction modal
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false)
  const [editCorrection, setEditCorrection] = useState<ProofCorrection | null>(null)
  const [correctionProductId, setCorrectionProductId] = useState<string | null>(null)
  const [correctionForm, setCorrectionForm] = useState<Partial<ProofCorrection>>(emptyCorrectionForm())
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [deleteCorrectionId, setDeleteCorrectionId] = useState<string | null>(null)
  const [deletingCorrection, setDeletingCorrection] = useState(false)
  const [sourceTab, setSourceTab] = useState<CorrectionSource>('website')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  // Setup gate
  const [setupForm, setSetupForm] = useState({ pdp_url: '', drive_folder: '' })
  const [savingSetup, setSavingSetup] = useState(false)

  // Translation
  const [isTranslated, setIsTranslated] = useState(false)

  const loadProducts = useCallback(() => {
    api.get<ProofProduct[]>('/api/proof-corrections/products').then(setProducts).catch(console.error)
  }, [])

  const loadCorrections = useCallback((productId: string) => {
    api.get<ProofCorrection[]>(`/api/proof-corrections/products/${productId}/corrections`)
      .then(data => setCorrections(prev => ({ ...prev, [productId]: data })))
      .catch(console.error)
  }, [])

  useRealtimeRefresh(['proof_products', 'proof_corrections'], () => {
    loadProducts()
    if (selectedId) loadCorrections(selectedId)
  })

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { setMobileDetailOpen(false) }, [langFilter])

  // Derive unique language tabs dynamically from all products
  const uniqueLangs = Array.from(new Set(products.map(p => p.language).filter(Boolean))).sort() as string[]
  const langTabs = [
    { id: 'all', label: 'All', count: products.length },
    ...uniqueLangs.map(lang => ({
      id: lang,
      label: lang,
      count: products.filter(p => p.language === lang).length,
    })),
  ]

  const visible = products.filter(p => langFilter === 'all' || p.language === langFilter)
  const selectedProduct = visible.find(p => p.id === selectedId) ?? null
  const selectedCorrections = selectedId ? (corrections[selectedId] ?? []) : []

  useEffect(() => {
    if (visible.length === 0) { setSelectedId(null); return }
    setSelectedId(prev => (prev && visible.some(p => p.id === prev) ? prev : visible[0].id))
  }, [products, langFilter])

  useEffect(() => {
    if (selectedId && corrections[selectedId] === undefined) loadCorrections(selectedId)
  }, [selectedId, loadCorrections])

  useEffect(() => {
    if (!selectedId) return
    const p = products.find(x => x.id === selectedId)
    if (p) setSetupForm({ pdp_url: p.pdp_url ?? '', drive_folder: p.drive_folder ?? '' })
  }, [selectedId, products])

  function selectProduct(id: string) {
    setSelectedId(id)
    if (corrections[id] === undefined) loadCorrections(id)
  }

  async function toggleProductDone(product: ProofProduct) {
    if (!isAdmin) return
    await api.put(`/api/proof-corrections/products/${product.id}`, { done: !product.done })
    loadProducts()
  }

  async function toggleReadyForRevision(product: ProofProduct) {
    if (!isAdmin) return
    await api.put(`/api/proof-corrections/products/${product.id}`, { ready_for_revision: !product.ready_for_revision })
    loadProducts()
  }

  async function toggleCorrectionDone(correction: ProofCorrection) {
    if (!isAdmin) return
    await api.put(`/api/proof-corrections/corrections/${correction.id}`, { done: !correction.done })
    loadCorrections(correction.product_id)
  }

  function openCreateProduct() {
    setEditProduct(null); setProductForm(emptyProductForm()); setProductModalOpen(true)
  }
  function openEditProduct(p: ProofProduct) {
    setEditProduct(p); setProductForm({ ...p }); setProductModalOpen(true)
  }

  async function handleSaveProduct() {
    if (!productForm.product_name?.trim()) return
    setSavingProduct(true)
    try {
      if (editProduct) {
        await api.put(`/api/proof-corrections/products/${editProduct.id}`, productForm)
      } else {
        await api.post('/api/proof-corrections/products', productForm)
      }
      setProductModalOpen(false)
      loadProducts()
    } finally { setSavingProduct(false) }
  }

  async function handleDeleteProduct() {
    if (!deleteProductId) return
    setDeletingProduct(true)
    try {
      await api.delete(`/api/proof-corrections/products/${deleteProductId}`)
      setDeleteProductId(null)
      loadProducts()
    } finally { setDeletingProduct(false) }
  }

  function openCreateCorrection(productId: string, source?: CorrectionSource | null) {
    setEditCorrection(null); setCorrectionProductId(productId)
    setCorrectionForm({ ...emptyCorrectionForm(), source: source ?? null }); setCorrectionModalOpen(true)
  }
  function openEditCorrection(c: ProofCorrection) {
    setEditCorrection(c); setCorrectionProductId(c.product_id)
    setCorrectionForm({ ...c }); setCorrectionModalOpen(true)
  }

  async function handleSaveCorrection() {
    setSavingCorrection(true)
    try {
      if (editCorrection) {
        await api.put(`/api/proof-corrections/corrections/${editCorrection.id}`, correctionForm)
        loadCorrections(editCorrection.product_id)
      } else if (correctionProductId) {
        await api.post('/api/proof-corrections/corrections', { ...correctionForm, product_id: correctionProductId })
        loadCorrections(correctionProductId)
        loadProducts()
      }
      setCorrectionModalOpen(false)
    } finally { setSavingCorrection(false) }
  }

  async function handleDeleteCorrection() {
    if (!deleteCorrectionId) return
    setDeletingCorrection(true)
    try {
      const productId = Object.entries(corrections).find(([, list]) =>
        list.some(c => c.id === deleteCorrectionId)
      )?.[0]
      await api.delete(`/api/proof-corrections/corrections/${deleteCorrectionId}`)
      setDeleteCorrectionId(null)
      if (productId) loadCorrections(productId)
      loadProducts()
    } finally { setDeletingCorrection(false) }
  }

  async function handleSetupSave() {
    if (!selectedProduct || !setupForm.pdp_url || !setupForm.drive_folder) return
    setSavingSetup(true)
    try {
      await api.put(`/api/proof-corrections/products/${selectedProduct.id}`, {
        pdp_url:      setupForm.pdp_url,
        drive_folder: setupForm.drive_folder,
      })
      loadProducts()
    } finally { setSavingSetup(false) }
  }

  function handleTranslate() { setIsTranslated(v => !v) }

  const uiLang = isTranslated ? 'EN' : ((selectedProduct?.language === 'DE' ? 'DE' : 'ES') as 'ES' | 'DE' | 'EN')
  const L = UI[uiLang]

  function productGroup(p: ProofProduct): 0 | 1 | 2 | 3 | 4 {
    if (p.done) return 4
    if (!p.pdp_url || !p.drive_folder) return 3
    if (p.ready_for_revision) return 2
    if (p.correction_count === 0) return 0
    return 1
  }

  const sortedVisible = [...visible].sort((a, b) => {
    const diff = productGroup(a) - productGroup(b)
    return diff !== 0 ? diff : a.product_name.localeCompare(b.product_name)
  })

  const GROUP_LABELS: Record<number, string> = {
    0: 'No corrections',
    1: 'Has corrections',
    2: 'Ready for revision',
    3: 'Needs links',
    4: 'Done',
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-4rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Proofreading"
          description="Proofreading corrections per product — text changes to product pages and ads."
          actions={isAdmin ? (
            <Button variant="secondary" size="sm" onClick={openCreateProduct}>+ Add product</Button>
          ) : undefined}
        />
      </div>

      {/* Language tabs — above the split pane, dynamically generated */}
      <div className="shrink-0 border-b border-border-subtle mb-0">
        <Tabs
          tabs={langTabs}
          active={langFilter}
          onChange={id => setLangFilter(String(id))}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-text-muted py-12 text-center">
          No products yet.{isAdmin && (
            <> <button onClick={openCreateProduct} className="text-accent hover:text-accent-bright">Add one</button></>
          )}
        </p>
      ) : (
        <div className="md:flex-1 md:flex md:overflow-hidden border border-border-subtle rounded-b-lg border-t-0">

          {/* ── Left: product list ── */}
          <aside className={cn(
            'shrink-0 flex-col md:border-r border-border-subtle bg-surface-elevated/20',
            'w-full md:w-64 xl:md:w-72',
            mobileDetailOpen ? 'hidden md:flex' : 'flex',
          )}>
            <ul className="md:flex-1 md:overflow-y-auto">
              {sortedVisible.map((p, idx) => {
                const isSelected = p.id === selectedId
                const doneCnt    = corrections[p.id]?.filter(c => c.done).length ?? null
                const group      = productGroup(p)
                const isReady    = group === 2
                const noLinks    = group === 3
                const prevGroup  = idx > 0 ? productGroup(sortedVisible[idx - 1]) : -1
                const showHeader = group !== prevGroup
                return (
                  <li key={p.id}>
                    {showHeader && (
                      <div className={cn(
                        'px-3 py-1.5 border-y border-border-subtle',
                        isReady  ? 'bg-green-500/5'  :
                        noLinks  ? 'bg-yellow-500/5' : 'bg-surface-elevated/30',
                      )}>
                        <p className={cn(
                          'text-[10px] font-semibold uppercase tracking-widest',
                          isReady  ? 'text-green-500/70'  :
                          noLinks  ? 'text-yellow-500/70' : 'text-text-muted',
                        )}>
                          {GROUP_LABELS[group]}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { selectProduct(p.id); setMobileDetailOpen(true) }}
                      className={cn(
                        'w-full text-left px-3 py-3 transition-colors border-l-2',
                        isSelected
                          ? 'bg-accent-muted/40 border-l-accent'
                          : isReady
                            ? 'bg-green-500/[0.04] hover:bg-green-500/10 border-l-transparent'
                          : noLinks
                            ? 'bg-yellow-500/[0.04] hover:bg-yellow-500/10 border-l-transparent'
                            : 'hover:bg-surface-hover/50 border-l-transparent',
                      )}
                    >
                      <p className={cn(
                        'text-sm font-medium leading-snug line-clamp-2',
                        p.done ? 'text-text-muted line-through' : 'text-foreground',
                      )}>
                        {p.product_name}
                      </p>
                      {p.proofreader && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">{p.proofreader}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <div className="flex items-center gap-1">
                          {langFilter === 'all' && p.language && <Badge variant="accent">{p.language}</Badge>}
                          {p.done && <Badge variant="muted">Done</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            'text-[10px] font-mono',
                            p.correction_count > 0 ? 'text-text-secondary' : 'text-text-muted',
                          )}>
                            {doneCnt !== null
                              ? `${doneCnt}/${p.correction_count}`
                              : `${p.correction_count}`
                            }
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-text-muted md:hidden" />
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* ── Right: selected product ── */}
          <section className={cn(
            'flex-1 flex-col min-w-0 bg-background md:overflow-hidden',
            mobileDetailOpen ? 'flex' : 'hidden md:flex',
          )}>

            {/* Mobile: back to list */}
            <div className="shrink-0 flex items-center gap-3 h-12 px-4 border-b border-border-subtle bg-surface-elevated/20 md:hidden">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground truncate">
                {selectedProduct?.product_name ?? ''}
              </span>
            </div>

            {!selectedProduct && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-text-muted">{UI['EN'].selectProduct}</p>
              </div>
            )}

            {selectedProduct && (!selectedProduct.pdp_url || !selectedProduct.drive_folder) && (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="w-full max-w-sm space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{selectedProduct.product_name}</h3>
                    <p className="text-xs text-text-muted">
                      Add the PDP and Drive folder links before corrections can be entered.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">PDP URL</label>
                      <Input
                        value={setupForm.pdp_url}
                        onChange={e => setSetupForm(f => ({ ...f, pdp_url: e.target.value }))}
                        placeholder="https://thenivora.es/products/…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Drive folder (ADS)</label>
                      <Input
                        value={setupForm.drive_folder}
                        onChange={e => setSetupForm(f => ({ ...f, drive_folder: e.target.value }))}
                        placeholder="https://drive.google.com/drive/folders/…"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSetupSave}
                    disabled={savingSetup || !setupForm.pdp_url || !setupForm.drive_folder}
                    className="w-full"
                  >
                    {savingSetup ? 'Saving…' : 'Save & start reviewing'}
                  </Button>
                </div>
              </div>
            )}

            {selectedProduct && selectedProduct.pdp_url && selectedProduct.drive_folder && (
              <>
                <div className="shrink-0 px-5 py-4 border-b border-border-subtle">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-foreground leading-snug">
                        {selectedProduct.product_name}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {selectedProduct.language && <Badge variant="accent">{selectedProduct.language}</Badge>}
                        {selectedProduct.proofreader && (
                          <span className="text-xs text-text-muted">{selectedProduct.proofreader}</span>
                        )}
                        {selectedProduct.done && <Badge variant="muted">Done</Badge>}
                        <span className="text-xs text-text-muted font-mono">
                          {L.resolvedOf(selectedCorrections.filter(c => c.done).length, selectedProduct.correction_count)}
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => toggleReadyForRevision(selectedProduct)}
                          className={cn(
                            'px-2 py-1.5 rounded text-xs transition-colors',
                            selectedProduct.ready_for_revision
                              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              : 'text-text-muted hover:text-foreground hover:bg-surface-hover',
                          )}
                        >
                          {selectedProduct.ready_for_revision ? '↩ Unmark' : '✓ Ready'}
                        </button>
                        <button
                          onClick={() => toggleProductDone(selectedProduct)}
                          className="px-2 py-1.5 rounded text-xs text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                        >
                          {selectedProduct.done ? '↩ Reopen' : '✓ Done'}
                        </button>
                        <button
                          onClick={() => openEditProduct(selectedProduct)}
                          className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteProductId(selectedProduct.id)}
                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <a
                      href={selectedProduct.pdp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />PDP
                    </a>
                    <a
                      href={selectedProduct.drive_folder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />Drive folder
                    </a>
                    <button
                      onClick={handleTranslate}
                      className={cn(
                        'ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors',
                        isTranslated
                          ? 'bg-accent-muted text-accent-bright border-accent-border/50'
                          : 'text-text-muted border-border-subtle hover:text-foreground hover:border-border',
                      )}
                    >
                      <Languages className="h-3.5 w-3.5" />
                      {isTranslated ? 'EN' : L.translateBtn}
                    </button>
                  </div>
                </div>

                {(() => {
                  const websiteCnt = selectedCorrections.filter(c => c.source === 'website').length
                  const adsCnt     = selectedCorrections.filter(c => c.source === 'ads').length
                  const tabItems   = [
                    { id: 'website', label: 'Website', count: websiteCnt },
                    { id: 'ads',     label: 'ADS',     count: adsCnt     },
                  ]
                  const tabCorrections = selectedCorrections.filter(c => c.source === sourceTab)
                  return (
                    <>
                      <div className="shrink-0 px-5 border-b border-border-subtle flex items-center justify-between">
                        <Tabs tabs={tabItems} active={sourceTab} onChange={v => setSourceTab(v as CorrectionSource)} />
                        {isAdmin && (
                          <button
                            onClick={() => openCreateCorrection(selectedProduct.id, sourceTab)}
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground transition-colors pb-1"
                          >
                            <Plus className="h-3.5 w-3.5" />Add
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto">
                        {tabCorrections.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                            <p className="text-sm text-text-muted">
                              {sourceTab === 'website' ? L.noWebsite : L.noAds}
                            </p>
                            {isAdmin && (
                              <Button variant="secondary" size="sm" onClick={() => openCreateCorrection(selectedProduct.id, sourceTab)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />{L.addCorrection}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-border-subtle">
                            {tabCorrections.map((c, i) => {
                              const loc      = isTranslated ? translateLocation(c.location)    : c.location
                              const issueTyp = isTranslated ? translateIssueType(c.issue_type) : c.issue_type
                              const sev      = isTranslated ? translateSeverity(c.severity)    : c.severity
                              return (
                                <div
                                  key={c.id}
                                  className={cn(
                                    'px-5 py-4 border-l-[3px] transition-opacity',
                                    severityBorder(c.severity),
                                    c.done && 'opacity-50',
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0 space-y-2.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-mono text-text-muted bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5">
                                          #{i + 1}
                                        </span>
                                        {loc && (
                                          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{loc}</span>
                                        )}
                                      </div>

                                      {c.original_text && (
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{L.before}</p>
                                          <p className="text-sm text-text-secondary leading-relaxed line-through decoration-text-muted/50">
                                            {c.original_text}
                                          </p>
                                        </div>
                                      )}

                                      {c.corrected_text && (
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{L.after}</p>
                                          <p className="text-sm text-foreground font-medium leading-relaxed">
                                            {c.corrected_text}
                                          </p>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                        {issueTyp && <Badge variant="default">{issueTyp}</Badge>}
                                        <SeverityBadge severity={sev} />
                                        {c.done && <Badge variant="muted">{L.resolved}</Badge>}
                                      </div>

                                      {c.notes && (
                                        <p className="text-xs text-text-muted italic border-l-2 border-border-subtle pl-2">
                                          {c.notes}
                                        </p>
                                      )}
                                    </div>

                                    {isAdmin && (
                                      <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                                        <button
                                          onClick={() => toggleCorrectionDone(c)}
                                          className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-xs"
                                          title={c.done ? 'Reopen' : 'Mark resolved'}
                                        >
                                          {c.done ? '↩' : '✓'}
                                        </button>
                                        <button
                                          onClick={() => openEditCorrection(c)}
                                          className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setDeleteCorrectionId(c.id)}
                                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </>
            )}
          </section>
        </div>
      )}

      {/* Product modal */}
      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editProduct ? 'Edit product' : 'Add product'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setProductModalOpen(false)} disabled={savingProduct}>Cancel</Button>
            <Button size="sm" onClick={handleSaveProduct} disabled={savingProduct || !productForm.product_name?.trim()}>
              {savingProduct ? 'Saving…' : editProduct ? 'Save changes' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Product name">
            <Input
              value={productForm.product_name ?? ''}
              onChange={e => setProductForm(f => ({ ...f, product_name: e.target.value }))}
              placeholder="e.g. Gold Necklace XYZ"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Language">
              <Input
                value={productForm.language ?? ''}
                onChange={e => setProductForm(f => ({ ...f, language: e.target.value.toUpperCase() }))}
                placeholder="e.g. ES, DE, FR"
                maxLength={5}
              />
            </FormField>

            <FormField label="Proofreader">
              <Input
                value={productForm.proofreader ?? ''}
                onChange={e => setProductForm(f => ({ ...f, proofreader: e.target.value }))}
                placeholder="Name"
              />
            </FormField>
          </div>

          <FormField label="PDP URL">
            <Input
              value={productForm.pdp_url ?? ''}
              onChange={e => setProductForm(f => ({ ...f, pdp_url: e.target.value }))}
              placeholder="https://…"
            />
          </FormField>

          <FormField label="Drive folder">
            <Input
              value={productForm.drive_folder ?? ''}
              onChange={e => setProductForm(f => ({ ...f, drive_folder: e.target.value }))}
              placeholder="https://drive.google.com/…"
            />
          </FormField>

          <FormField label="Status">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.done ?? false}
                onChange={e => setProductForm(f => ({ ...f, done: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-text-secondary">Mark as done</span>
            </label>
          </FormField>
        </div>
      </Modal>

      {/* Delete product confirm */}
      <Modal
        open={deleteProductId !== null}
        onClose={() => setDeleteProductId(null)}
        title="Delete product"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteProductId(null)} disabled={deletingProduct}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteProduct} disabled={deletingProduct}>
              {deletingProduct ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">This product and all its corrections will be permanently deleted.</p>
      </Modal>

      {/* Correction modal */}
      <Modal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title={editCorrection ? 'Edit correction' : 'Add correction'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCorrectionModalOpen(false)} disabled={savingCorrection}>Cancel</Button>
            <Button size="sm" onClick={handleSaveCorrection} disabled={savingCorrection}>
              {savingCorrection ? 'Saving…' : editCorrection ? 'Save changes' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Source">
            <div className="flex gap-1 p-1 bg-surface-elevated rounded-lg border border-border-subtle w-fit">
              {(['website', 'ads'] as CorrectionSource[]).map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setCorrectionForm(f => ({ ...f, source: src }))}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                    correctionForm.source === src
                      ? src === 'ads'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-text-muted hover:text-foreground',
                  )}
                >
                  {src === 'ads' ? 'ADS' : 'Website'}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Location">
            <Input
              value={correctionForm.location ?? ''}
              onChange={e => setCorrectionForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. foto n1, headline, description"
            />
          </FormField>

          <FormField label="Original text">
            <textarea
              rows={2}
              value={correctionForm.original_text ?? ''}
              onChange={e => setCorrectionForm(f => ({ ...f, original_text: e.target.value }))}
              placeholder="Original wording…"
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            />
          </FormField>

          <FormField label="Corrected text">
            <textarea
              rows={2}
              value={correctionForm.corrected_text ?? ''}
              onChange={e => setCorrectionForm(f => ({ ...f, corrected_text: e.target.value }))}
              placeholder="Corrected wording…"
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Issue type">
              <Input
                value={correctionForm.issue_type ?? ''}
                onChange={e => setCorrectionForm(f => ({ ...f, issue_type: e.target.value }))}
                placeholder="e.g. grammar, spelling"
              />
            </FormField>

            <FormField label="Severity">
              <select
                className={SELECT_CLS}
                value={correctionForm.severity ?? ''}
                onChange={e => setCorrectionForm(f => ({ ...f, severity: e.target.value }))}
              >
                <option value="">—</option>
                <option value="minor">Minor</option>
                <option value="medium">Medium</option>
                <option value="critical">Critical</option>
              </select>
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              rows={2}
              value={correctionForm.notes ?? ''}
              onChange={e => setCorrectionForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional context…"
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none"
            />
          </FormField>

          <FormField label="Status">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={correctionForm.done ?? false}
                onChange={e => setCorrectionForm(f => ({ ...f, done: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-text-secondary">Mark as resolved</span>
            </label>
          </FormField>
        </div>
      </Modal>

      {/* Delete correction confirm */}
      <Modal
        open={deleteCorrectionId !== null}
        onClose={() => setDeleteCorrectionId(null)}
        title="Delete correction"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteCorrectionId(null)} disabled={deletingCorrection}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteCorrection} disabled={deletingCorrection}>
              {deletingCorrection ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">This correction will be permanently deleted.</p>
      </Modal>
    </div>
  )
}
