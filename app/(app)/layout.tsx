import { NavSidebar } from '@/components/NavSidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-10">{children}</div>
      </main>
    </div>
  )
}
