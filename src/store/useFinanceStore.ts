import { create } from 'zustand'
import {
  bindFinanceAuth,
  loginRequest,
  getDashboardRequest,
  getCreditsRequest,
  getCreditDetailsRequest,
  payInstallmentRequest,
} from '../api/financeApi'
import { useToastStore } from './useToastStore'
import type {
  FinanceAuth,
  FinanceDashboardData,
  CreditListItem,
  CreditDetails,
} from '../types/finance'

const STORAGE_KEY = 'plos_finance_auth'
const HIDE_KEY = 'plos_finance_hide'

export type FinanceTab = 'dashboard' | 'credits'

function loadAuth(): FinanceAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FinanceAuth) : null
  } catch {
    return null
  }
}

function saveAuth(auth: FinanceAuth | null) {
  if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  else localStorage.removeItem(STORAGE_KEY)
}

interface FinanceStore {
  auth: FinanceAuth | null
  tab: FinanceTab
  dashboard: FinanceDashboardData | null
  loading: boolean
  error: string | null
  credits: CreditListItem[] | null
  creditsLoading: boolean
  creditsError: string | null
  selectedCreditId: number | null
  creditDetails: CreditDetails | null
  detailLoading: boolean
  detailError: string | null
  payingInsId: number | null
  payError: string | null
  hideAmounts: boolean
  payInstallment: (installmentId: number) => Promise<void>
  toggleHideAmounts: () => void
  setTab: (tab: FinanceTab) => void
  login: (identity: string, password: string) => Promise<void>
  logout: () => void
  fetchDashboard: () => Promise<void>
  fetchCredits: () => Promise<void>
  openCredit: (id: number) => void
  closeCredit: () => void
  fetchCreditDetails: () => Promise<void>
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  auth: loadAuth(),
  tab: 'dashboard',
  dashboard: null,
  loading: false,
  error: null,
  credits: null,
  creditsLoading: false,
  creditsError: null,
  selectedCreditId: null,
  creditDetails: null,
  detailLoading: false,
  detailError: null,
  payingInsId: null,
  payError: null,
  hideAmounts: localStorage.getItem(HIDE_KEY) === '1',

  payInstallment: async installmentId => {
    set({ payingInsId: installmentId, payError: null })
    try {
      await payInstallmentRequest(installmentId)
      set({ payingInsId: null })
      useToastStore.getState().show('Taksit başarıyla ödendi 🎉', 'success')
      // Ödeme sonrası detay ve özet veriler bayatladı — hepsini tazele
      void get().fetchCreditDetails()
      void get().fetchCredits()
      void get().fetchDashboard()
    } catch (e) {
      set({
        payingInsId: null,
        payError: e instanceof Error ? e.message : 'Ödeme yapılamadı',
      })
    }
  },

  toggleHideAmounts: () =>
    set(s => {
      const hideAmounts = !s.hideAmounts
      localStorage.setItem(HIDE_KEY, hideAmounts ? '1' : '0')
      return { hideAmounts }
    }),

  setTab: tab => set({ tab }),

  login: async (identity, password) => {
    set({ loading: true, error: null })
    try {
      const auth = await loginRequest(identity, password)
      saveAuth(auth)
      set({ auth, loading: false })
      void get().fetchDashboard()
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Giriş başarısız' })
    }
  },

  logout: () => {
    saveAuth(null)
    set({
      auth: null,
      tab: 'dashboard',
      dashboard: null,
      credits: null,
      error: null,
      creditsError: null,
      selectedCreditId: null,
      creditDetails: null,
      detailError: null,
    })
  },

  fetchDashboard: async () => {
    set({ loading: true, error: null })
    try {
      const dashboard = await getDashboardRequest()
      set({ dashboard, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Veriler alınamadı' })
    }
  },

  fetchCredits: async () => {
    set({ creditsLoading: true, creditsError: null })
    try {
      const credits = await getCreditsRequest()
      set({ credits: credits ?? [], creditsLoading: false })
    } catch (e) {
      set({
        creditsLoading: false,
        creditsError: e instanceof Error ? e.message : 'Krediler alınamadı',
      })
    }
  },

  openCredit: id => {
    set({ selectedCreditId: id, creditDetails: null, detailError: null })
    void get().fetchCreditDetails()
  },

  closeCredit: () =>
    set({ selectedCreditId: null, creditDetails: null, detailError: null, payError: null }),

  fetchCreditDetails: async () => {
    const id = get().selectedCreditId
    if (id === null) return
    set({ detailLoading: true, detailError: null })
    try {
      const creditDetails = await getCreditDetailsRequest(id)
      // İstek sürerken modal kapandı/başka kredi açıldıysa eski yanıtı yazma
      if (get().selectedCreditId !== id) return
      set({ creditDetails, detailLoading: false })
    } catch (e) {
      if (get().selectedCreditId !== id) return
      set({
        detailLoading: false,
        detailError: e instanceof Error ? e.message : 'Kredi detayı alınamadı',
      })
    }
  },
}))

bindFinanceAuth({
  getToken: () => useFinanceStore.getState().auth?.token ?? null,
  onTokenRefreshed: token => {
    const auth = useFinanceStore.getState().auth
    if (!auth) return
    const next = { ...auth, token }
    saveAuth(next)
    useFinanceStore.setState({ auth: next })
  },
  onAuthExpired: () => useFinanceStore.getState().logout(),
})
