'use client'
import { useEffect, useState } from 'react'
import { BuildsTable } from './BuildsTable'
import { api } from '@/lib/api'
import { currentMonth } from '@/lib/utils'
import type { Build, BuildType } from '@/lib/types'
import { createClient } from '@/lib/supabase'

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
    // check role
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsAdmin(data?.role === 'admin')
    })
  }, [month])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <BuildsTable builds={builds} type={type} onRefresh={loadBuilds} isAdmin={isAdmin} />
    </div>
  )
}
