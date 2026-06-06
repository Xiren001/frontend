'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, FormField } from '@/components/ui/modal'
import { useRole } from '@/lib/role-context'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Copy, UserPlus, CheckCircle2, Circle, Check, ArrowRightLeft } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  created_at: string
}

interface TeamTask {
  id: string
  member_id: string
  text: string
  done: boolean
  done_at: string | null
  created_at: string
}

export default function TeamTasksPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'

  const [members, setMembers]               = useState<TeamMember[]>([])
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)
  const [tasks, setTasks]                   = useState<TeamTask[]>([])

  const [newTask, setNewTask]       = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberName, setMemberName]           = useState('')
  const [savingMember, setSavingMember]       = useState(false)

  const [deleteMemberId, setDeleteMemberId]   = useState<string | null>(null)
  const [deletingMember, setDeletingMember]   = useState(false)

  const [copied, setCopied] = useState(false)
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.get<TeamMember[]>('/api/team-tasks/members')
      setMembers(data)
      setActiveMemberId(prev =>
        prev && data.some(m => m.id === prev) ? prev : (data[0]?.id ?? null),
      )
    } catch {}
  }, [])

  const loadTasks = useCallback(async (memberId: string) => {
    try {
      const data = await api.get<TeamTask[]>(`/api/team-tasks/tasks?member_id=${memberId}`)
      setTasks(data)
    } catch {}
  }, [])

  useRealtimeRefresh(['team_members', 'team_tasks'], () => {
    loadMembers()
    if (activeMemberId) loadTasks(activeMemberId)
  })

  useEffect(() => { loadMembers() }, [loadMembers])
  useEffect(() => {
    if (activeMemberId) loadTasks(activeMemberId)
    else setTasks([])
  }, [activeMemberId, loadTasks])

  async function addTask() {
    if (!newTask.trim() || !activeMemberId) return
    setAddingTask(true)
    try {
      await api.post('/api/team-tasks/tasks', { member_id: activeMemberId, text: newTask.trim() })
      setNewTask('')
      loadTasks(activeMemberId)
    } finally { setAddingTask(false) }
  }

  async function toggleTask(task: TeamTask) {
    await api.put(`/api/team-tasks/tasks/${task.id}`, { done: !task.done })
    if (activeMemberId) loadTasks(activeMemberId)
  }

  async function deleteTask(id: string) {
    await api.delete(`/api/team-tasks/tasks/${id}`)
    if (activeMemberId) loadTasks(activeMemberId)
  }

  async function saveMember() {
    if (!memberName.trim()) return
    setSavingMember(true)
    try {
      const m = await api.post<TeamMember>('/api/team-tasks/members', { name: memberName.trim() })
      setMemberName('')
      setMemberModalOpen(false)
      await loadMembers()
      setActiveMemberId(m.id)
    } finally { setSavingMember(false) }
  }

  async function deleteMember() {
    if (!deleteMemberId) return
    setDeletingMember(true)
    try {
      await api.delete(`/api/team-tasks/members/${deleteMemberId}`)
      setDeleteMemberId(null)
      await loadMembers()
    } finally { setDeletingMember(false) }
  }

  async function transferTask(taskId: string, toMemberId: string) {
    await api.put(`/api/team-tasks/tasks/${taskId}`, { member_id: toMemberId })
    setTransferTaskId(null)
    if (activeMemberId) loadTasks(activeMemberId)
  }

  useEffect(() => {
    if (!transferTaskId) return
    function close() { setTransferTaskId(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [transferTaskId])

  function copyDoneTasks() {
    const done = tasks.filter(t => t.done)
    if (done.length === 0) return
    const text = done.map(t => `• ${t.text}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const otherMembers = members.filter(m => m.id !== activeMemberId)
  const pendingTasks = tasks.filter(t => !t.done)
  const doneTasks    = tasks
    .filter(t => t.done)
    .sort((a, b) => (b.done_at ?? b.created_at).localeCompare(a.done_at ?? a.created_at))

  return (
    <div>
      <PageHeader
        title="Team Tasks"
        description="Per-person task list for the team."
        actions={isAdmin ? (
          <Button variant="secondary" size="sm" onClick={() => setMemberModalOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />Add person
          </Button>
        ) : undefined}
      />

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-sm text-text-muted">No team members yet.</p>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setMemberModalOpen(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />Add first person
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Person tabs */}
          <div className="flex items-end border-b border-border-subtle mb-6 overflow-x-auto gap-0.5">
            {members.map(m => {
              const isActive = activeMemberId === m.id
              return (
                <div key={m.id} className="group/tab relative shrink-0 flex items-center">
                  <button
                    onClick={() => setActiveMemberId(m.id)}
                    className={cn(
                      'relative px-4 py-3 text-sm transition-colors -mb-px',
                      isActive
                        ? 'text-accent font-semibold'
                        : 'text-text-muted hover:text-foreground',
                    )}
                  >
                    {m.name}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteMemberId(m.id) }}
                      className="opacity-0 group-hover/tab:opacity-100 -ml-1 mr-1 p-0.5 rounded text-text-muted hover:text-danger transition-all"
                      title={`Remove ${m.name}`}
                    >
                      <span className="text-xs leading-none">×</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {activeMemberId && (
            <div className="max-w-2xl">
              {/* Add task input */}
              <div className="flex gap-2 mb-6">
                <Input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTask() }}
                  placeholder="Add a task and press Enter…"
                  className="flex-1"
                />
                <Button onClick={addTask} disabled={!newTask.trim() || addingTask} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Pending tasks */}
              {pendingTasks.length > 0 && (
                <div className="space-y-2 mb-8">
                  {pendingTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface-elevated shadow-sm group/task"
                    >
                      <button
                        onClick={() => toggleTask(task)}
                        className="shrink-0 text-text-muted hover:text-accent transition-colors"
                        title="Mark done"
                      >
                        <Circle className="h-5 w-5" />
                      </button>
                      <span className="flex-1 text-sm text-foreground leading-snug">
                        {task.text}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                        {otherMembers.length > 0 && (
                          <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setTransferTaskId(transferTaskId === task.id ? null : task.id)}
                              className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                              title="Transfer to…"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                            {transferTaskId === task.id && (
                              <div className="absolute right-0 top-full mt-1 z-30 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                                {otherMembers.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => transferTask(task.id, m.id)}
                                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-foreground transition-colors"
                                  >
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Done section */}
              {doneTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                      Done ({doneTasks.length})
                    </p>
                    <button
                      onClick={copyDoneTasks}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors',
                        copied
                          ? 'bg-accent-muted text-accent border-accent-border/50'
                          : 'text-text-muted border-border-subtle hover:text-foreground hover:border-border',
                      )}
                    >
                      {copied
                        ? <><Check className="h-3.5 w-3.5" />Copied!</>
                        : <><Copy className="h-3.5 w-3.5" />Copy done tasks</>
                      }
                    </button>
                  </div>

                  <div className="space-y-2">
                    {doneTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface-elevated/40 group/task"
                      >
                        <button
                          onClick={() => toggleTask(task)}
                          className="shrink-0 text-accent/60 hover:text-accent transition-colors"
                          title="Reopen"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <span className="flex-1 text-sm text-text-muted line-through leading-snug">
                          {task.text}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                          {otherMembers.length > 0 && (
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setTransferTaskId(transferTaskId === task.id ? null : task.id)}
                                className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                title="Transfer to…"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </button>
                              {transferTaskId === task.id && (
                                <div className="absolute right-0 top-full mt-1 z-30 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                                  {otherMembers.map(m => (
                                    <button
                                      key={m.id}
                                      onClick={() => transferTask(task.id, m.id)}
                                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-foreground transition-colors"
                                    >
                                      {m.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tasks.length === 0 && (
                <p className="text-sm text-text-muted text-center py-10">
                  No tasks yet — add one above.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Add person modal */}
      <Modal
        open={memberModalOpen}
        onClose={() => { setMemberModalOpen(false); setMemberName('') }}
        title="Add person"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setMemberModalOpen(false); setMemberName('') }} disabled={savingMember}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveMember} disabled={savingMember || !memberName.trim()}>
              {savingMember ? 'Adding…' : 'Add'}
            </Button>
          </>
        }
      >
        <FormField label="Name">
          <Input
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMember() }}
            placeholder="e.g. Abigél"
            autoFocus
          />
        </FormField>
      </Modal>

      {/* Remove person confirm */}
      <Modal
        open={deleteMemberId !== null}
        onClose={() => setDeleteMemberId(null)}
        title="Remove person"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteMemberId(null)} disabled={deletingMember}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={deleteMember} disabled={deletingMember}>
              {deletingMember ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This will permanently remove{' '}
          <span className="font-medium text-foreground">
            {members.find(m => m.id === deleteMemberId)?.name}
          </span>{' '}
          and all their tasks.
        </p>
      </Modal>
    </div>
  )
}
