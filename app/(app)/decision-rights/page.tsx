'use client'

import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'

interface DecisionItem {
  decision: string
  myko: string
  abigel: string
  owner: string
}

interface DecisionGroup {
  section: string
  items: DecisionItem[]
}

function roleBadge(val: string) {
  if (val === '—') return <span className="text-text-muted">—</span>
  if (val === 'Decides') return <Badge variant="accent">{val}</Badge>
  if (val === 'Approves' || val === 'Approves*') return <Badge variant="accent">{val}</Badge>
  if (val === 'Recommends') return <Badge variant="warn">{val}</Badge>
  if (val === 'Informed') return <Badge variant="muted">{val}</Badge>
  return <span className="text-text-muted">{val}</span>
}

const columns: ResponsiveColumn<DecisionItem>[] = [
  {
    key: 'decision',
    header: 'Decision',
    render: item => <span className="text-foreground">{item.decision}</span>,
  },
  {
    key: 'myko',
    header: 'Myko',
    align: 'center',
    render: item => roleBadge(item.myko),
  },
  {
    key: 'abigel',
    header: 'Abigél',
    align: 'center',
    render: item => roleBadge(item.abigel),
  },
  {
    key: 'owner',
    header: 'Owner',
    align: 'center',
    render: item => roleBadge(item.owner),
  },
]

export default function DecisionRightsPage() {
  const DECISIONS: DecisionGroup[] = [
    {
      section: 'Build / Process Decisions',
      items: [
        { decision: 'Shopify theme / Funnelish page-template changes affecting future builds', myko: 'Decides', abigel: '—', owner: '—' },
        { decision: 'Enable a new payment method in Shopify checkout (owner approves if cost > $500)', myko: 'Recommends', abigel: 'Approves', owner: 'Approves*' },
        { decision: 'Change the Funnelish sales-page → Shopify checkout redirect rules', myko: 'Decides', abigel: '—', owner: '—' },
        { decision: 'Add / change translation vendor or proofreader', myko: 'Decides', abigel: '—', owner: '—' },
        { decision: 'Hire a builder / designer', myko: 'Recommends', abigel: 'Approves', owner: '—' },
        { decision: 'Fire a team member (under 90 days)', myko: 'Decides', abigel: 'Informed', owner: '—' },
        { decision: 'Fire a team member (90+ days tenured)', myko: 'Recommends', abigel: 'Approves', owner: 'Informed' },
        { decision: 'Add a new tool to the stack (Abigél ≤ $100/mo; owner above)', myko: 'Recommends', abigel: 'Approves', owner: 'Approves*' },
      ],
    },
    {
      section: 'Quality Gates',
      items: [
        { decision: 'Approve a build out of Phase 1 → Phase 2 (build + checkout test verified)', myko: 'Decides', abigel: '—', owner: '—' },
        { decision: 'Kill a test early (before kill date)', myko: 'Decides', abigel: 'Informed', owner: '—' },
        { decision: 'Scale a winner across all geos', myko: 'Decides', abigel: 'Informed', owner: '—' },
        { decision: 'Approve a new SOP (from mistake pattern)', myko: 'Decides', abigel: 'Informed', owner: '—' },
      ],
    },
  ]

  return (
    <div>
      <PageHeader
        title="Decision Rights"
        description="Myko ↔ Abigél ↔ Owner. * = threshold-based approval (see Settings)."
      />

      <div className="space-y-6">
        {DECISIONS.map(group => (
          <Card key={group.section} className="overflow-hidden">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{group.section}</p>
            </CardHeader>
            <div className="p-4 pt-0 md:p-0">
              <ResponsiveTable
                columns={columns}
                data={group.items}
                rowKey={item => item.decision}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
