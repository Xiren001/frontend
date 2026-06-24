import { cn } from '@/lib/utils'
import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'

export function Table({ className, containerClassName, ...props }: HTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-surface-elevated overflow-x-auto', containerClassName)}>
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-surface border-b border-border-subtle sticky top-0 z-10', className)}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border-subtle bg-surface-elevated', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('hover:bg-surface-hover/80 transition-colors', className)}
      {...props}
    />
  )
}

export function TableHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-2 text-left text-xs font-semibold text-text-muted',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, mono, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
  return (
    <td
      className={cn(
        'px-4 py-2 text-sm text-foreground',
        mono && 'font-mono text-xs text-text-secondary',
        className,
      )}
      {...props}
    />
  )
}
