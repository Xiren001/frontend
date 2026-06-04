'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Build } from '@/lib/types'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'

export default function ProofreadQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])

  useEffect(() => {
    api.get<Build[]>('/api/builds/proofread-queue').then(setBuilds).catch(console.error)
  }, [])

  const columns: ResponsiveColumn<Build>[] = [
    {
      key: 'build',
      header: 'Build',
      render: b => <span className="font-medium text-foreground">{b.product_name}</span>,
    },
    {
      key: 'language',
      header: 'Language',
      mono: true,
      render: b => b.language ?? '—',
    },
    {
      key: 'week',
      header: 'Week',
      mono: true,
      render: b => b.week_number,
    },
    {
      key: 'entered',
      header: 'Entered Proofread',
      mono: true,
      render: b => formatDate(b.into_proofread),
    },
    {
      key: 'days',
      header: 'Days in proofread',
      align: 'right',
      mono: true,
      render: b => {
        const daysIn = b.proof_days ?? (b.into_proofread
          ? Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86400000)
          : null)
        return <span className="font-medium text-foreground">{daysIn ?? '—'}</span>
      },
    },
    {
      key: 'flag',
      header: 'Flag',
      render: b => {
        const daysIn = b.proof_days ?? (b.into_proofread
          ? Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86400000)
          : null)
        const flagged = daysIn !== null && daysIn > 3
        return flagged
          ? <Badge variant="danger">RED</Badge>
          : <span className="text-text-muted">—</span>
      },
    },
    {
      key: 'proofreader',
      header: 'Proofreader',
      render: b => b.proofreader ?? '—',
    },
    {
      key: 'actions',
      header: '',
      hideOnMobile: true,
      align: 'right',
      render: b => (
        <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright">
          QA
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Proofread Queue"
        description="Phase 2 builds awaiting proofread. Items flagged red exceed the proofread target."
      />

      <ResponsiveTable
        columns={columns}
        data={builds}
        rowKey={b => b.id}
        emptyMessage="Queue is empty — all clear."
        rowClassName={b => {
          const daysIn = b.proof_days ?? (b.into_proofread
            ? Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86400000)
            : null)
          return daysIn !== null && daysIn > 3 ? 'bg-danger-muted/30' : undefined
        }}
        mobileTitle={b => b.product_name}
        mobileSubtitle={b => [b.language, `Week ${b.week_number}`].filter(Boolean).join(' · ')}
        mobileActions={b => (
          <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright">
            QA →
          </Link>
        )}
      />
    </div>
  )
}
