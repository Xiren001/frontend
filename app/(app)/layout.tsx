import { NavSidebar } from '@/components/NavSidebar'
import { RoleProvider } from '@/lib/role-context'
import { RouteGuard } from '@/components/RouteGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex h-full min-h-screen bg-surface">
        <NavSidebar />
        <main className="flex-1 overflow-y-auto bg-background pt-14 lg:pt-0">
          <div className="w-full px-6 py-6 md:py-10 lg:px-8 lg:py-12">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
    </RoleProvider>
  )
}
