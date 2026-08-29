import { create } from 'zustand'
import {
  getDashboardRequest,
  getCreditsRequest,
  getCreditDetailsRequest,
  payInstallmentRequest,
  getCategoriesRequest,
  getExpensesRequest,
  getDashboardExpensesRequest,
  addExpenseRequest,
  updateExpenseRequest,
  deleteExpenseRequest,
} from '../api/financeApi'
import { useToastStore } from './useToastStore'
import { useAuthStore } from './useAuthStore'
import type {
  FinanceDashboardData,
  CreditListItem,
  CreditDetails,
  Category,
  ExpensesData,
  ExpenseFilter,
  NewExpense,
  EditExpense,
} from '../types/finance'

const HIDE_KEY = 'plos_finance_hide'

export type FinanceTab = 'dashboard' | 'credits' | 'expenses'

const now = new Date()

const defaultExpenseFilter: ExpenseFilter = {
  categoryId: null,
  day: null,
  month: now.getMonth() + 1,
  year: now.getFullYear(),
}

interface FinanceStore {
  tab: FinanceTab
  dashboard: FinanceDashboardData | null
  loading: boolean
  error: string | null
  todayExpenses: ExpensesData | null
  todayExpensesLoading: boolean
  todayExpensesError: string | null
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
  categories: Category[] | null
  expenses: ExpensesData | null
  expensesLoading: boolean
  expensesError: string | null
  expenseFilter: ExpenseFilter
  addingExpense: boolean
  updatingExpense: boolean
  deletingExpenseId: number | null
  payInstallment: (installmentId: number) => Promise<void>
  toggleHideAmounts: () => void
  setTab: (tab: FinanceTab) => void
  fetchDashboard: () => Promise<void>
  fetchTodayExpenses: () => Promise<void>
  fetchCredits: () => Promise<void>
  openCredit: (id: number) => void
  closeCredit: () => void
  fetchCreditDetails: () => Promise<void>
  fetchCategories: () => Promise<void>
  fetchExpenses: () => Promise<void>
  setExpenseFilter: (patch: Partial<ExpenseFilter>) => void
  addExpense: (payload: NewExpense) => Promise<boolean>
  updateExpense: (payload: EditExpense) => Promise<boolean>
  deleteExpense: (id: number) => Promise<void>
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  tab: 'dashboard',
  dashboard: null,
  loading: false,
  error: null,
  todayExpenses: null,
  todayExpensesLoading: false,
  todayExpensesError: null,
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
  categories: null,
  expenses: null,
  expensesLoading: false,
  expensesError: null,
  expenseFilter: defaultExpenseFilter,
  addingExpense: false,
  updatingExpense: false,
  deletingExpenseId: null,

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

  fetchDashboard: async () => {
    set({ loading: true, error: null })
    try {
      const dashboard = await getDashboardRequest()
      set({ dashboard, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Veriler alınamadı' })
    }
  },

  fetchTodayExpenses: async () => {
    set({ todayExpensesLoading: true, todayExpensesError: null })
    try {
      const todayExpenses = await getDashboardExpensesRequest()
      set({ todayExpenses, todayExpensesLoading: false })
    } catch (e) {
      set({
        todayExpensesLoading: false,
        todayExpensesError: e instanceof Error ? e.message : 'Bugünkü harcamalar alınamadı',
      })
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

  fetchCategories: async () => {
    // Kategoriler nadiren değişir — bir kez çekildiyse tekrar isteme
    if (get().categories) return
    try {
      const categories = await getCategoriesRequest()
      set({ categories: categories ?? [] })
    } catch {
      // Kategori listesi kritik değil — filtre yine de çalışır, sessizce geç
    }
  },

  fetchExpenses: async () => {
    set({ expensesLoading: true, expensesError: null })
    try {
      const expenses = await getExpensesRequest(get().expenseFilter)
      set({ expenses, expensesLoading: false })
    } catch (e) {
      set({
        expensesLoading: false,
        expensesError: e instanceof Error ? e.message : 'Harcamalar alınamadı',
      })
    }
  },

  setExpenseFilter: patch => {
    set(s => ({ expenseFilter: { ...s.expenseFilter, ...patch } }))
    void get().fetchExpenses()
  },

  addExpense: async payload => {
    set({ addingExpense: true })
    try {
      await addExpenseRequest(payload)
      set({ addingExpense: false })
      useToastStore.getState().show('Harcama eklendi ✅', 'success')
      // Liste ve dashboard (bakiye/özet + bugünkü harcamalar) bayatladı — tazele
      void get().fetchExpenses()
      void get().fetchDashboard()
      void get().fetchTodayExpenses()
      return true
    } catch (e) {
      set({ addingExpense: false })
      useToastStore.getState().show(
        e instanceof Error ? e.message : 'Harcama eklenemedi',
        'error',
      )
      return false
    }
  },

  updateExpense: async payload => {
    set({ updatingExpense: true })
    try {
      await updateExpenseRequest(payload)
      set({ updatingExpense: false })
      useToastStore.getState().show('Harcama güncellendi ✏️', 'success')
      // Liste ve dashboard (bakiye/özet + bugünkü harcamalar) bayatladı — tazele
      void get().fetchExpenses()
      void get().fetchDashboard()
      void get().fetchTodayExpenses()
      return true
    } catch (e) {
      set({ updatingExpense: false })
      useToastStore.getState().show(
        e instanceof Error ? e.message : 'Harcama güncellenemedi',
        'error',
      )
      return false
    }
  },

  deleteExpense: async id => {
    set({ deletingExpenseId: id })
    try {
      await deleteExpenseRequest(id)
      set({ deletingExpenseId: null })
      useToastStore.getState().show('Harcama silindi 🗑️', 'success')
      // Liste ve dashboard (bakiye/özet + bugünkü harcamalar) bayatladı — tazele
      void get().fetchExpenses()
      void get().fetchDashboard()
      void get().fetchTodayExpenses()
    } catch (e) {
      set({ deletingExpenseId: null })
      useToastStore.getState().show(
        e instanceof Error ? e.message : 'Harcama silinemedi',
        'error',
      )
    }
  },
}))

// Auth artık useAuthStore'da — finance verisi onun durumuna abone olur:
// giriş yapılınca dashboard'ı çek, çıkışta (veya oturum düşünce) veriyi temizle.
useAuthStore.subscribe((s, prev) => {
  if (s.auth && !prev.auth) {
    void useFinanceStore.getState().fetchDashboard()
  } else if (!s.auth && prev.auth) {
    useFinanceStore.setState({
      tab: 'dashboard',
      dashboard: null,
      credits: null,
      error: null,
      creditsError: null,
      selectedCreditId: null,
      creditDetails: null,
      detailError: null,
      todayExpenses: null,
      todayExpensesError: null,
      expenses: null,
      expensesError: null,
      expenseFilter: defaultExpenseFilter,
    })
  }
})
