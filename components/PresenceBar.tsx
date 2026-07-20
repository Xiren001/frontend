'use client'
import { useEffect, useState } from 'react'
import { useRole } from '@/lib/role-context'
import { getDisplayName, setDisplayName } from '@/lib/presence'
import { usePagePresence } from '@/lib/use-page-presence'
import { PresenceAvatars } from './PresenceAvatars'
import { Modal, FormField } from './ui/modal'
import { Input } from './ui/input'
import { Button } from './ui/button'

// Google-Docs-style "who else is on this page" — only for ads/website, since those are the
// roles most likely to share one login across several people (proofreader/admin/management
// logins are already per-person or per-language).
export function PresenceBar() {
  const { role, loading } = useRole()
  const eligible = !loading && (role === 'ads' || role === 'website')

  const [name, setName] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!eligible) return
    setName(getDisplayName())
    setChecked(true)
  }, [eligible])

  // No saved name yet — require one before letting them continue using a shared login anonymously
  useEffect(() => {
    if (eligible && checked && !name) setModalOpen(true)
  }, [eligible, checked, name])

  const others = usePagePresence(eligible ? name : null)

  function openModal() {
    setDraft(name ?? '')
    setModalOpen(true)
  }

  function saveName() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setDisplayName(trimmed)
    setName(trimmed)
    setModalOpen(false)
  }

  if (!eligible) return null

  const required = !name

  return (
    <>
      {name && (
        <div className="fixed right-4 top-16 lg:top-3 z-30">
          <button onClick={openModal} title="You are visible to others on this page as this name" className="cursor-pointer">
            <PresenceAvatars users={others} />
          </button>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { if (!required) setModalOpen(false) }}
        dismissible={!required}
        title="Your name"
        description="This login is shared by your team. Set a name so others sharing it can see who else is on the same page right now — saved on this device only."
        footer={
          <>
            {!required && <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>}
            <Button size="sm" onClick={saveName} disabled={!draft.trim()}>{required ? 'Continue' : 'Save'}</Button>
          </>
        }
      >
        <FormField label="Your name">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            placeholder="e.g. Jane Doe"
            autoFocus
          />
        </FormField>
      </Modal>
    </>
  )
}
