'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Build } from '@/lib/types'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function ProofreadQueuePage() {
  const [builds, setBuilds] = useState<Build[]>([])

  useEffect(() => {
    api.get<Build[]>('/api/builds/proofread-queue').then(setBuilds).catch(console.error)
  }, [])

  return (
    <div>
      <PageHeader
        title="Proofread Queue"
        description="Phase 2 builds awaiting proofread. Items flagged red exceed the proofread target."
      />

      {builds.length === 0 ? (
        <p className="text-sm text-text-muted font-mono">Queue is empty — all clear.</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Build</TableHeader>
              <TableHeader>Language</TableHeader>
              <TableHeader>Week</TableHeader>
              <TableHeader>Entered Proofread</TableHeader>
              <TableHeader className="text-right">Days in proofread</TableHeader>
              <TableHeader>Flag</TableHeader>
              <TableHeader>Proofreader</TableHeader>
              <TableHeader />
            </TableRow>
          </TableHead>
          <TableBody>
            {builds.map(b => {
              const daysIn = b.proof_days ?? (b.into_proofread ? Math.round((Date.now() - new Date(b.into_proofread).getTime()) / 86400000) : null)
              const flagged = daysIn !== null && daysIn > 3
              return (
                <TableRow key={b.id} className={flagged ? 'bg-danger-muted/30' : ''}>
                  <TableCell className="font-medium text-foreground">{b.product_name}</TableCell>
                  <TableCell mono>{b.language ?? '—'}</TableCell>
                  <TableCell mono>{b.week_number}</TableCell>
                  <TableCell mono>{formatDate(b.into_proofread)}</TableCell>
                  <TableCell mono className="text-right font-medium text-foreground">{daysIn ?? '—'}</TableCell>
                  <TableCell>
                    {flagged
                      ? <Badge variant="danger">RED</Badge>
                      : <span className="text-text-muted">—</span>}
                  </TableCell>
                  <TableCell>{b.proofreader ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/qa-checklist/${b.id}`} className="text-xs text-accent hover:text-accent-bright">QA</Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
