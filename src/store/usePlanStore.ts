import { create } from 'zustand'
import type { DailyPlan, MustTask } from '../types'
import { todayStr } from '../utils/format'
import * as api from '../api/plosApi'

function emptyPlan(date: string): DailyPlan {
  return { date, itemIds: [], mustItems: [] }
}

interface PlanStore {
  plans: Record<string, DailyPlan>
  hydrated: boolean
  getPlan: (date: string) => DailyPlan
  addToPlan: (date: string, itemId: string) => void
  removeFromPlan: (date: string, itemId: string) => void
  addMust: (date: string, task: { text: string; time?: string; minutes?: number }) => void
  removeMust: (date: string, id: string) => void
  toggleMust: (date: string, id: string) => void
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
  }
})

// Açılışta sunucudan yükle — liste yanıtı client'ta tarihe göre indekslenir
void api.fetchPlans().then(res => {
  usePlanStore.setState({
    plans: res.success ? Object.fromEntries(res.data.map(p => [p.date, p])) : {},
    hydrated: true,
  })
})
