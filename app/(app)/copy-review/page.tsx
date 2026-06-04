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
import { Pencil, Trash2, Plus, ExternalLink } from 'lucide-react'

interface ProofProduct {
  id: string
  language: string | null
  proofreader: string | null
  product_name: string
  pdp_url: string | null
  drive_folder: string | null
  done: boolean
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

type LangFilter = 'all' | 'ES' | 'DE'

const SELECT_CLS = 'w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40'

function emptyProductForm(): Partial<ProofProduct> {
  return { language: 'ES', proofreader: '', product_name: '', pdp_url: '', drive_folder: '', done: false }
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
  const [langFilter, setLangFilter] = useState<LangFilter>('all')
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

  const loadProducts = useCallback(() => {
    api.get<ProofProduct[]>('/api/proof-corrections/products').then(setProducts).catch(console.error)
  }, [])

  const loadCorrections = useCallback((productId: string) => {
    api.get<ProofCorrection[]>(`/api/proof-corrections/products/${productId}/corrections`)
      .then(data => setCorrections(prev => ({ ...prev, [productId]: data })))
      .catch(console.error)
  }, [])

  useRealtimeRefresh(['proof_products', 'proof_corrections'], loadProducts)

  useEffect(() => { loadProducts() }, [loadProducts])

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

  function selectProduct(id: string) {
    setSelectedId(id)
    if (corrections[id] === undefined) loadCorrections(id)
  }

  async function toggleProductDone(product: ProofProduct) {
    if (!isAdmin) return
    await api.put(`/api/proof-corrections/products/${product.id}`, { done: !product.done })
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

  function openCreateCorrection(productId: string) {
    setEditCorrection(null); setCorrectionProductId(productId)
    setCorrectionForm(emptyCorrectionForm()); setCorrectionModalOpen(true)
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

  const esCnt = products.filter(p => p.language === 'ES').length
  const deCnt = products.filter(p => p.language === 'DE').length

  const FILTERS: { key: LangFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    { key: 'ES',  label: 'ES',  count: esCnt },
    { key: 'DE',  label: 'DE',  count: deCnt },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Copy Review"
          description="Proofreading corrections per product — text changes to product pages and ads."
          actions={isAdmin ? (
            <Button variant="secondary" size="sm" onClick={openCreateProduct}>+ Add product</Button>
          ) : undefined}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-text-muted py-12 text-center">
          No products yet.{isAdmin && (
            <> <button onClick={openCreateProduct} className="text-accent hover:text-accent-bright">Add one</button></>
          )}
        </p>
      ) : (
        <div className="flex-1 flex overflow-hidden rounded-lg border border-border-subtle mt-1">

          {/* ── Left: product list ── */}
          <aside className="w-64 xl:w-72 shrink-0 flex flex-col border-r border-border-subtle bg-surface-elevated/20">
            {/* Filters */}
            <div className="px-3 py-3 border-b border-border-subtle space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">In proofread</p>
              <div className="flex gap-1">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setLangFilter(f.key)}
                    className={cn(
                      'flex-1 py-1 rounded-md text-xs font-medium transition-colors',
                      langFilter === f.key
                        ? 'bg-accent-muted text-accent-bright border border-accent-border/50'
                        : 'text-text-muted hover:bg-surface-hover hover:text-foreground border border-transparent',
                    )}
                  >
                    {f.label}
                    <span className="ml-1 text-[10px] opacity-60">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Product list */}
            <ul className="flex-1 overflow-y-auto divide-y divide-border-subtle">
              {visible.map(p => {
                const isSelected = p.id === selectedId
                const doneCnt  = corrections[p.id]?.filter(c => c.done).length ?? null
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectProduct(p.id)}
                      className={cn(
                        'w-full text-left px-3 py-3 transition-colors border-l-2',
                        isSelected
                          ? 'bg-accent-muted/40 border-l-accent'
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
                          {p.language && <Badge variant="accent">{p.language}</Badge>}
                          {p.done && <Badge variant="muted">Done</Badge>}
                        </div>
                        <span className={cn(
                          'text-[10px] font-mono shrink-0',
                          p.correction_count > 0 ? 'text-text-secondary' : 'text-text-muted',
                        )}>
                          {doneCnt !== null
                            ? `${doneCnt}/${p.correction_count}`
                            : `${p.correction_count}`
                          }
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* ── Right: selected product ── */}
          <section className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {selectedProduct ? (
              <>
                {/* Product header */}
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
                          {selectedCorrections.filter(c => c.done).length}/{selectedProduct.correction_count} resolved
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => toggleProductDone(selectedProduct)}
                          className="px-2 py-1.5 rounded text-xs text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                          title={selectedProduct.done ? 'Mark not done' : 'Mark done'}
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

                  {(selectedProduct.pdp_url || selectedProduct.drive_folder) && (
                    <div className="flex gap-3 mt-3">
                      {selectedProduct.pdp_url && (
                        <a
                          href={selectedProduct.pdp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          PDP
                        </a>
                      )}
                      {selectedProduct.drive_folder && (
                        <a
                          href={selectedProduct.drive_folder}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Drive folder
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Corrections list */}
                <div className="flex-1 overflow-y-auto">
                  {selectedCorrections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                      <p className="text-sm text-text-muted">No corrections yet.</p>
                      {isAdmin && (
                        <Button variant="secondary" size="sm" onClick={() => openCreateCorrection(selectedProduct.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add correction
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {selectedCorrections.map((c, i) => (
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
                              {/* Index + source + location */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-text-muted bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5">
                                  #{i + 1}
                                </span>
                                {c.source && (
                                  <span className={cn(
                                    'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                                    c.source === 'ads'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                                  )}>
                                    {c.source === 'ads' ? 'ADS' : 'Website'}
                                  </span>
                                )}
                                {c.location && (
                                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                                    {c.location}
                                  </span>
                                )}
                              </div>

                              {/* Before */}
                              {c.original_text && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Before</p>
                                  <p className="text-sm text-text-secondary leading-relaxed line-through decoration-text-muted/50">
                                    {c.original_text}
                                  </p>
                                </div>
                              )}

                              {/* After */}
                              {c.corrected_text && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">After</p>
                                  <p className="text-sm text-foreground font-medium leading-relaxed">
                                    {c.corrected_text}
                                  </p>
                                </div>
                              )}

                              {/* Badges + notes */}
                              <div className="flex items-start justify-between gap-2 pt-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {c.issue_type && <Badge variant="default">{c.issue_type}</Badge>}
                                  <SeverityBadge severity={c.severity} />
                                  {c.done && <Badge variant="muted">Resolved</Badge>}
                                </div>
                              </div>

                              {c.notes && (
                                <p className="text-xs text-text-muted italic border-l-2 border-border-subtle pl-2">
                                  {c.notes}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Add correction footer */}
                {isAdmin && selectedCorrections.length > 0 && (
                  <div className="shrink-0 px-5 py-3 border-t border-border-subtle">
                    <button
                      onClick={() => openCreateCorrection(selectedProduct.id)}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add correction
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-text-muted">Select a product to review corrections.</p>
              </div>
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
              <select
                className={SELECT_CLS}
                value={productForm.language ?? 'ES'}
                onChange={e => setProductForm(f => ({ ...f, language: e.target.value }))}
              >
                <option value="ES">ES</option>
                <option value="DE">DE</option>
              </select>
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
