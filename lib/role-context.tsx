'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'
import type { UserRole } from './types'

interface RoleState {
  role: UserRole | null
  userLangs: string[] | null  // set for language-specific proofreader roles, e.g. ["ES"] or ["ES", "FR"]
  loading: boolean
}

const Ctx = createContext<RoleState>({ role: null, userLangs: null, loading: true })

function parseRawRole(raw: string): { role: UserRole; userLangs: string[] | null } {
  const m = raw.match(/^proofreader_([a-z]+)$/i)
  if (m) return { role: 'proofreader', userLangs: [m[1].toUpperCase()] }
  return { role: raw as UserRole, userLangs: null }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleState>({ role: null, userLangs: null, loading: true })

  useEffect(() => {
    api.get<{ userRole: string; userLangs?: string[] | null }>('/api/me')
      .then(d => {
        const { role, userLangs } = parseRawRole(d.userRole)
        setState({ role, userLangs: d.userLangs ?? userLangs, loading: false })
      })
      .catch(async () => {
        // /api/me failed — fall back to querying Supabase directly on the client
        try {
          const { createClient } = await import('./supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setState({ role: null, userLangs: null, loading: false }); return }
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          const raw = (data?.role ?? 'website') as string
          const { role, userLangs } = parseRawRole(raw)
          setState({ role, userLangs, loading: false })
        } catch {
          setState({ role: 'website', userLangs: null, loading: false })
        }
      })
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export function useRole() { return useContext(Ctx) }

export function canAccessPath(role: UserRole | null, path: string): boolean {
  if (!role) return false
  if (role === 'admin') return true

  const base = '/' + path.split('/').filter(Boolean)[0]

  // Proofreader (incl. lang proofreaders) and Ads: only proofread-queue, copy-review, and their BioEdge equivalents
  if (role === 'proofreader' || role === 'ads') {
    return ['/proofread-queue', '/copy-review', '/bioedge-proofread-queue', '/bioedge-copy-review'].includes(base)
  }

  // Management: most pages except settings and non-relevant tools
  if (role === 'management') {
    const blocked = ['/settings', '/winning-products', '/product-ranking']
    return !blocked.includes(base)
  }
  // Website: all pages except settings and proofreader-payments
  if (role === 'website') {
    return base !== '/settings' && base !== '/proofreader-payments'
  }

  return false
}
