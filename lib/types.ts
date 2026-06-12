export type BuildType = 'jewelry' | 'funnel'
export type BuildOutcome = 'stopped' | 'testing' | 'expanding' | null
export type BuildPhase = 'pending' | 'building' | 'proofread' | 'testing' | 'decided'
export type UserRole = 'admin' | 'management' | 'proofreader' | 'ads' | 'website' | 'viewer'

export interface Build {
  id: string
  type: BuildType
  week_number: number
  month_year: string
  product_name: string
  language: string | null
  approved_date: string | null
  phase1_start: string | null
  phase1_end: string | null
  into_proofread: string | null
  proof_end: string | null
  into_testing: string | null
  outcome_decided: string | null
  outcome: BuildOutcome
  batch_group: number | null
  batch_name: string | null
  notes: string | null
  proofreader: string | null
  monday_url: string | null
  // computed
  phase: BuildPhase
  build_days: number | null
  proof_days: number | null
  test_days: number | null
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
  proofread_turnaround_target_days: number
  web_revision_target_days: number
  ads_revision_target_days: number
  en_completion_target_days: number
  es_de_translation_target_days: number
  total_translation_target_days: number
}

export interface KPI {
  buildCycleAvg: number | null
  proofCycleAvg: number | null
  testCycleAvg: number | null
  totalCycleAvg: number | null
  proofreadQueueDepth: number
  proofreadFlagged: number
  mistakesCount: number
  translationFlags: number
  funnelRedirectIssues: number
  targets: Settings
  phaseBreakdown: { building: number; proofread: number; testing: number; decided: number }
}

export interface BuildSummary {
  product_name: string
  language: string | null
  type: string
  week_number?: number
}

export interface WeekStats {
  week: number
  logged: number
  completed: number
  winners: number
  killed: number
  mistakes: number
  avgBuildDays: number | null
  avgBuildDaysJewelry?: number | null
  avgBuildDaysFunnel?: number | null
  avgTotalDays: number | null
  testedCount?: number
  testedWon?: number
  testWinRate?: string
  expandingBuilds?: BuildSummary[]
  testingBuilds?: BuildSummary[]
}

export interface CycleAvg {
  buildDays: number | null
  proofDays: number | null
  testDays:  number | null
  totalDays: number | null
}

export interface CycleAvgs {
  jewelry: CycleAvg
  funnel:  CycleAvg
}

export interface ReportTargets {
  build_target_days: number
  proof_target_days: number
  test_target_days:  number
  total_target_days: number
  proofread_turnaround_target_days: number
  web_revision_target_days: number
  ads_revision_target_days: number
  en_completion_target_days: number
  es_de_translation_target_days: number
  total_translation_target_days: number
}

export interface PlannerNote {
  id: string
  date: string
  notes: string
}

export interface BuildSummaryShort {
  product_name: string
  language: string | null
}

export interface WeekMetrics {
  count: number
  avgPhase1Days?: number | null
  avgProofDays: number | null
  avgTestDays?: number | null
  avgTotalDays?: number | null
  avgProofreadTurnaround: number | null
  avgWebRevisionDays: number | null
  avgAdsRevisionDays: number | null
  products: BuildSummaryShort[]
}

export interface WinningStats {
  count: number
  totalTested: number
  pct: string
}

export interface InExpanding {
  wave1Count: number
  wave2plusCount: number
  wave1Products: BuildSummaryShort[]
  wave2plusProducts: BuildSummaryShort[]
}

export interface WeekData {
  week: number
  newBuilds: WeekMetrics
  expandingProducts: WeekMetrics
  inTesting: { count: number; products: BuildSummaryShort[] }
  inExpanding: InExpanding
  winning: WinningStats
  translation: TranslationData
}

export interface ProofQueueGroup {
  inProgress: number
  done: number
}

export interface ProofQueue {
  tracker: ProofQueueGroup
  direct: ProofQueueGroup
}

export interface PaymentStatus {
  paid: number
  unpaid: number
}

export interface TranslationStat {
  avgDays: number | null
}

export interface TranslationData {
  en: TranslationStat
  esDe: TranslationStat
  total: TranslationStat
}

export interface WeeklyReport {
  weeks: WeekData[]
  proofQueue: ProofQueue
  paymentStatus: PaymentStatus
  settings: ReportTargets | null
}

export interface MonthlyReport {
  newBuilds: Omit<WeekMetrics, 'products'>
  expandingProducts: Omit<WeekMetrics, 'products'>
  inTesting: { count: number }
  inExpanding: { wave1Count: number; wave2plusCount: number }
  winning: WinningStats
  proofQueue: ProofQueue
  paymentStatus: PaymentStatus
  translation: TranslationData
  byWeek: WeekData[]
  settings: ReportTargets | null
}
