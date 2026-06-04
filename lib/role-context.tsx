'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'
import type { ApproverPermissions, UserRole } from './types'

interface RoleState {
  role: UserRole | null
  permissions: ApproverPermissions | null
  loading: boolean
}

const Ctx = createContext<RoleState>({ role: null, permissions: null, loading: true })

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleState>({ role: null, permissions: null, loading: true })
  useEffect(() => {
    api.get<{ userRole: UserRole; approverPermissions: ApproverPermissions | null }>('/api/me')
      .then(d => setState({ role: d.userRole, permissions: d.approverPermissions, loading: false }))
      .catch(() => setState({ role: null, permissions: null, loading: false }))
  }, [])
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export function useRole() { return useContext(Ctx) }

// Map from URL path prefix to permission key (null = always allowed for approver/viewer)
export const PATH_PERMISSION: Record<string, keyof ApproverPermissions | null> = {
  '/weekly-report':   null,
  '/monthly-report':  null,
  '/dashboard':       'dashboard',
  '/jewelry-tracker': 'jewelry_tracker',
  '/funnel-tracker':  'funnel_tracker',
  '/proofread-queue': 'proofread_queue',
  '/mistake-log':     'mistake_log',
  '/monthly-planner': 'monthly_planner',
  '/decision-rights': 'decision_rights',
  '/settings':        'settings',
  '/qa-checklist':    'jewelry_tracker',
}

export function canAccessPath(role: UserRole | null, path: string, permissions: ApproverPermissions | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const base = '/' + path.split('/').filter(Boolean)[0]
  if (role === 'viewer') return base === '/weekly-report' || base === '/monthly-report'
  if (role === 'approver') {
    const key = PATH_PERMISSION[base]
    if (key === undefined) return false
    if (key === null) return true
    return permissions?.[key] === true
  }
  return false
}
