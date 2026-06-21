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
import { cn, currentMonth, formatDate } from '@/lib/utils'
import { Pencil, Trash2, Plus, ExternalLink, Languages, ArrowLeft, ChevronRight, HelpCircle, Search, X, Check, RotateCcw, Copy } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { translateSeverity, translateIssueType, translateLocation, UI } from '@/lib/proof-translations'

interface ProofProduct {
  id: string
  language: string | null
  proofreader: string | null
  product_name: string
  pdp_url: string | null
  monday_url: string | null
  drive_folder: string | null
  done: boolean
  website_done: boolean
  ads_done: boolean
  ready_for_revision: boolean
  week_number: number | null
  month_year: string | null
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
  return { language: 'ES', proofreader: '', product_name: '', pdp_url: '', monday_url: '', drive_folder: '', done: false, website_done: false, ads_done: false, ready_for_revision: false, week_number: null, month_year: currentMonth() }
}

function emptyCorrectionForm(): Partial<ProofCorrection> {
  return { source: null, location: '', original_text: '', corrected_text: '', issue_type: '', severity: '', notes: '', done: false }
}

function Spinner() {
  return <span className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0" />
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
  const { role, userLang } = useRole()
  const isAdmin = role === 'admin'
  const isProofreader = role === 'proofreader'
  const canManageProducts    = role === 'admin' || role === 'management'
  const canMarkReady         = role === 'admin' || role === 'management' || role === 'proofreader'
  const canMarkDone          = role === 'admin' || role === 'management' || role === 'ads' || role === 'website'
  const canUpdateLinks       = role === 'admin' || role === 'management' || role === 'website'
  const canModifyCorrections = role === 'admin' || role === 'management' || role === 'proofreader'
  // ads + website can toggle correction done only once product is marked Ready; proofreader cannot resolve
  const canToggleCorrectionDone = (product: ProofProduct | null) =>
    role === 'admin' || role === 'management' ||
    (!!product?.ready_for_revision && (role === 'ads' || role === 'website'))

  const [products, setProducts] = useState<ProofProduct[]>([])
  const [langFilter, setLangFilter] = useState<string>(userLang ?? 'all')
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

  // Search + sort
  const [searchQuery, setSearchQuery] = useState('')
  const dateSort = 'status' as const

  // How to use
  const [howToUseOpen, setHowToUseOpen] = useState(false)
  const [helpStep, setHelpStep] = useState(0)

  // Action loading + shake
  const [togglingReady, setTogglingReady] = useState(false)
  const [togglingDone, setTogglingDone] = useState(false)
  const [doneShakeKey, setDoneShakeKey] = useState(0)
  const [togglingCorrectionId, setTogglingCorrectionId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    })
  }

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
  useEffect(() => { setMobileDetailOpen(false); setSearchQuery('') }, [langFilter])

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

  async function toggleTeamDone(product: ProofProduct) {
    if (!canMarkDone) return
    const isWebsite = role === 'website'
    const isAds     = role === 'ads'
    const myDone = isWebsite ? product.website_done : isAds ? product.ads_done : product.done
    // Block marking Done if not yet ready (Reopen is always allowed)
    if (!myDone && !product.ready_for_revision) {
      setDoneShakeKey(k => k + 1)
      return
    }
    // website/ads: block if they have unresolved corrections in their own tab
    if (!myDone && (isWebsite || isAds)) {
      const mySource = isWebsite ? 'website' : 'ads'
      const unresolved = (corrections[product.id] ?? []).filter(c => c.source === mySource && !c.done)
      if (unresolved.length > 0) {
        setDoneShakeKey(k => k + 1)
        return
      }
    }
    setTogglingDone(true)
    try {
      const payload = isWebsite ? { website_done: !product.website_done }
                    : isAds     ? { ads_done:     !product.ads_done }
                    : { done: !product.done }
      await api.put(`/api/proof-corrections/products/${product.id}`, payload)
      loadProducts()
    } finally { setTogglingDone(false) }
  }

  async function toggleReadyForRevision(product: ProofProduct) {
    if (!canMarkReady) return
    setTogglingReady(true)
    try {
      await api.put(`/api/proof-corrections/products/${product.id}`, { ready_for_revision: !product.ready_for_revision })
      loadProducts()
    } finally { setTogglingReady(false) }
  }

  async function toggleCorrectionDone(correction: ProofCorrection) {
    if (!canToggleCorrectionDone(selectedProduct)) return
    setTogglingCorrectionId(correction.id)
    try {
      await api.put(`/api/proof-corrections/corrections/${correction.id}`, { done: !correction.done })
      loadCorrections(correction.product_id)
    } finally { setTogglingCorrectionId(null) }
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
    // Preserve the draft when re-opening for the same product in create mode.
    // Reset only if switching products or coming out of an edit session.
    const hasDraft = editCorrection === null && correctionProductId === productId
    setEditCorrection(null)
    setCorrectionProductId(productId)
    if (!hasDraft) {
      setCorrectionForm({ ...emptyCorrectionForm(), source: source ?? null })
    } else if (source != null && source !== correctionForm.source) {
      // Same product but opened from a different source tab — switch source, keep text
      setCorrectionForm(f => ({ ...f, source }))
    }
    setCorrectionModalOpen(true)
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
      setCorrectionForm(emptyCorrectionForm())
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

  const productLang = selectedProduct?.language ?? null
  const hasNativeUI = productLang === 'ES' || productLang === 'DE'
  const uiLang: 'ES' | 'DE' | 'EN' = hasNativeUI && !isTranslated
    ? (productLang as 'ES' | 'DE')
    : 'EN'
  const L = UI[uiLang]

  function productGroup(p: ProofProduct): 0 | 1 | 2 | 3 | 4 | 5 {
    if (p.done) return 5
    if (!p.pdp_url || !p.drive_folder) return 4
    if (!p.language) return 3
    if (p.ready_for_revision) return 2
    if (p.correction_count === 0) return 0
    return 1
  }

  const q = searchQuery.trim().toLowerCase()
  const searchFiltered = q
    ? visible.filter(p => p.product_name.toLowerCase().includes(q) || (p.proofreader ?? '').toLowerCase().includes(q))
    : visible

  const sortedVisible = [...searchFiltered].sort((a, b) => {
    const diff = productGroup(a) - productGroup(b)
    return diff !== 0 ? diff : a.product_name.localeCompare(b.product_name)
  })

  const presentGroups = Array.from(new Set(sortedVisible.map(p => productGroup(p)))).sort() as (0|1|2|3|4|5)[]

  const GROUP_LABELS: Record<number, { label: string; description: string }> = {
    0: { label: 'No corrections',      description: 'Just added — nothing flagged yet' },
    1: { label: 'Has corrections',     description: 'Proofreader found issues' },
    2: { label: 'Ready for revision',  description: 'Writer can now apply the fixes' },
    3: { label: 'Needs language',      description: 'Language is not set for this product' },
    4: { label: 'Needs links',         description: 'PDP or Drive folder URL is missing' },
    5: { label: 'Done',                description: 'Fully resolved' },
  }

  return (
    <>
    <style>{`
      @keyframes proof-shake {
        0%,100%{transform:translateX(0) scale(1)}
        20%{transform:translateX(-5px) scale(0.97)}
        40%{transform:translateX(5px) scale(0.97)}
        60%{transform:translateX(-3px) scale(0.99)}
        80%{transform:translateX(2px)}
      }
      .animate-proof-shake { animation: proof-shake 0.42s ease-in-out; }
    `}</style>
    <div className="flex flex-col md:h-[calc(100vh-4rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Proofreading"
          description="Proofreading corrections per product — text changes to product pages and ads."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setHelpStep(0); setHowToUseOpen(true) }}
                className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-foreground hover:bg-surface-hover px-2.5 py-1.5 rounded-md border border-border-subtle transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">How to use</span>
              </button>
              {canManageProducts && (
                <Button variant="secondary" size="sm" onClick={openCreateProduct}>+ Add product</Button>
              )}
            </div>
          }
        />
      </div>

      {/* Language tabs — hidden for lang-locked proofreaders (they see only their language) */}
      {!userLang && (
        <div className="shrink-0 sticky top-0 z-20 bg-background overflow-x-auto md:static md:z-auto md:overflow-visible mb-0">
          <Tabs
            tabs={langTabs}
            active={langFilter}
            onChange={id => setLangFilter(String(id))}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-text-muted py-12 text-center">
          No products yet.{canManageProducts && (
            <> <button onClick={openCreateProduct} className="text-accent hover:text-accent-bright">Add one</button></>
          )}
        </p>
      ) : (
        <div className="md:flex-1 md:flex md:overflow-hidden border border-border-subtle rounded-lg">

          {/* ── Left: product list ── */}
          <aside className={cn(
            'shrink-0 flex-col md:border-r border-border-subtle bg-surface-elevated/20',
            'w-full md:w-64 lg:w-72',
            mobileDetailOpen ? 'hidden md:flex' : 'flex',
          )}>
            {/* Search + sort */}
            <div className="shrink-0 px-3 py-2.5 border-b border-border-subtle space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products…"
                  className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {presentGroups.length > 0 && (
              <div className="shrink-0 px-3 py-2 border-b border-border-subtle flex gap-0.5 overflow-x-auto scrollbar-none">
                {presentGroups.map(g => (
                  <button
                    key={g}
                    onClick={() => document.getElementById(`group-${g}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full border border-border bg-surface-elevated text-text-muted transition-colors hover:border-accent/50 hover:text-accent-bright hover:bg-accent-muted active:scale-95 cursor-pointer"
                  >
                    {GROUP_LABELS[g].label}
                  </button>
                ))}
              </div>
            )}

            <ul className="md:flex-1 md:overflow-y-auto p-3 md:p-0 space-y-2 md:space-y-0">
              {sortedVisible.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-text-muted">
                  {searchQuery ? `No products match "${searchQuery}"` : 'No products.'}
                </li>
              )}
              {sortedVisible.map((p, idx) => {
                const isSelected = p.id === selectedId
                const doneCnt    = corrections[p.id]?.filter(c => c.done).length ?? null
                const group      = productGroup(p)
                const isReady    = group === 2
                const noLang     = group === 3
                const noLinks    = group === 4
                const prevGroup  = idx > 0 ? productGroup(sortedVisible[idx - 1]) : -1
                const showHeader = dateSort === 'status' && group !== prevGroup
                return (
                  <li key={p.id}>
                    {showHeader && (
                      <div id={`group-${group}`} className={cn(
                        'px-4 py-2 md:border-y border-border-subtle rounded-lg md:rounded-none mb-1 md:mb-0',
                        isReady  ? 'bg-green-500/5'   :
                        noLang   ? 'bg-orange-500/5'  :
                        noLinks  ? 'bg-yellow-500/5'  : 'bg-surface-elevated/30',
                      )}>
                        <p className={cn(
                          'text-xs font-semibold uppercase tracking-widest',
                          isReady  ? 'text-green-500/70'   :
                          noLang   ? 'text-orange-500/70'  :
                          noLinks  ? 'text-yellow-500/70'  : 'text-text-muted',
                        )}>
                          {GROUP_LABELS[group].label}
                        </p>
                        <p className={cn(
                          'text-[10px] mt-0.5',
                          isReady  ? 'text-green-500/50'   :
                          noLang   ? 'text-orange-500/50'  :
                          noLinks  ? 'text-yellow-500/50'  : 'text-text-muted/60',
                        )}>
                          {GROUP_LABELS[group].description}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { selectProduct(p.id); setMobileDetailOpen(true) }}
                      className={cn(
                        'w-full text-left px-4 py-4 transition-colors',
                        // Mobile: card style
                        'rounded-xl border md:rounded-none md:border-0',
                        // Desktop: left-border accent
                        'md:border-l-2',
                        isSelected
                          ? 'bg-accent-muted/40 border-accent md:border-l-accent'
                          : isReady
                            ? 'bg-green-500/[0.04] border-green-500/20 hover:bg-green-500/10 md:border-l-transparent'
                          : noLang
                            ? 'bg-orange-500/[0.04] border-orange-500/20 hover:bg-orange-500/10 md:border-l-transparent'
                          : noLinks
                            ? 'bg-yellow-500/[0.04] border-yellow-500/20 hover:bg-yellow-500/10 md:border-l-transparent'
                            : 'bg-surface-elevated border-border-subtle hover:bg-surface-hover/50 md:border-l-transparent',
                      )}
                    >
                      <p className={cn(
                        'text-[15px] font-medium leading-snug line-clamp-2',
                        p.done ? 'text-text-muted line-through' : 'text-foreground',
                      )}>
                        {p.product_name}
                      </p>
                      {p.proofreader && (
                        <p className="text-sm text-text-muted mt-1 truncate">{p.proofreader}</p>
                      )}
                      <div className="flex items-center justify-between mt-2.5 gap-1">
                        <div className="flex items-center gap-1">
                          {langFilter === 'all' && p.language && <Badge variant="accent">{p.language}</Badge>}
                          {(p.website_done || p.done) && <Badge variant="default">Web ✓</Badge>}
                          {(p.ads_done || p.done) && <Badge variant="default">Ads ✓</Badge>}
                          {isReady && !p.done && <Badge variant="default">Ready</Badge>}
                          {noLang  && <Badge variant="warn">Needs lang</Badge>}
                          {noLinks && <Badge variant="warn">Needs links</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            'text-xs font-mono',
                            p.correction_count > 0 ? 'text-text-secondary' : 'text-text-muted',
                          )}>
                            {doneCnt !== null
                              ? `${doneCnt}/${p.correction_count}`
                              : `${p.correction_count}`
                            }
                          </span>
                          <ChevronRight className="h-4 w-4 text-text-muted md:hidden" />
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

            {selectedProduct && (!selectedProduct.pdp_url || !selectedProduct.drive_folder) && canUpdateLinks && (
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
                <div className="shrink-0 px-4 py-4 border-b border-border-subtle bg-surface-elevated/30 space-y-3">

                  {/* Name — hidden on mobile (shown in the back bar above) */}
                  <div className="hidden md:block">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold leading-snug">
                        {!isProofreader && selectedProduct.monday_url ? (
                          <a
                            href={selectedProduct.monday_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 group text-foreground hover:text-accent transition-colors"
                          >
                            {selectedProduct.product_name}
                            <ExternalLink className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                          </a>
                        ) : (
                          <span className="text-foreground">{selectedProduct.product_name}</span>
                        )}
                      </h2>
                      <span className="text-xs font-mono text-text-muted shrink-0 mt-0.5">{formatDate(selectedProduct.created_at)}</span>
                    </div>
                  </div>

                  {/* Badges + icon actions row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      {selectedProduct.language && <Badge variant="accent">{selectedProduct.language}</Badge>}
                      {selectedProduct.proofreader && (
                        <span className="text-xs text-text-muted truncate">{selectedProduct.proofreader}</span>
                      )}
                      {(selectedProduct.website_done || selectedProduct.done) && <Badge variant="default">Web ✓</Badge>}
                      {(selectedProduct.ads_done || selectedProduct.done) && <Badge variant="default">Ads ✓</Badge>}
                      <span className="text-xs text-text-muted font-mono">
                        {L.resolvedOf(selectedCorrections.filter(c => c.done).length, selectedProduct.correction_count)}
                      </span>
                    </div>
                    {canManageProducts && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => openEditProduct(selectedProduct)}
                          className="p-2 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteProductId(selectedProduct.id)}
                          className="p-2 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Links + translate */}
                  <div className="flex items-center gap-3 flex-wrap">
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
                    {hasNativeUI && (
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
                    )}
                  </div>

                  {/* Ready / Done action buttons — full row, wraps on mobile */}
                  {(canMarkReady || canMarkDone) && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {canMarkReady && (
                        <button
                          onClick={() => toggleReadyForRevision(selectedProduct)}
                          disabled={togglingReady}
                          className={cn(
                            'flex items-center gap-1.5 flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 border',
                            selectedProduct.ready_for_revision
                              ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                              : 'text-text-muted border-border-subtle hover:text-foreground hover:bg-surface-hover',
                            togglingReady && 'opacity-60 cursor-wait',
                          )}
                        >
                          {togglingReady
                            ? <><Spinner />…</>
                            : selectedProduct.ready_for_revision ? '↩ Unmark Ready' : '✓ Mark Ready'
                          }
                        </button>
                      )}
                      {canMarkDone && (() => {
                        const isWebsite = role === 'website'
                        const isAds     = role === 'ads'
                        const myDone    = isWebsite ? selectedProduct.website_done : isAds ? selectedProduct.ads_done : selectedProduct.done
                        const doneCount = selectedProduct.done ? 2 : (selectedProduct.website_done ? 1 : 0) + (selectedProduct.ads_done ? 1 : 0)
                        const mySource  = isWebsite ? 'website' : 'ads'
                        const unresolved = (isWebsite || isAds)
                          ? selectedCorrections.filter(c => c.source === mySource && !c.done).length
                          : 0
                        const canAct = myDone || (selectedProduct.ready_for_revision && unresolved === 0)
                        const blockTitle = !selectedProduct.ready_for_revision
                          ? 'Mark as Ready first'
                          : unresolved > 0
                            ? `Resolve all ${mySource} corrections first`
                            : undefined
                        return (
                          <span key={doneShakeKey} className={cn('flex-1 sm:flex-none inline-flex', doneShakeKey > 0 && 'animate-proof-shake')}>
                            <button
                              onClick={() => toggleTeamDone(selectedProduct)}
                              disabled={togglingDone}
                              title={!canAct ? blockTitle : undefined}
                              className={cn(
                                'flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 border',
                                !canAct
                                  ? 'opacity-40 cursor-not-allowed text-text-muted border-border-subtle'
                                  : myDone
                                    ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                                    : 'text-text-muted border-border-subtle hover:text-foreground hover:bg-surface-hover',
                                togglingDone && 'opacity-60 cursor-wait',
                              )}
                            >
                              {togglingDone ? <><Spinner />…</> :
                               selectedProduct.done ? '↩ Reopen' : (
                                 <>{myDone && <Check className="h-3.5 w-3.5" />}Done <span className="font-mono text-[11px] opacity-75">{doneCount}/2</span></>
                               )
                              }
                            </button>
                          </span>
                        )
                      })()}
                    </div>
                  )}
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
                      <div className="shrink-0 px-4 border-b border-border-subtle flex items-center justify-between bg-surface-elevated/20">
                        <Tabs tabs={tabItems} active={sourceTab} onChange={v => setSourceTab(v as CorrectionSource)} />
                        {canModifyCorrections && (
                          <button
                            onClick={() => openCreateCorrection(selectedProduct.id, sourceTab)}
                            className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-foreground hover:bg-surface-hover px-3 py-2.5 rounded-md transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add</span>
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto">
                        {tabCorrections.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                            <p className="text-sm text-text-muted">
                              {sourceTab === 'website' ? L.noWebsite : L.noAds}
                            </p>
                            {canModifyCorrections && (
                              <Button variant="secondary" size="sm" onClick={() => openCreateCorrection(selectedProduct.id, sourceTab)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />{L.addCorrection}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            {tabCorrections.map((c, i) => {
                              const loc      = isTranslated ? translateLocation(c.location)    : c.location
                              const issueTyp = isTranslated ? translateIssueType(c.issue_type) : c.issue_type
                              const sev      = isTranslated ? translateSeverity(c.severity)    : c.severity
                              return (
                                <div
                                  key={c.id}
                                  className={cn(
                                    'rounded-xl border border-border-subtle bg-surface-elevated shadow-sm',
                                    'border-l-[3px] px-4 py-4 transition-all duration-300',
                                    severityBorder(c.severity),
                                    c.done && 'opacity-40',
                                    togglingCorrectionId === c.id && 'scale-[0.99]',
                                  )}
                                >
                                  {/* Card header: number, location, actions */}
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-mono text-text-muted bg-surface border border-border-subtle rounded px-1.5 py-0.5">
                                        #{i + 1}
                                      </span>
                                      {loc && (
                                        <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{loc}</span>
                                      )}
                                    </div>
                                    {(canToggleCorrectionDone(selectedProduct) || canModifyCorrections) && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {canToggleCorrectionDone(selectedProduct) && (
                                          <button
                                            onClick={() => toggleCorrectionDone(c)}
                                            disabled={togglingCorrectionId === c.id}
                                            className={cn(
                                              'flex items-center justify-center w-9 h-9 rounded-md transition-all active:scale-90',
                                              togglingCorrectionId === c.id
                                                ? 'opacity-60 cursor-wait bg-surface-elevated border border-border-subtle text-text-muted'
                                                : c.done
                                                  ? 'bg-surface-elevated border border-border-subtle text-text-muted hover:bg-surface-hover'
                                                  : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20',
                                            )}
                                            title={c.done ? 'Reopen' : 'Mark resolved'}
                                          >
                                            {togglingCorrectionId === c.id
                                              ? <Spinner />
                                              : c.done
                                                ? <RotateCcw className="h-4 w-4" />
                                                : <Check className="h-4 w-4" />
                                            }
                                          </button>
                                        )}
                                        {canModifyCorrections && (
                                          <>
                                            <button
                                              onClick={() => openEditCorrection(c)}
                                              className="p-2 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                            >
                                              <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => setDeleteCorrectionId(c.id)}
                                              className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Before / After */}
                                  <div className="space-y-3">
                                    {c.original_text && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{L.before}</p>
                                          <button
                                            onClick={() => copyText(c.original_text!, `${c.id}-before`)}
                                            className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                            title="Copy"
                                          >
                                            {copiedKey === `${c.id}-before`
                                              ? <Check className="h-3 w-3 text-green-400" />
                                              : <Copy className="h-3 w-3" />}
                                          </button>
                                        </div>
                                        <p className="text-[15px] text-text-secondary leading-relaxed line-through decoration-text-muted/50">
                                          {c.original_text}
                                        </p>
                                      </div>
                                    )}

                                    {c.corrected_text && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{L.after}</p>
                                          <button
                                            onClick={() => copyText(c.corrected_text!, `${c.id}-after`)}
                                            className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                            title="Copy"
                                          >
                                            {copiedKey === `${c.id}-after`
                                              ? <Check className="h-3 w-3 text-green-400" />
                                              : <Copy className="h-3 w-3" />}
                                          </button>
                                        </div>
                                        <p className="text-[15px] text-foreground font-medium leading-relaxed">
                                          {c.corrected_text}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Badges + notes */}
                                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                                    {issueTyp && <Badge variant="default">{issueTyp}</Badge>}
                                    <SeverityBadge severity={sev} />
                                    {c.done && <Badge variant="muted">{L.resolved}</Badge>}
                                  </div>

                                  {c.notes && (
                                    <p className="mt-2.5 text-sm text-text-muted italic border-l-2 border-border-subtle pl-3 leading-relaxed">
                                      {c.notes}
                                    </p>
                                  )}
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Week">
              <select
                className={SELECT_CLS}
                value={productForm.week_number ?? ''}
                onChange={e => setProductForm(f => ({ ...f, week_number: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">—</option>
                <option value="1">Week 1</option>
                <option value="2">Week 2</option>
                <option value="3">Week 3</option>
                <option value="4">Week 4</option>
              </select>
            </FormField>

            <FormField label="Month">
              <Input
                type="month"
                value={productForm.month_year ?? ''}
                onChange={e => setProductForm(f => ({ ...f, month_year: e.target.value || null }))}
                mono
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

          <FormField label="Monday URL">
            <Input
              value={productForm.monday_url ?? ''}
              onChange={e => setProductForm(f => ({ ...f, monday_url: e.target.value }))}
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
            <Button variant="ghost" size="sm" onClick={() => { setCorrectionModalOpen(false); setCorrectionForm(emptyCorrectionForm()) }} disabled={savingCorrection}>Cancel</Button>
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

      {/* How to use guide */}
      {(() => {
        const STEP_BROWSE = {
          title: 'Browse products',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>The left panel lists all products organized into groups:</p>
              <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden text-xs divide-y divide-border-subtle">
                {[
                  { label: 'No corrections', color: 'text-text-muted', hint: 'Just added — nothing flagged yet' },
                  { label: 'Has corrections', color: 'text-text-secondary', hint: 'Proofreader found issues' },
                  { label: 'Ready for revision', color: 'text-green-400', hint: 'Writer can now apply the fixes' },
                  { label: 'Needs language', color: 'text-orange-400', hint: 'Language is not set for this product' },
                  { label: 'Needs links', color: 'text-yellow-400', hint: 'PDP or Drive folder URL is missing' },
                  { label: 'Done', color: 'text-text-muted', hint: 'Fully resolved', strike: true },
                ].map(g => (
                  <div key={g.label} className="flex items-center gap-3 px-3 py-2">
                    <span className={cn('font-semibold uppercase tracking-widest text-[10px] w-36 shrink-0', g.color, g.strike && 'line-through')}>{g.label}</span>
                    <span className="text-text-muted">{g.hint}</span>
                  </div>
                ))}
              </div>
              <p>Click any product to open its corrections on the right.</p>
            </div>
          ),
        }

        const STEP_FILTER = {
          title: 'Filter by language',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Use the language tabs at the top to narrow the list to a single language. The count on each tab shows how many products exist for it.</p>
              <div className="flex gap-1 border-b border-border-subtle pb-2">
                {['All', 'ES', 'DE'].map((l, i) => (
                  <div key={l} className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-[9px]',
                    i === 0 ? 'border-accent text-accent' : 'border-transparent text-text-muted',
                  )}>
                    {l} <span className="text-[10px] opacity-60">{i === 0 ? '12' : i === 1 ? '7' : '5'}</span>
                  </div>
                ))}
              </div>
              <p>Select <strong className="text-foreground">All</strong> to see every product. Language badges appear on each card so you can tell them apart.</p>
            </div>
          ),
        }

        const STEP_SOURCES = {
          title: 'Website vs ADS corrections',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Each product splits corrections into two sources:</p>
              <div className="flex gap-2 flex-wrap">
                <div className="flex flex-col gap-1 flex-1 min-w-0 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <span className="text-xs font-semibold text-blue-400">Website</span>
                  <span className="text-xs text-text-muted">Product page copy — titles, bullets, descriptions, FAQs.</span>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                  <span className="text-xs font-semibold text-purple-400">ADS</span>
                  <span className="text-xs text-text-muted">Ad creative copy — headlines, descriptions, image text.</span>
                </div>
              </div>
              <p>The count badge on each tab shows how many corrections are logged for that source. Switch tabs to review each type independently.</p>
            </div>
          ),
        }

        const STEP_READING = {
          title: 'Reading a correction card',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Each card represents one specific correction flagged for the product:</p>
              <div className="rounded-xl border border-border-subtle bg-surface border-l-[3px] border-l-yellow-500 px-4 py-3 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5 text-text-muted">#1</span>
                  <span className="font-semibold text-text-muted uppercase tracking-wide">Product title</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">BEFORE</p>
                  <p className="text-text-secondary line-through decoration-text-muted/50">Original wording that was incorrect</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">AFTER</p>
                  <p className="text-foreground font-medium">Corrected wording to replace it with</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5 text-text-muted">Mistranslation</span>
                  <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">Medium</span>
                </div>
              </div>
              <p>The <strong className="text-foreground">left border color</strong> shows severity: <span className="text-danger font-medium">red</span> = Critical, <span className="text-yellow-400 font-medium">yellow</span> = Medium, <span className="text-text-muted font-medium">gray</span> = Minor.</p>
            </div>
          ),
        }

        const STEP_TRANSLATE = {
          title: 'Translate button',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Proofreaders work in their native language. Location names, issue types, and severity labels are shown in ES or DE by default.</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border-subtle text-text-muted">
                  <span>🌐</span> Translate
                </div>
                <span className="text-text-muted text-xs">→</span>
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-accent-border/50 bg-accent-muted text-accent-bright">
                  <span>🌐</span> EN
                </div>
              </div>
              <p>Click <strong className="text-foreground">Translate</strong> in the product header to toggle all labels to English — useful when you don&apos;t speak the proofreader&apos;s language.</p>
            </div>
          ),
        }

        // Role-specific steps
        const STEP_PROOFREADER_ADD = {
          title: 'Adding & editing corrections',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Your job is to log every copy issue you find. For each product, pick the correct source tab (Website or ADS) and click <strong className="text-foreground">+ Add</strong>.</p>
              <div className="rounded-lg border border-border-subtle bg-surface divide-y divide-border-subtle text-xs overflow-hidden">
                {[
                  { field: 'Location', hint: 'Where on the page — e.g. foto n1, headline, description' },
                  { field: 'Before', hint: 'The original incorrect wording, copied exactly' },
                  { field: 'After', hint: 'The corrected version you want applied' },
                  { field: 'Severity', hint: 'Minor / Medium / Critical — how urgent the fix is' },
                ].map(r => (
                  <div key={r.field} className="flex gap-3 px-3 py-2">
                    <span className="w-20 shrink-0 font-semibold text-foreground">{r.field}</span>
                    <span className="text-text-muted">{r.hint}</span>
                  </div>
                ))}
              </div>
              <p>Use the <strong className="text-foreground">pencil</strong> icon to edit a card and the <strong className="text-foreground">trash</strong> icon to delete one if you logged it by mistake.</p>
            </div>
          ),
        }

        const STEP_PROOFREADER_READY = {
          title: 'Marking a product Ready',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Once you have logged all the corrections for a product and they are ready for the writer to apply, click <strong className="text-foreground">✓ Ready</strong> in the product header.</p>
              <div className="flex gap-2 items-center">
                <span className="px-2.5 py-1.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20 font-medium">✓ Ready</span>
                <span className="text-xs text-text-muted">→ product moves to the <span className="text-green-400 font-medium">Ready for revision</span> group</span>
              </div>
              <p>This unlocks the product for the Website and Ads team — they can only start checking off corrections after you mark it Ready.</p>
              <p className="text-xs text-text-muted">Changed your mind? Click <strong className="text-foreground">↩ Unmark</strong> to move it back to the corrections stage.</p>
            </div>
          ),
        }

        const STEP_ADS_CHECK = {
          title: 'Checking off corrections',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>You can mark individual corrections as applied, but <strong className="text-foreground">only after the proofreader has marked the product Ready</strong>.</p>
              <div className="rounded-lg border border-border-subtle bg-surface divide-y divide-border-subtle text-xs overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-text-muted">Green check — click to mark a correction applied. The card dims.</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-surface-elevated border border-border-subtle text-text-muted shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-text-muted">Reopen icon — click to un-check if you applied the wrong fix.</span>
                </div>
              </div>
              <p className="text-xs text-text-muted">If the check button is not visible, the product hasn&apos;t been marked Ready by the proofreader yet.</p>
            </div>
          ),
        }

        const STEP_ADS_DONE = {
          title: 'Marking a product Done',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Once all corrections have been applied and the product is fully reviewed, click <strong className="text-foreground">✓ Done</strong> in the product header to close it out.</p>
              <div className="flex gap-2 items-center">
                <span className="px-2.5 py-1.5 rounded text-xs text-text-muted bg-surface-elevated border border-border-subtle font-medium">✓ Done</span>
                <span className="text-xs text-text-muted">→ product moves to the <span className="text-text-muted font-medium line-through">Done</span> group</span>
              </div>
              <p className="text-xs text-text-muted">The <strong className="text-foreground">Done</strong> button only appears after the proofreader has marked the product Ready. If you don&apos;t see it, check the product status first.</p>
            </div>
          ),
        }

        const STEP_WEBSITE_LINKS = {
          title: 'Adding product links',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Products with a <span className="text-yellow-400 font-medium">Needs links</span> status are waiting for you to add the PDP URL and Drive folder. Click the product to open the setup form.</p>
              <div className="rounded-lg border border-border-subtle bg-surface divide-y divide-border-subtle text-xs overflow-hidden">
                <div className="flex gap-3 px-3 py-2">
                  <span className="w-24 shrink-0 font-semibold text-foreground">PDP URL</span>
                  <span className="text-text-muted">The live product page link on the store</span>
                </div>
                <div className="flex gap-3 px-3 py-2">
                  <span className="w-24 shrink-0 font-semibold text-foreground">Drive folder</span>
                  <span className="text-text-muted">The Google Drive folder containing the ad assets</span>
                </div>
              </div>
              <p>Once both links are saved, the corrections panel unlocks and the product moves out of <span className="text-yellow-400 font-medium">Needs links</span>.</p>
            </div>
          ),
        }

        const STEP_WEBSITE_CORRECTIONS = {
          title: 'Adding & editing corrections',
          body: (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>Pick the correct source tab (Website or ADS) and click <strong className="text-foreground">+ Add</strong> to log a correction. Fill in the location, before/after text, and severity.</p>
              <p>Use the <strong className="text-foreground">pencil</strong> icon to edit a card and the <strong className="text-foreground">trash</strong> icon to delete one. You can also mark individual corrections done once the product is marked Ready.</p>
              <div className="flex gap-2 items-center mt-1">
                <span className="flex items-center justify-center w-7 h-7 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-text-muted">The green check button appears on each card once the product is marked <span className="text-green-400 font-medium">Ready</span>.</span>
              </div>
            </div>
          ),
        }

        const STEPS =
          role === 'proofreader' ? [STEP_BROWSE, STEP_FILTER, STEP_SOURCES, STEP_READING, STEP_PROOFREADER_ADD, STEP_PROOFREADER_READY, STEP_TRANSLATE] :
          role === 'ads'         ? [STEP_BROWSE, STEP_FILTER, STEP_SOURCES, STEP_READING, STEP_ADS_CHECK, STEP_ADS_DONE, STEP_TRANSLATE] :
          role === 'website'     ? [STEP_BROWSE, STEP_FILTER, STEP_SOURCES, STEP_READING, STEP_WEBSITE_LINKS, STEP_WEBSITE_CORRECTIONS, STEP_ADS_DONE, STEP_TRANSLATE] :
          /* admin / management */ [STEP_BROWSE, STEP_FILTER, STEP_SOURCES, STEP_READING, STEP_PROOFREADER_READY, STEP_ADS_DONE, STEP_TRANSLATE]

        const step = STEPS[helpStep]
        return (
          <Modal
            open={howToUseOpen}
            onClose={() => { setHowToUseOpen(false); setHelpStep(0) }}
            title="How to use Proofreading"
            description={`Step ${helpStep + 1} of ${STEPS.length}`}
            size="xl"
            footer={
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHelpStep(i)}
                      className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        i === helpStep ? 'bg-accent' : 'bg-border hover:bg-border-subtle',
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {helpStep > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setHelpStep(s => s - 1)}>Back</Button>
                  )}
                  {helpStep < STEPS.length - 1 ? (
                    <Button size="sm" onClick={() => setHelpStep(s => s + 1)}>Next</Button>
                  ) : (
                    <Button size="sm" onClick={() => { setHowToUseOpen(false); setHelpStep(0) }}>Got it</Button>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              {step.body}
            </div>
          </Modal>
        )
      })()}
    </div>
    </>
  )
}
