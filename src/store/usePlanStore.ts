import { create } from 'zustand'
import type { DailyPlan, MustTask } from '../types'
import { todayStr } from '../utils/format'
import * as api from '../api/plosApi'

function emptyPlan(date: string): DailyPlan {
  return { date, itemIds: [], mustItems: [] }
}

/** "YYYY-MM" — hangi aylar sunucudan çekildi, tekrar çekmemek için. */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

interface PlanStore {
  plans: Record<string, DailyPlan>
  hydrated: boolean
  loadedMonths: Set<string>
  /** Verilen ay/yıl (+backlog) planlarını çekip mevcut plans'e merge eder; zaten yüklüyse no-op. */
  loadMonth: (year: number, month: number) => Promise<void>
  getPlan: (date: string) => DailyPlan
  addToPlan: (date: string, itemId: string) => void
  removeFromPlan: (date: string, itemId: string) => void
  addMust: (date: string, task: { text: string; time?: string; minutes?: number }) => void
  removeMust: (date: string, id: string) => void
  toggleMust: (date: string, id: string) => void
  /** Bir görevi (MustTask) tüm alanlarını koruyarak bir günden diğerine taşır. */
  moveMust: (from: string, to: string, id: string) => void
  todayPlan: () => DailyPlan
}

export const usePlanStore = create<PlanStore>((set, get) => {
  // Her mutasyon planın son halini state'e yazar ve API'ye bütün olarak upsert eder
  // (PUT /api/plans/{date})
  function commitPlan(next: DailyPlan) {
    set(s => ({ plans: { ...s.plans, [next.date]: next } }))
    void api.savePlan(next)
  }

  return {
    plans: {},
    hydrated: false,
    loadedMonths: new Set<string>(),

    async loadMonth(year, month) {
      const key = monthKey(year, month)
      if (get().loadedMonths.has(key)) return
      // Aynı ayın eşzamanlı ikinci isteğini engellemek için önce işaretle
      set(s => ({ loadedMonths: new Set(s.loadedMonths).add(key) }))
      const res = await api.fetchPlans(year, month)
      if (res.success) {
        // Merge — mevcut ayları koru, gelen ayın (ve backlog'un) kayıtlarını üzerine yaz
        set(s => ({
          plans: { ...s.plans, ...Object.fromEntries(res.data.map(p => [p.date, p])) },
          hydrated: true,
        }))
      } else {
        // Başarısızsa işareti geri al ki sonra tekrar denensin; yine de app'i aç
        set(s => {
          const next = new Set(s.loadedMonths)
          next.delete(key)
          return { loadedMonths: next, hydrated: true }
        })
      }
    },

    getPlan(date) {
      return get().plans[date] ?? emptyPlan(date)
    },

    todayPlan() {
      return get().getPlan(todayStr())
    },

    addToPlan(date, itemId) {
      const plan = get().getPlan(date)
      if (plan.itemIds.includes(itemId)) return
      commitPlan({ ...plan, itemIds: [...plan.itemIds, itemId] })
    },

    removeFromPlan(date, itemId) {
      const plan = get().plans[date]
      if (!plan) return
      commitPlan({ ...plan, itemIds: plan.itemIds.filter(id => id !== itemId) })
    },

    addMust(date, task) {
      if (!task.text.trim()) return
      const plan = get().getPlan(date)
      const newTask: MustTask = {
        id: crypto.randomUUID(),
        text: task.text.trim(),
        time: task.time || undefined,
        minutes: task.minutes,
      }
      commitPlan({ ...plan, mustItems: [...plan.mustItems, newTask] })
    },

    removeMust(date, id) {
      const plan = get().plans[date]
      if (!plan) return
      commitPlan({ ...plan, mustItems: plan.mustItems.filter(m => m.id !== id) })
    },

    toggleMust(date, id) {
      const plan = get().plans[date]
      if (!plan) return
      commitPlan({
        ...plan,
        mustItems: plan.mustItems.map(m => (m.id === id ? { ...m, done: !m.done } : m)),
      })
    },

    moveMust(from, to, id) {
      if (from === to) return
      const fromPlan = get().plans[from]
      const task = fromPlan?.mustItems.find(m => m.id === id)
      if (!fromPlan || !task) return
      commitPlan({ ...fromPlan, mustItems: fromPlan.mustItems.filter(m => m.id !== id) })
      const toPlan = get().getPlan(to)
      commitPlan({ ...toPlan, mustItems: [...toPlan.mustItems, task] })
    },
  }
})

// Açılışta yalnızca içinde bulunulan ayı (+backlog) çek; diğer aylar PlanView'da
// takvim gezinirken lazy yüklenir (loadMonth). month 1–12.
const now = new Date()
void usePlanStore.getState().loadMonth(now.getFullYear(), now.getMonth() + 1)
