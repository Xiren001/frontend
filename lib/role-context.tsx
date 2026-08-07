'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'
import type { UserRole } from './types'

export type System = 'waves' | 'bioedge'

interface RoleState {
  role: UserRole | null
  userLangs: string[] | null  // set for language-specific proofreader roles, e.g. ["ES"] or ["ES", "FR"]
  system: System   // which proofreading system this login belongs to (bioedge_* role prefix); irrelevant for admin
  bioedgeShared: boolean  // when true, Waves/BioEdge login+notification separation is relaxed (opt-in setting)
  loading: boolean
}

const Ctx = createContext<RoleState>({ role: null, userLangs: null, system: 'waves', bioedgeShared: false, loading: true })

function parseRawRole(raw: string): { role: UserRole; userLangs: string[] | null; system: System } {
  const isBioedge = raw.startsWith('bioedge_')
  const stripped = isBioedge ? raw.slice('bioedge_'.length) : raw
  const system: System = isBioedge ? 'bioedge' : 'waves'
  const m = stripped.match(/^proofreader_([a-z]+)$/i)
  if (m) return { role: 'proofreader', userLangs: [m[1].toUpperCase()], system }
  return { role: stripped as UserRole, userLangs: null, system }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleState>({ role: null, userLangs: null, system: 'waves', bioedgeShared: false, loading: true })

  useEffect(() => {
    api.get<{ userRole: string; userLangs?: string[] | null; system?: System; bioedgeShared?: boolean }>('/api/me')
      .then(d => {
        const { role, userLangs, system } = parseRawRole(d.userRole)
        setState({ role, userLangs: d.userLangs ?? userLangs, system: d.system ?? system, bioedgeShared: d.bioedgeShared ?? false, loading: false })
      })
      .catch(async () => {
        // /api/me failed — fall back to querying Supabase directly on the client
        try {
          const { createClient } = await import('./supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setState({ role: null, userLangs: null, system: 'waves', bioedgeShared: false, loading: false }); return }
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          const raw = (data?.role ?? 'website') as string
          const { role, userLangs, system } = parseRawRole(raw)
          setState({ role, userLangs, system, bioedgeShared: false, loading: false })
        } catch {
          setState({ role: 'website', userLangs: null, system: 'waves', bioedgeShared: false, loading: false })
        }
      })
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export function useRole() { return useContext(Ctx) }

const BIOEDGE_PATHS = ['/bioedge', '/bioedge-proofread-queue', '/bioedge-copy-review']
const WAVES_ONLY_PATHS = ['/waves-report', '/waves', '/proofread-queue', '/copy-review', '/proofreader-payments']

export function canAccessPath(role: UserRole | null, path: string, system: System = 'waves', bioedgeShared: boolean = false): boolean {
  if (!role) return false
  if (role === 'admin') return true

  const base = '/' + path.split('/').filter(Boolean)[0]

  // A bioedge_* login can never reach Waves-only pages, and vice versa — regardless of role.
  // Skipped entirely when the "share BioEdge with Waves" setting is on.
  if (!bioedgeShared) {
    if (system === 'bioedge' && WAVES_ONLY_PATHS.includes(base)) return false
    if (system !== 'bioedge' && BIOEDGE_PATHS.includes(base)) return false
  }

  // Proofreader (incl. lang proofreaders) and Ads: only proofread-queue, copy-review, and their BioEdge equivalents
  if (role === 'proofreader' || role === 'ads') {
    return ['/proofread-queue', '/copy-review', '/bioedge-proofread-queue', '/bioedge-copy-review'].includes(base)
  }

  // Management: most pages except settings, non-relevant tools, and admin-only Team Performance
  if (role === 'management') {
    const blocked = ['/settings', '/winning-products', '/product-ranking', '/team-performance']
    return !blocked.includes(base)
  }
  // Website: all pages except settings, proofreader-payments, and admin-only Team Performance
  if (role === 'website') {
    return base !== '/settings' && base !== '/proofreader-payments' && base !== '/team-performance'
  }

  return false
}
