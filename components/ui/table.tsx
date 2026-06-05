import { cn } from '@/lib/utils'
import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated shadow-sm md:overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-surface border-b border-border-subtle', className)}
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
        'px-4 py-3 text-left text-xs font-semibold text-text-muted',
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
        'px-4 py-3 text-sm text-foreground',
        mono && 'font-mono text-xs text-text-secondary',
        className,
      )}
      {...props}
    />
  )
}
