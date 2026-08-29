import { create } from 'zustand'
import { bindAuth, loginRequest } from '../api/financeApi'
import { useToastStore } from './useToastStore'
import type { FinanceAuth } from '../types/finance'

// Uygulama seviyesi kimlik doğrulama — finance ve PLOS AYNI .NET backend'e bu
// token'la gider, o yüzden auth tek yerden (burada) yönetilir. Token/login/logout
// burada durur; finance ve PLOS store'ları bu store'a abone olur.

const STORAGE_KEY = 'plos_finance_auth'

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

interface AuthStore {
  auth: FinanceAuth | null
  loading: boolean
  error: string | null
  login: (identity: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>(set => ({
  auth: loadAuth(),
  loading: false,
  error: null,

  login: async (identity, password) => {
    set({ loading: true, error: null })
    try {
      const auth = await loginRequest(identity, password)
      saveAuth(auth)
      set({ auth, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Giriş başarısız' })
    }
  },

  logout: () => {
    saveAuth(null)
    set({ auth: null, error: null })
  },
}))

// financeApi'nin tek auth köprüsü: token okuma, 401 sonrası refresh'i kaydetme,
// refresh de başarısızsa (oturum tamamen geçersiz) logout + kullanıcıyı uyarma.
// Bu köprü hem finance hem PLOS isteklerini kapsar (ikisi de request'ten geçer).
bindAuth({
  getToken: () => useAuthStore.getState().auth?.token ?? null,
  onTokenRefreshed: token => {
    const auth = useAuthStore.getState().auth
    if (!auth) return
    const next = { ...auth, token }
    saveAuth(next)
    useAuthStore.setState({ auth: next })
  },
  onAuthExpired: () => {
    useAuthStore.getState().logout()
    useToastStore.getState().show('Oturum süresi doldu — lütfen tekrar giriş yap.', 'error')
  },
})
