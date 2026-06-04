'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { QAItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'

const SECTION_LABELS: Record<string, string> = {
  shopify:      'Shopify Product & Checkout (Both Operations)',
  jewelry:      'Jewelry — Shopify Page (Operation 1)',
  funnel:       'Funnel Product — Funnelish 2-page funnel (Operation 2)',
  localization: 'Localization',
}

export default function QAChecklistPage() {
  const { buildId } = useParams<{ buildId: string }>()
  const router = useRouter()
  const [items, setItems] = useState<QAItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<QAItem[]>(`/api/qa/${buildId}`).then(setItems).catch(console.error)
  }, [buildId])

  function toggle(key: string) {
    setItems(prev => prev.map(item => item.key === key ? { ...item, done: !item.done } : item))
  }

  function setNote(key: string, notes: string) {
    setItems(prev => prev.map(item => item.key === key ? { ...item, notes } : item))
  }

  async function handleSave() {
    setSaving(true)
    await api.put(`/api/qa/${buildId}`, items.map(i => ({ key: i.key, done: i.done, notes: i.notes ?? '' })))
    setSaving(false)
  }

  const sections = ['shopify', 'jewelry', 'funnel', 'localization'] as const
  const allDone = items.length > 0 && items.every(i => i.done)
  const doneCount = items.filter(i => i.done).length

  return (
    <div>
      <PageHeader
        title="Build QA Checklist"
        description="Run on every build before it leaves Building. Nothing moves to Proofread with an open box."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={allDone ? 'accent' : 'muted'}>
              {doneCount}/{items.length} done
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
          </div>
        }
      />

      <div className="space-y-6">
        {sections.map(section => {
          const sectionItems = items.filter(i => i.section === section)
          return (
            <Card key={section} className="overflow-hidden">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{SECTION_LABELS[section]}</p>
              </CardHeader>
              <div className="divide-y divide-border-subtle">
                {sectionItems.map(item => (
                  <div key={item.key} className="px-4 py-3.5 flex items-start gap-3 hover:bg-surface-hover/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggle(item.key)}
                      className="mt-0.5 cursor-pointer h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.done ? 'text-text-muted line-through' : 'text-foreground'}`}>{item.label}</p>
                      <input
                        type="text"
                        value={item.notes ?? ''}
                        onChange={e => setNote(item.key, e.target.value)}
                        placeholder="Notes…"
                        className="mt-1.5 w-full text-xs font-mono border-0 border-b border-border-subtle focus:border-accent-border focus:outline-none py-1 text-text-secondary bg-transparent placeholder:text-text-muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save checklist'}
        </Button>
      </div>
    </div>
  )
}
