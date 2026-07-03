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

interface ProofProduct {
  product_name: string
  done: boolean
  pdp_url: string | null
  drive_folder: string | null
  ready_for_revision: boolean
  correction_count: number
}

function proofGroup(p: ProofProduct): number {
  if (p.done) return 4
  if (!p.pdp_url || !p.drive_folder) return 3
  if (p.ready_for_revision) return 2
  if (p.correction_count === 0) return 0
  return 1
}

interface Props {
  type: BuildType
  title: string
}

export function TrackerPage({ type, title }: Props) {
  const [builds, setBuilds] = useState<Build[]>([])
  const [proofStatusMap, setProofStatusMap] = useState<Record<string, number>>({})
  const [month, setMonth] = useState(currentMonth())
  const { role } = useRole()

  const isAdmin = role === 'admin'
  const canBatchManage = role === 'admin' || role === 'management'

  async function loadBuilds() {
    const data = await api.get<Build[]>(`/api/builds?type=${type}&month=${month}`)
    setBuilds(data)
  }

  async function loadProofStatus() {
    const products = await api.get<ProofProduct[]>('/api/proof-corrections/products')
    const map: Record<string, number> = {}
    for (const p of products) map[p.product_name.toLowerCase().trim()] = proofGroup(p)
    setProofStatusMap(map)
  }

  useRealtimeRefresh('builds', loadBuilds)
  useRealtimeRefresh('proof_products', loadProofStatus)

  useEffect(() => { loadBuilds() }, [month])
  useEffect(() => { loadProofStatus() }, [])

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
      <BuildsTable builds={builds} type={type} month={month} onRefresh={loadBuilds} isAdmin={isAdmin} canBatchManage={canBatchManage} proofStatusMap={proofStatusMap} />
    </div>
  )
}
