import { NavSidebar } from '@/components/NavSidebar'
import { RoleProvider } from '@/lib/role-context'
import { RouteGuard } from '@/components/RouteGuard'
import { PresenceBar } from '@/components/PresenceBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex h-full min-h-screen bg-surface">
        <NavSidebar />
        <main className="flex-1 overflow-hidden flex flex-col bg-background pt-14 lg:pt-0">
          <PresenceBar />
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col w-full px-6 py-6 md:py-10 lg:px-8 lg:py-12">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
    </RoleProvider>
  )
}
