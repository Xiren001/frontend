'use client'
import { useEffect, useState } from 'react'
import { BuildsTable } from './BuildsTable'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { useRole } from '@/lib/role-context'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'

interface Props {
  type: BuildType
  title: string
}

export function TrackerPage({ type, title }: Props) {
  const [builds, setBuilds] = useState<Build[]>([])
  const [month, setMonth] = useState(currentMonth())
  const { role } = useRole()

  const isAdmin = role === 'admin'
  const canBatchManage = role === 'admin' || role === 'management'

  async function loadBuilds() {
    const data = await api.get<Build[]>(`/api/builds?type=${type}&month=${month}`)
    setBuilds(data)
  }

  useRealtimeRefresh('builds', loadBuilds)

  useEffect(() => { loadBuilds() }, [month])

  return (
    <div>
      <PageHeader
        title={title}
        actions={
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-auto"
            mono
          />
        }
      />
      <BuildsTable builds={builds} type={type} month={month} onRefresh={loadBuilds} isAdmin={isAdmin} canBatchManage={canBatchManage} />
    </div>
  )
}
