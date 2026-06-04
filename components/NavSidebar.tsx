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
  Settings,
  LogOut,
  Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/jewelry-tracker', label: 'Jewelry Tracker',  icon: Gem },
  { href: '/funnel-tracker',  label: 'Funnel Tracker',   icon: Filter },
  { href: '/proofread-queue', label: 'Proofread Queue',  icon: ListChecks },
  { href: '/mistake-log',     label: 'Mistake Log',      icon: AlertTriangle },
  { href: '/weekly-report',   label: 'Weekly Report',  icon: CalendarDays },
  { href: '/monthly-report',  label: 'Monthly Report', icon: BarChart3 },
  { href: '/monthly-planner', label: 'Monthly Planner', icon: Calendar },
  { href: '/decision-rights', label: 'Decision Rights',  icon: Scale },
  { href: '/settings',        label: 'Settings',         icon: Settings },
]

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-border-subtle bg-surface h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-muted border border-accent-border">
            <Terminal className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <p className="text-xs font-mono font-medium text-foreground tracking-wide">myko</p>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">ops hub</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm mb-0.5 transition-colors',
                active
                  ? 'bg-accent-muted text-accent-bright font-medium border border-accent-border/50'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-foreground border border-transparent',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-text-muted')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border-subtle">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
