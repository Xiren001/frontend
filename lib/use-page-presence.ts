'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from './supabase'
import { getSessionId, colorForName } from './presence'

export interface PresenceUser {
  sessionId: string
  name: string
  color: string
}

// Google-Docs-style "who else is here" — scoped to the current page (pathname), not the whole app.
// Presence is keyed by a random per-tab session id rather than auth.uid(), since everyone using a
// shared login would otherwise be indistinguishable.
//
// `active` gates whether this hook does anything at all (e.g. off for roles that shouldn't see or
// join presence). `name` gates whether it also broadcasts *your own* presence — pass null to just
// view others without joining (e.g. admin/management watching who's on the page, without a name
// of their own to show).
export function usePagePresence(active: boolean, name: string | null): PresenceUser[] {
  const pathname = usePathname()
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!active) { setUsers([]); return }

    const supabase = createClient()
    const sessionId = getSessionId()
    const channel = supabase.channel(`presence:${pathname}`, {
      config: { presence: { key: sessionId } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ name: string; color: string }>()
      const list: PresenceUser[] = []
      for (const key of Object.keys(state)) {
        if (key === sessionId) continue
        const entry = state[key]?.[0]
        if (entry) list.push({ sessionId: key, name: entry.name, color: entry.color })
      }
      setUsers(list)
    })

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED' && name) {
        channel.track({ name, color: colorForName(name) })
      }
    })

    return () => { supabase.removeChannel(channel) }
  }, [pathname, active, name])

  return users
}
