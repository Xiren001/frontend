'use client'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface ResponsiveColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  headerClassName?: string
  cellClassName?: string
  hideOnMobile?: boolean
  mono?: boolean
  align?: 'left' | 'right' | 'center'
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  rowClassName?: (row: T) => string | undefined
  mobileTitle?: (row: T) => ReactNode
  mobileSubtitle?: (row: T) => ReactNode
  mobileActions?: (row: T) => ReactNode
  className?: string
}

function alignClass(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No data',
  rowClassName,
  mobileTitle,
  mobileSubtitle,
  mobileActions,
  className,
}: ResponsiveTableProps<T>) {
  const mobileColumns = columns.filter(c => !c.hideOnMobile)

  if (data.length === 0) {
    return (
      <p className={cn('text-sm text-text-muted text-center py-10', className)}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className={className}>
      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {data.map(row => {
          const titleCol = mobileTitle ? null : mobileColumns[0]
          const detailColumns = mobileColumns.slice(1)

          return (
            <div
              key={rowKey(row)}
              className={cn(
                'rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-3 shadow-sm',
                rowClassName?.(row),
              )}
            >
              {(mobileTitle || titleCol || mobileActions) && (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {mobileTitle ? (
                      <p className="font-medium text-sm text-foreground">{mobileTitle(row)}</p>
                    ) : titleCol ? (
                      <p className="font-medium text-sm text-foreground">{titleCol.render(row)}</p>
                    ) : null}
                    {mobileSubtitle && (
                      <p className="text-xs text-text-muted mt-0.5">{mobileSubtitle(row)}</p>
                    )}
                  </div>
                  {mobileActions && (
                    <div className="shrink-0">{mobileActions(row)}</div>
                  )}
                </div>
              )}

              {detailColumns.length > 0 && (
                <div className="space-y-2.5 pt-1 border-t border-border-subtle">
                  {detailColumns.map(col => (
                    <div key={col.key} className="flex items-start justify-between gap-4">
                      <span className="text-xs font-medium uppercase tracking-wide text-text-muted shrink-0 pt-0.5">
                        {col.header}
                      </span>
                      <span
                        className={cn(
                          'text-sm text-foreground text-right min-w-0',
                          col.mono && 'font-mono text-xs',
                          alignClass(col.align),
                          col.cellClassName,
                        )}
                      >
                        {col.render(row)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableHeader
                  key={col.key}
                  className={cn(alignClass(col.align), col.headerClassName)}
                >
                  {col.header}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(row => (
              <TableRow key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map(col => (
                  <TableCell
                    key={col.key}
                    mono={col.mono}
                    className={cn(alignClass(col.align), col.cellClassName)}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface ResponsiveCardListProps {
  children: ReactNode
  className?: string
}

/** Wrapper for custom mobile card layouts paired with a desktop table */
export function ResponsiveCardList({ children, className }: ResponsiveCardListProps) {
  return <div className={cn('md:hidden space-y-3', className)}>{children}</div>
}

export function ResponsiveDesktopTable({ children, className }: ResponsiveCardListProps) {
  return <div className={cn('hidden md:block', className)}>{children}</div>
}

export function MobileDataCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border-subtle bg-surface-elevated p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function MobileDataRow({
  label,
  children,
  mono,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted shrink-0 pt-0.5">
        {label}
      </span>
      <span className={cn('text-sm text-foreground text-right min-w-0', mono && 'font-mono text-xs')}>
        {children}
      </span>
    </div>
  )
}
