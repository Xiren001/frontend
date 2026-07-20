'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Gem,
  ListChecks,
  TrendingUp,
  FileCheck,
  Settings,
  LogOut,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Wallet,
  Waves,
  Leaf,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useRole } from '@/lib/role-context'
import { useState, useEffect } from 'react'

const NAV: { href: string; label: string; icon: React.ElementType; deprecated?: boolean; section?: string }[] = [
  { href: '/waves-report',          label: 'Wave Dashboard',      icon: TrendingUp },
  { href: '/waves',                 label: 'Waves',               icon: Waves },
  { href: '/proofread-queue',       label: 'Proofread Queue',     icon: ListChecks },
  { href: '/copy-review',           label: 'Proofreading',        icon: FileCheck },
  { href: '/proofreader-payments',  label: 'Proofreader Payments',icon: Wallet },
  { href: '/bioedge',                 label: 'BioEdge',             icon: Leaf, section: 'BioEdge' },
  { href: '/bioedge-proofread-queue', label: 'BioEdge Queue',       icon: Leaf, section: 'BioEdge' },
  { href: '/bioedge-copy-review',     label: 'BioEdge Proofreading',icon: Leaf, section: 'BioEdge' },
  { href: '/settings',              label: 'Settings',            icon: Settings },
  { href: '/jewelry-tracker',       label: 'Jewelry Tracker',     icon: Gem, deprecated: true },
]

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useRole()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setCollapsed(saved === 'true')
    } else {
      setCollapsed(window.innerWidth < 1024)
    }
  }, [])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function toggleCollapse() {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const visibleNav = NAV.filter(item => {
    if (role === 'admin') return true
    if (role === 'proofreader') {
      return ['/proofread-queue', '/copy-review', '/bioedge-proofread-queue', '/bioedge-copy-review'].includes(item.href)
    }
    if (role === 'ads') {
      return ['/proofread-queue', '/copy-review', '/bioedge-proofread-queue', '/bioedge-copy-review'].includes(item.href)
    }
    if (role === 'management') {
      return item.href !== '/settings'
    }
    if (role === 'website') {
      return item.href !== '/settings' && item.href !== '/proofreader-payments'
    }
    return false
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Mobile top bar (hidden on desktop) ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 h-14 px-4 bg-surface-elevated border-b border-border-subtle lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
            <Terminal className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-foreground">ECOM Faszik</span>
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex flex-col border-r border-border-subtle bg-surface-elevated overflow-hidden',
          // Mobile: fixed overlay, always 256px wide, slides in from left
          'fixed inset-y-0 left-0 z-50 w-64 shadow-xl',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static, sticky, variable width, no translate
          'lg:static lg:inset-auto lg:z-auto lg:translate-x-0 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen lg:shadow-sm',
          'lg:transition-[width] lg:duration-200',
          collapsed ? 'lg:w-14' : 'lg:w-60',
        )}
      >
        {/* ── Header ── */}
        <div
          className={cn(
            'flex items-center border-b border-border-subtle h-16 px-3',
            collapsed ? 'md:justify-center' : 'justify-between gap-2',
          )}
        >
          {/* Logo — always shown on mobile, hidden when collapsed on desktop */}
          <div className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'lg:hidden')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none">ECOM Faszik</p>
              <p className="text-xs text-text-muted mt-0.5">Hub</p>
            </div>
          </div>

          {/* Mobile: close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Desktop: collapse toggle */}
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'shrink-0 hidden lg:flex items-center justify-center rounded-md w-7 h-7 text-text-muted',
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
          {visibleNav.map((item, i) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            const prevItem = visibleNav[i - 1]
            const showDeprecatedDivider = item.deprecated && !prevItem?.deprecated
            const showSectionDivider = item.section && item.section !== prevItem?.section
            return (
              <React.Fragment key={item.href}>
                {showSectionDivider && (
                  <div className={cn('mt-2 mb-1', collapsed && 'lg:mx-1')}>
                    <div className="border-t border-border-subtle mb-1.5" />
                    {!collapsed && (
                      <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">{item.section}</p>
                    )}
                  </div>
                )}
                {showDeprecatedDivider && (
                  <div className={cn('my-2 border-t border-border-subtle', collapsed && 'lg:mx-1')} />
                )}
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 rounded-lg py-2 text-sm mb-0.5 transition-colors',
                    collapsed && 'lg:justify-center lg:px-2',
                    item.deprecated
                      ? active
                        ? 'bg-surface text-text-muted font-medium'
                        : 'text-text-muted/60 hover:bg-surface-hover hover:text-text-muted'
                      : active
                        ? 'bg-accent-muted text-accent font-medium'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', item.deprecated ? 'text-text-muted/40' : active ? 'text-accent' : 'text-text-muted')} />
                  <span className={cn('flex items-center gap-1.5 min-w-0', collapsed && 'lg:hidden')}>
                    <span className={cn(item.deprecated && 'line-through')}>{item.label}</span>
                    {item.deprecated && !collapsed && (
                      <span className="text-[9px] font-medium uppercase tracking-wider text-text-muted/50 shrink-0">deprecated</span>
                    )}
                  </span>
                </Link>
              </React.Fragment>
            )
          })}
        </nav>

        {/* ── Sign out ── */}
        <div className="px-2 py-3 border-t border-border-subtle">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 rounded-md py-2 text-sm text-text-muted',
              'hover:bg-surface-hover hover:text-foreground transition-colors',
              collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && 'lg:hidden')}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
