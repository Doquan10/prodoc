// Finans API modelleri — backend'deki C# view model'lerin TypeScript karşılıkları.
// API anahtarları client tarafında camelCase'e normalize edilir (bkz. api/financeApi.ts).

// Zarf artık ortak: types/api.ts — PLOS mock API'siyle aynı konvansiyon
export type { ResponseModel } from './api'

export interface FinanceToken {
  accessToken: string
  refreshToken: string
  expiration?: string
}

export interface FinanceAuth {
  fullname: string
  token: FinanceToken
}

/** Backend `Graph` — gerçek API `remainingDebt`/`installment` paralel dizileri döner, `month` yok. */
export interface DebtGraphEntry {
  month?: number | number[]
  debt?: number | number[]
  remainingDebt?: number | number[]
  installment?: number | number[]
}

export interface MonthInstallment {
  installmentOrder: number
  debtName: string
  installmentDate: string
  delay?: boolean | null
  amount: string
}

/** CreditListViewModel */
export interface CreditListItem {
  id: number
  creditName: string
  isActive: boolean
  creditAmount: number
  remainingDebt: number
  installmentAmount: number
  startDate: string
  loanTerm: number
  remainingNumberOfInstallment: number
  progress: number
  bankImage: string
}

/** CreditInstallmentViewModel */
export interface CreditInstallment {
  id: number
  myInstallmentAmount: number
  installmentDate: string
  updatedDate?: string | null
  installmentOrder: number
  isApprov: boolean
  canPay: boolean
  creditId: number
}

/** CreditDetailsViewModel */
export interface CreditDetails {
  id: number
  creditName?: string | null
  loanAmount?: string | null
  interestRate?: number | null
  loanTerm?: number | null
  progress?: number | null
  isActive?: boolean | null
  firstInstallmentDate?: string | null
  dayRemaining?: number | null
  bankName?: string | null
  bankImage?: string | null
  remainingAmount?: string | null
  creditInstallments?: CreditInstallment[] | null
}

/** MobileDashboardViewModel */
export interface FinanceDashboardData {
  totalDebt: number
  totalCardDebt: number
  thisMonthFee: number
  nextMonthFee: number
  debtGraph?: DebtGraphEntry[] | DebtGraphEntry | null
  monthInstallments?: MonthInstallment[] | null
}
