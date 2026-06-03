export type BuildType = 'jewelry' | 'funnel'
export type BuildOutcome = 'winner' | 'killed' | null
export type BuildPhase = 'pending' | 'building' | 'proofread' | 'testing' | 'expanding' | 'live' | 'killed'
export type UserRole = 'admin' | 'approver' | 'viewer'

export interface Build {
  id: string
  type: BuildType
  week_number: number
  month_year: string
  product_name: string
  language: string | null
  approved_date: string | null
  phase1_start: string | null
  into_proofread: string | null
  into_testing: string | null
  outcome_decided: string | null
  outcome: BuildOutcome
  live_all_geos: string | null
  notes: string | null
  proofreader: string | null
  // computed
  phase: BuildPhase
  build_days: number | null
  proof_days: number | null
  test_days: number | null
  expand_days: number | null
  total_days: number | null
  created_at: string
  updated_at: string
}

export interface Mistake {
  id: string
  date: string | null
  product_name: string | null
  category: string | null
  caught_where: string | null
  description: string | null
  root_cause: string | null
  sop_updated: boolean
  notes: string | null
  month_year: string | null
  created_at: string
}

export interface QAItem {
  key: string
  section: 'shopify' | 'jewelry' | 'funnel' | 'localization'
  label: string
  build_id: string
  done: boolean
  notes: string | null
}

export interface Settings {
  id: number
  build_target_days: number
  proof_target_days: number
  test_target_days: number
  expand_target_days: number
  total_target_days: number
  tool_approval_threshold: number
  payment_approval_threshold: number
}

export interface KPI {
  buildCycleAvg: number | null
  proofCycleAvg: number | null
  testCycleAvg: number | null
  expandCycleAvg: number | null
  totalCycleAvg: number | null
  proofreadQueueDepth: number
  proofreadFlagged: number
  mistakesCount: number
  translationFlags: number
  funnelRedirectIssues: number
  targets: Settings
  phaseBreakdown: { building: number; proofread: number; testing: number; expanding: number }
}

export interface WeekStats {
  week: number
  logged: number
  completed: number
  winners: number
  killed: number
  avgBuildDays: number | null
  avgTotalDays: number | null
}

export interface PlannerNote {
  id: string
  date: string
  notes: string
}
