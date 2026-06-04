import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Subscribes to one or more Supabase tables and calls `onRefresh`
 * whenever any row is inserted, updated, or deleted.
 * The subscription is created once on mount; the callback ref is kept
 * current so stale closures are never an issue.
 */
export function useRealtimeRefresh(
  tables: string | string[],
  onRefresh: () => void,
) {
  const tableList = Array.isArray(tables) ? tables : [tables]
  const cb = useRef(onRefresh)
  useEffect(() => { cb.current = onRefresh })

  useEffect(() => {
    const supabase = createClient()
    const id = Math.random().toString(36).slice(2, 7)
    const channel = supabase.channel(`rt-${id}`)
    for (const table of tableList) {
      channel.on(
        'postgres_changes' as const,
        { event: '*', schema: 'public', table },
        () => cb.current(),
      )
    }
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
