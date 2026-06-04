'use client'
import { useEffect, useState } from 'react'
import { BuildsTable } from './BuildsTable'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'

interface Props {
  type: BuildType
  title: string
}

export function TrackerPage({ type, title }: Props) {
  const [builds, setBuilds] = useState<Build[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [isAdmin, setIsAdmin] = useState(false)

  async function loadBuilds() {
    const data = await api.get<Build[]>(`/api/builds?type=${type}&month=${month}`)
    setBuilds(data)
  }

  useEffect(() => {
    loadBuilds()
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [month])

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
      <BuildsTable builds={builds} type={type} month={month} onRefresh={loadBuilds} isAdmin={isAdmin} />
    </div>
  )
}
