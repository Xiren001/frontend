export interface WinningStore { id: string; name: string }
export interface CsvProduct { title: string; unitsSold?: number; unitGrowthPct?: number }

export const DEFAULT_STORE: WinningStore = { id: 'default', name: 'Default Store' }

const STORES_KEY = 'wp-stores'
const ACTIVE_STORE_KEY = 'wp-active-store'

export function getStoreDataKeys(storeId: string) {
  const p = storeId === 'default' ? 'wp' : `wp-${storeId}`
  return {
    demand:          `${p}-demand`,
    demandFiltered:  `${p}-demand-filtered`,
    momentum:        `${p}-momentum`,
    momentumFiltered:`${p}-momentum-filtered`,
  }
}

export function loadStores(): WinningStore[] {
  try {
    const raw = localStorage.getItem(STORES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WinningStore[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return [DEFAULT_STORE]
}

export function saveStores(stores: WinningStore[]) {
  try { localStorage.setItem(STORES_KEY, JSON.stringify(stores)) } catch {}
}

export function loadActiveStoreId(stores: WinningStore[]): string {
  try {
    const id = localStorage.getItem(ACTIVE_STORE_KEY)
    if (id && stores.some(s => s.id === id)) return id
  } catch {}
  return stores[0]?.id ?? DEFAULT_STORE.id
}

export function saveActiveStoreId(id: string) {
  try { localStorage.setItem(ACTIVE_STORE_KEY, id) } catch {}
}

function normTitle(s: string) { return s.toLowerCase().trim() }

function loadTitleSet(filteredKey: string, rawKey: string): Set<string> {
  const s = new Set<string>()
  try {
    const raw = localStorage.getItem(filteredKey) || localStorage.getItem(rawKey)
    if (!raw) return s
    const stored = JSON.parse(raw) as { rows: { title: string }[] }
    for (const r of stored.rows ?? []) if (r.title) s.add(normTitle(r.title))
  } catch {}
  return s
}

export function loadWinningTitles(storeId: string): Set<string> {
  const keys = getStoreDataKeys(storeId)
  const demand   = loadTitleSet(keys.demandFiltered, keys.demand)
  const momentum = loadTitleSet(keys.momentumFiltered, keys.momentum)
  if (demand.size === 0 || momentum.size === 0) return new Set()
  const result = new Set<string>()
  for (const t of demand) if (momentum.has(t)) result.add(t)
  return result
}

export function loadCsvWinners(storeId: string): { demand: CsvProduct[]; momentum: CsvProduct[] } {
  const keys = getStoreDataKeys(storeId)
  const parse = (filteredKey: string, rawKey: string): CsvProduct[] => {
    try {
      const filtered = localStorage.getItem(filteredKey)
      if (filtered) {
        const stored = JSON.parse(filtered) as { rows: CsvProduct[] }
        if (stored.rows?.length) return stored.rows
      }
      const raw = localStorage.getItem(rawKey)
      if (!raw) return []
      const stored = JSON.parse(raw) as { rows: CsvProduct[] }
      return stored.rows ?? []
    } catch { return [] }
  }
  return {
    demand:   parse(keys.demandFiltered, keys.demand),
    momentum: parse(keys.momentumFiltered, keys.momentum),
  }
}

export interface StoreCsvWinners {
  storeName: string
  demand: CsvProduct[]
  momentum: CsvProduct[]
}

export function loadAllStoresWinningTitles(): Set<string> {
  const stores = loadStores()
  const result = new Set<string>()
  for (const store of stores) {
    for (const t of loadWinningTitles(store.id)) result.add(t)
  }
  return result
}

export function loadAllStoresCsvWinners(): StoreCsvWinners[] {
  const stores = loadStores()
  return stores
    .map(store => ({ storeName: store.name, ...loadCsvWinners(store.id) }))
    .filter(s => s.demand.length > 0 || s.momentum.length > 0)
}

export function isWinnerMatch(name: string, titles: Set<string>): boolean {
  const n = normTitle(name)
  for (const t of titles) {
    if (n === t || n.includes(t) || t.includes(n)) return true
  }
  return false
}
