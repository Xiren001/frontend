'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRole, canAccessPath } from '@/lib/role-context'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { role, permissions, loading } = useRole()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!canAccessPath(role, pathname, permissions)) {
      router.replace('/weekly-report')
    }
  }, [role, permissions, loading, pathname])

  if (loading) return <p className="text-sm text-text-muted font-mono">Loading…</p>
  if (!canAccessPath(role, pathname, permissions)) return null

  return <>{children}</>
}
