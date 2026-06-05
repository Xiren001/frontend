'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Gem,
  Filter,
  ListChecks,
  AlertTriangle,
  CalendarDays,
  BarChart3,
  Calendar,
  Scale,
  FileCheck,
  Settings,
  LogOut,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useRole, PATH_PERMISSION } from '@/lib/role-context'
import { useState, useEffect } from 'react'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/jewelry-tracker', label: 'Jewelry Tracker',  icon: Gem },
  { href: '/funnel-tracker',  label: 'Funnel Tracker',   icon: Filter },
  { href: '/proofread-queue', label: 'Proofread Queue',  icon: ListChecks },
  { href: '/copy-review',     label: 'Proofreading ES·DE', icon: FileCheck },
  { href: '/mistake-log',     label: 'Mistake Log',      icon: AlertTriangle },
  { href: '/weekly-report',   label: 'Weekly Report',    icon: CalendarDays },
  { href: '/monthly-report',  label: 'Monthly Report',   icon: BarChart3 },
  { href: '/monthly-planner', label: 'Monthly Planner',  icon: Calendar },
  { href: '/decision-rights', label: 'Decision Rights',  icon: Scale },
  { href: '/settings',        label: 'Settings',         icon: Settings },
]

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role, permissions, viewerPermissions } = useRole()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setCollapsed(saved === 'true')
    } else {
      setCollapsed(window.innerWidth < 768)
    }
  }, [])

  function toggleCollapse() {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const visibleNav = NAV.filter(item => {
    if (role === 'admin') return true
    const key = PATH_PERMISSION[item.href]
    if (role === 'viewer') {
      if (key === null) return true
      if (key === undefined) return false
      return viewerPermissions?.[key] === true
    }
    if (role === 'approver') {
      if (key === null) return true
      if (key === undefined) return false
      return permissions?.[key] === true
    }
    return false
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'shrink-0 flex flex-col border-r border-border-subtle bg-surface-elevated h-screen sticky top-0 transition-[width] duration-200 overflow-hidden shadow-sm',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* ── Header ── */}
      <div
        className={cn(
          'flex items-center border-b border-border-subtle h-16 px-3',
          collapsed ? 'justify-center' : 'justify-between gap-2',
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none">Myko Ops</p>
              <p className="text-xs text-text-muted mt-0.5">Hub</p>
            </div>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'shrink-0 flex items-center justify-center rounded-md w-7 h-7 text-text-muted',
            'hover:bg-surface-hover hover:text-foreground transition-colors',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {visibleNav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg py-2 text-sm mb-0.5 transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
                active
                  ? 'bg-accent-muted text-accent font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-foreground',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-text-muted')} />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Sign out ── */}
      <div className="px-2 py-3 border-t border-border-subtle">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex w-full items-center rounded-md py-2 text-sm text-text-muted',
            'hover:bg-surface-hover hover:text-foreground transition-colors',
            collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
