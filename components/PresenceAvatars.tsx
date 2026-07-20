'use client'
import { initialsForName } from '@/lib/presence'
import type { PresenceUser } from '@/lib/use-page-presence'

export function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null
  const shown = users.slice(0, 4)
  const extra = users.length - shown.length

  return (
    <div className="flex items-center -space-x-2">
      {shown.map(u => (
        <div
          key={u.sessionId}
          title={u.name}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-background shadow-sm shrink-0"
          style={{ backgroundColor: u.color }}
        >
          {initialsForName(u.name)}
        </div>
      ))}
      {extra > 0 && (
        <div
          title={`+${extra} more`}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold bg-surface-elevated border border-border-subtle text-text-muted ring-2 ring-background shrink-0"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
