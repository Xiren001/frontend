'use client'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full flex flex-col bg-surface-elevated shadow-md',
          'rounded-t-2xl sm:rounded-xl border border-border-subtle',
          'max-h-[92dvh] sm:max-h-[90vh]',
          sizes[size],
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-sm text-text-muted leading-relaxed">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-6 py-4 bg-surface/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  variant?: 'danger' | 'primary'
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  loading = false,
  variant = 'danger',
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
    </Modal>
  )
}

export function FormField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}
