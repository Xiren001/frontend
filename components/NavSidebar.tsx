'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',         label: 'Dashboard' },
  { href: '/jewelry-tracker',   label: 'Jewelry Tracker' },
  { href: '/funnel-tracker',    label: 'Funnel Tracker' },
  { href: '/proofread-queue',   label: 'Proofread Queue' },
  { href: '/mistake-log',       label: 'Mistake Log' },
  { href: '/weekly-report',     label: 'Weekly Report' },
  { href: '/monthly-report',    label: 'Monthly Report' },
  { href: '/monthly-planner',   label: 'Monthly Planner' },
  { href: '/decision-rights',   label: 'Decision Rights' },
  { href: '/settings',          label: 'Settings' },
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
    <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 tracking-tight">MYKO OPS HUB</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block rounded-md px-3 py-2 text-sm mb-0.5 transition-colors',
              pathname === item.href
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
