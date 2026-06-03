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

  const cellStyle = (val: string) => {
    if (val === 'Decides') return 'text-blue-700 font-medium'
    if (val === 'Approves' || val === 'Approves*') return 'text-green-700 font-medium'
    if (val === 'Recommends') return 'text-yellow-700'
    if (val === 'Informed') return 'text-gray-500'
    return 'text-gray-300'
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Decision Rights</h1>
      <p className="text-sm text-gray-400 mb-6">Myko ↔ Abigél ↔ Owner. * = threshold-based approval (see Settings).</p>

      <div className="space-y-6">
        {DECISIONS.map(group => (
          <div key={group.section} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group.section}</p>
            </div>
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Decision</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-28">Myko</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-28">Abigél</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-28">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {group.items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{item.decision}</td>
                    <td className={`px-4 py-3 text-center text-xs ${cellStyle(item.myko)}`}>{item.myko}</td>
                    <td className={`px-4 py-3 text-center text-xs ${cellStyle(item.abigel)}`}>{item.abigel}</td>
                    <td className={`px-4 py-3 text-center text-xs ${cellStyle(item.owner)}`}>{item.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
