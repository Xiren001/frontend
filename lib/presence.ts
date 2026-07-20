'use client'

const NAME_KEY = 'presence-display-name'
const SESSION_KEY = 'presence-session-id'

export function getDisplayName(): string | null {
  return localStorage.getItem(NAME_KEY)
}

export function setDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name)
}

// Distinguishes browser tabs/devices sharing the same login — unrelated to auth.uid(),
// which is identical for everyone since they're all the same account.
export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

export function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
