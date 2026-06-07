'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'
import type { UserRole } from './types'

interface RoleState {
  role: UserRole | null
  loading: boolean
}

const Ctx = createContext<RoleState>({ role: null, loading: true })

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleState>({ role: null, loading: true })

  useEffect(() => {
    api.get<{ userRole: UserRole }>('/api/me')
      .then(d => setState({ role: d.userRole, loading: false }))
      .catch(async () => {
        // /api/me failed — fall back to querying Supabase directly on the client
        try {
          const { createClient } = await import('./supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setState({ role: null, loading: false }); return }
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          setState({ role: (data?.role ?? 'website') as UserRole, loading: false })
        } catch {
          setState({ role: 'website', loading: false })
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

  // Proofreader and Ads: only queue and review pages
  if (role === 'proofreader' || role === 'ads') {
    return base === '/proofread-queue' || base === '/copy-review'
        || base === '/funnel-queue'    || base === '/funnel-review'
  }

  // Management and Website: all pages except settings
  if (role === 'management' || role === 'website') {
    return base !== '/settings'
  }

  return false
}
