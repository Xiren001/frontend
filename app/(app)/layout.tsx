import { NavSidebar } from '@/components/NavSidebar'
import { RoleProvider } from '@/lib/role-context'
import { RouteGuard } from '@/components/RouteGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex h-full min-h-screen bg-surface">
        <NavSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="w-full max-w-[1400px] mx-auto px-6 py-10 lg:px-8 lg:py-12">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
    </RoleProvider>
  )
}
