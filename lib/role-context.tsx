'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'
import type { UserRole } from './types'

interface RoleState {
  role: UserRole | null
  userLang: string | null  // set for language-specific proofreader roles e.g. "ES"
  loading: boolean
}

const Ctx = createContext<RoleState>({ role: null, userLang: null, loading: true })

function parseRawRole(raw: string): { role: UserRole; userLang: string | null } {
  const m = raw.match(/^proofreader_([a-z]+)$/i)
  if (m) return { role: 'proofreader', userLang: m[1].toUpperCase() }
  return { role: raw as UserRole, userLang: null }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleState>({ role: null, userLang: null, loading: true })

  useEffect(() => {
    api.get<{ userRole: string; userLang?: string | null }>('/api/me')
      .then(d => {
        const { role, userLang } = parseRawRole(d.userRole)
        setState({ role, userLang: d.userLang ?? userLang, loading: false })
      })
      .catch(async () => {
        // /api/me failed — fall back to querying Supabase directly on the client
        try {
          const { createClient } = await import('./supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setState({ role: null, userLang: null, loading: false }); return }
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          const raw = (data?.role ?? 'website') as string
          const { role, userLang } = parseRawRole(raw)
          setState({ role, userLang, loading: false })
        } catch {
          setState({ role: 'website', userLang: null, loading: false })
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

  // Proofreader (incl. lang proofreaders) and Ads: only proofread-queue and copy-review
  if (role === 'proofreader' || role === 'ads') {
    return base === '/proofread-queue' || base === '/copy-review'
  }

  // Management: most pages except settings and non-relevant tools
  if (role === 'management') {
    const blocked = ['/settings', '/team-tasks', '/monthly-planner', '/winning-products', '/product-ranking']
    return !blocked.includes(base)
  }
  // Website: all pages except settings and proofreader-payments
  if (role === 'website') {
    return base !== '/settings' && base !== '/proofreader-payments'
  }

  return false
}
