import { NavSidebar } from '@/components/NavSidebar'
import { RoleProvider } from '@/lib/role-context'
import { RouteGuard } from '@/components/RouteGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex h-full min-h-screen bg-background">
        <NavSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-1 py-8">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
    </RoleProvider>
  )
}
