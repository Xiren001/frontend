import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function DecisionRightsPage() {
  const DECISIONS = [
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

  function roleBadge(val: string) {
    if (val === '—') return <span className="text-text-muted">—</span>
    if (val === 'Decides') return <Badge variant="accent">{val}</Badge>
    if (val === 'Approves' || val === 'Approves*') return <Badge variant="accent">{val}</Badge>
    if (val === 'Recommends') return <Badge variant="warn">{val}</Badge>
    if (val === 'Informed') return <Badge variant="muted">{val}</Badge>
    return <span className="text-text-muted">{val}</span>
  }

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
            <Table className="border-0 rounded-none">
              <TableHead>
                <TableRow>
                  <TableHeader>Decision</TableHeader>
                  <TableHeader className="text-center w-28">Myko</TableHeader>
                  <TableHeader className="text-center w-28">Abigél</TableHeader>
                  <TableHeader className="text-center w-28">Owner</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-foreground">{item.decision}</TableCell>
                    <TableCell className="text-center">{roleBadge(item.myko)}</TableCell>
                    <TableCell className="text-center">{roleBadge(item.abigel)}</TableCell>
                    <TableCell className="text-center">{roleBadge(item.owner)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  )
}
