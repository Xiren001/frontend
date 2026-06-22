'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WavesWeeklyReport {
  weekStart: string
  weekEnd: string
  productsTestedFullSet: number
  avgSpotToEnLaunch: number | null
  avgDaysProofread: number | null
  avgEnToOthersLaunch: number | null
  wave1ProofreadQueue: number
  pctTestedToWave2: number | null
  avgDaysWaveToAllDone: number | null
  newLangsThisWeek: number
  avgLangsPerActive: number | null
  deepestWinner: { name: string; count: number } | null
  smallWinners: number
  mediumWinners: number
  bigWinners: number
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatWeekRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`
}

function MetricCard({
  label,
  value,
  sub,
  dimmed,
}: {
  label: string
  value: string | number | null
  sub?: string
  dimmed?: boolean
}) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 leading-tight">
        {label}
      </p>
      <p className={`text-3xl font-semibold leading-none ${dimmed ? 'text-text-muted' : 'text-foreground'}`}>
        {value === null ? '—' : value}
      </p>
      {sub && <p className="text-xs text-text-muted mt-2 leading-snug">{sub}</p>}
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mt-8 mb-3">
      {title}
    </h2>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 animate-pulse">
      <div className="h-3 w-28 bg-surface-hover rounded mb-3" />
      <div className="h-8 w-16 bg-surface-hover rounded" />
      <div className="h-3 w-36 bg-surface-hover rounded mt-2" />
    </div>
  )
}

export default function WavesReportPage() {
  const [weekStart, setWeekStart] = useState(() => toDateStr(getMondayOfWeek(new Date())))
  const [report, setReport] = useState<WavesWeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<WavesWeeklyReport>(`/api/monday/waves-weekly-report?weekStart=${weekStart}`)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [weekStart])

  function shiftWeek(delta: number) {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(toDateStr(d))
  }

  const isThisWeek = weekStart === toDateStr(getMondayOfWeek(new Date()))

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Waves Weekly Report</h1>
          <p className="text-sm text-text-muted mt-0.5">Performance metrics across all waves</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => shiftWeek(-1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-subtle bg-surface-elevated text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-foreground text-center min-w-[160px]">
            {report ? formatWeekRange(report.weekStart, report.weekEnd) : '—'}
          </div>
          <button
            onClick={() => shiftWeek(1)}
            disabled={isThisWeek}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-subtle bg-surface-elevated text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isThisWeek && (
            <button
              onClick={() => setWeekStart(toDateStr(getMondayOfWeek(new Date())))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border-subtle bg-surface-elevated text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              This week
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <>
          {[4, 1, 4, 4, 2].map((count, si) => (
            <div key={si}>
              <div className="h-3 w-32 bg-surface-hover rounded mt-8 mb-3 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </>
      ) : report ? (
        <>
          {/* Testing Pipeline */}
          <Section title="Testing Pipeline" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Products Tested (EN+ES+DE)"
              value={report.productsTestedFullSet}
              sub="All 3 languages launched"
            />
            <MetricCard
              label="Avg Days: Spot → EN Launch"
              value={report.avgSpotToEnLaunch !== null ? `${report.avgSpotToEnLaunch}d` : null}
              sub="Item created → English live"
            />
            <MetricCard
              label="Avg Days in Proofread"
              value={report.avgDaysProofread !== null ? `${report.avgDaysProofread}d` : null}
              sub="Proofread phase duration"
            />
            <MetricCard
              label="Avg Days: EN → DE+ES"
              value={report.avgEnToOthersLaunch !== null ? `${report.avgEnToOthersLaunch}d` : null}
              sub="English done → DE and ES live"
            />
          </div>

          {/* Proofread Queue */}
          <Section title="Proofread Queue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Waiting in Queue (Wave 1)"
              value={report.wave1ProofreadQueue}
              sub="Wave 1 subitems awaiting proofread"
            />
          </div>

          {/* Wave Progression */}
          <Section title="Wave Progression" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Tested → Wave 2+"
              value={report.pctTestedToWave2 !== null ? `${report.pctTestedToWave2}%` : null}
              sub="Of Wave 1+2 launched products"
            />
            <MetricCard
              label="Wave → All 3 Done"
              value={report.avgDaysWaveToAllDone !== null ? `${report.avgDaysWaveToAllDone}d` : null}
              sub="Avg days: arrival → EN+ES+DE live"
            />
            <MetricCard
              label="New Languages This Week"
              value={report.newLangsThisWeek}
              sub="Launched during this week"
            />
            <MetricCard
              label="Avg Languages / Active Product"
              value={report.avgLangsPerActive ?? null}
              sub="Products with ≥1 active language"
            />
          </div>

          {/* Active Winners */}
          <Section title="Active Winners" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Deepest Winner"
              value={report.deepestWinner?.count ?? null}
              sub={report.deepestWinner?.name ?? 'Most languages live'}
            />
            <MetricCard
              label="Small Winners (≥1 lang)"
              value={report.smallWinners}
              sub="Active products, 1+ language"
            />
            <MetricCard
              label="Medium Winners (≥8 langs)"
              value={report.mediumWinners}
              sub="Active products, 8+ languages"
            />
            <MetricCard
              label="Big Winners (≥16 langs)"
              value={report.bigWinners}
              sub="Active products, 16+ languages"
            />
          </div>

          {/* Revenue */}
          <Section title="Revenue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="% Launches Profitable"
              value={null}
              sub="No revenue data available"
              dimmed
            />
            <MetricCard
              label="Avg Revenue / Active Winner"
              value={null}
              sub="No revenue data available"
              dimmed
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
