'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRole } from '@/lib/role-context'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal, FormField } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'

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

interface ProofCorrection {
  id: string
  product_id: string
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
  return { location: '', original_text: '', corrected_text: '', issue_type: '', severity: '', notes: '', done: false }
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null
  if (severity.toLowerCase() === 'high') return <Badge variant="danger">{severity}</Badge>
  if (severity.toLowerCase() === 'medium') return <Badge variant="warn">{severity}</Badge>
  return <Badge variant="muted">{severity}</Badge>
}

export default function CopyReviewPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'

  const [products, setProducts] = useState<ProofProduct[]>([])
  const [langFilter, setLangFilter] = useState<LangFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        loadCorrections(id)
      }
      return next
    })
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

  // Product CRUD
  function openCreateProduct() {
    setEditProduct(null)
    setProductForm(emptyProductForm())
    setProductModalOpen(true)
  }

  function openEditProduct(p: ProofProduct) {
    setEditProduct(p)
    setProductForm({ ...p })
    setProductModalOpen(true)
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

  // Correction CRUD
  function openCreateCorrection(productId: string) {
    setEditCorrection(null)
    setCorrectionProductId(productId)
    setCorrectionForm(emptyCorrectionForm())
    setCorrectionModalOpen(true)
  }

  function openEditCorrection(c: ProofCorrection) {
    setEditCorrection(c)
    setCorrectionProductId(c.product_id)
    setCorrectionForm({ ...c })
    setCorrectionModalOpen(true)
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
        loadProducts() // refresh correction_count
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
      loadProducts() // refresh correction_count
    } finally { setDeletingCorrection(false) }
  }

  const visible = products.filter(p => langFilter === 'all' || p.language === langFilter)
  const esCnt = products.filter(p => p.language === 'ES').length
  const deCnt = products.filter(p => p.language === 'DE').length

  const FILTERS: { key: LangFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    { key: 'ES', label: 'ES', count: esCnt },
    { key: 'DE', label: 'DE', count: deCnt },
  ]

  return (
    <div>
      <PageHeader
        title="Copy Review"
        description="Proofreading corrections per product — text changes to product pages and ads."
        actions={isAdmin ? (
          <Button variant="secondary" size="sm" onClick={openCreateProduct}>+ Add product</Button>
        ) : undefined}
      />

      {/* Language filter tabs */}
      <div className="flex gap-1 mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setLangFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              langFilter === f.key
                ? 'bg-accent-muted text-accent-bright border border-accent-border/50'
                : 'text-text-secondary hover:bg-surface-hover hover:text-foreground border border-transparent'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-[10px] text-text-muted">{f.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-text-muted py-12 text-center">
          No products yet.{isAdmin && (
            <> <button onClick={openCreateProduct} className="text-accent hover:text-accent-bright">Add one</button></>
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map(product => {
            const isExpanded = expanded.has(product.id)
            const productCorrections = corrections[product.id] ?? []

            return (
              <Card key={product.id} className="overflow-hidden">
                {/* Product header row */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover/40 transition-colors select-none"
                  onClick={() => toggleExpand(product.id)}
                >
                  <div className="shrink-0 text-text-muted">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{product.product_name}</span>
                      {product.language && (
                        <Badge variant="accent">{product.language}</Badge>
                      )}
                      {product.done && (
                        <Badge variant="muted">Done</Badge>
                      )}
                    </div>
                    {product.proofreader && (
                      <p className="text-xs text-text-muted mt-0.5">{product.proofreader}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-text-muted font-mono">
                      {product.correction_count} correction{product.correction_count !== 1 ? 's' : ''}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleProductDone(product)}
                          className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-xs"
                          title={product.done ? 'Mark not done' : 'Mark done'}
                        >
                          {product.done ? '↩' : '✓'}
                        </button>
                        <button
                          onClick={() => openEditProduct(product)}
                          className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteProductId(product.id)}
                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded corrections */}
                {isExpanded && (
                  <div className="border-t border-border-subtle">
                    {/* Product meta */}
                    {(product.pdp_url || product.drive_folder) && (
                      <div className="px-4 py-2 flex gap-4 bg-surface-elevated/40 border-b border-border-subtle">
                        {product.pdp_url && (
                          <a
                            href={product.pdp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:text-accent-bright"
                            onClick={e => e.stopPropagation()}
                          >
                            PDP →
                          </a>
                        )}
                        {product.drive_folder && (
                          <a
                            href={product.drive_folder}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:text-accent-bright"
                            onClick={e => e.stopPropagation()}
                          >
                            Drive folder →
                          </a>
                        )}
                      </div>
                    )}

                    {/* Corrections list */}
                    {productCorrections.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-text-muted">
                        No corrections yet.
                        {isAdmin && (
                          <button
                            onClick={() => openCreateCorrection(product.id)}
                            className="ml-2 text-accent hover:text-accent-bright"
                          >
                            Add one
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border-subtle">
                        {productCorrections.map(c => (
                          <div key={c.id} className={`px-4 py-3 ${c.done ? 'opacity-60' : ''}`}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0 space-y-1">
                                {c.location && (
                                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{c.location}</p>
                                )}

                                {(c.original_text || c.corrected_text) && (
                                  <div className="flex items-start gap-2 flex-wrap">
                                    {c.original_text && (
                                      <span className="text-sm text-text-secondary line-through">{c.original_text}</span>
                                    )}
                                    {c.original_text && c.corrected_text && (
                                      <span className="text-text-muted text-sm">→</span>
                                    )}
                                    {c.corrected_text && (
                                      <span className="text-sm text-foreground font-medium">{c.corrected_text}</span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.issue_type && (
                                    <Badge variant="default">{c.issue_type}</Badge>
                                  )}
                                  <SeverityBadge severity={c.severity} />
                                  {c.done && <Badge variant="muted">Done</Badge>}
                                </div>

                                {c.notes && (
                                  <p className="text-xs text-text-muted">{c.notes}</p>
                                )}
                              </div>

                              {isAdmin && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => toggleCorrectionDone(c)}
                                    className="p-1.5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-xs"
                                    title={c.done ? 'Mark not done' : 'Mark done'}
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

                    {/* Add correction button */}
                    {isAdmin && productCorrections.length > 0 && (
                      <div className="px-4 py-2 border-t border-border-subtle">
                        <button
                          onClick={() => openCreateCorrection(product.id)}
                          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add correction
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
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
              <span className="text-sm text-text-secondary">Mark as done</span>
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
