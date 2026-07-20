'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRole, canAccessPath } from '@/lib/role-context'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { role, system, bioedgeShared, loading } = useRole()
  const pathname = usePathname()
  const router = useRouter()
  const fallback = system === 'bioedge' ? '/bioedge-proofread-queue' : '/proofread-queue'

  useEffect(() => {
    if (loading) return
    if (!canAccessPath(role, pathname, system, bioedgeShared)) {
      router.replace(fallback)
    }
  }, [role, system, bioedgeShared, loading, pathname])

  if (loading) return <p className="text-sm text-text-muted font-mono">Loading…</p>
  if (!canAccessPath(role, pathname, system, bioedgeShared)) return null

  return <>{children}</>
}
