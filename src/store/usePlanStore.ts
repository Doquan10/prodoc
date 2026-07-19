import { create } from 'zustand'
import type { DailyPlan } from '../types'
import { todayStr } from '../utils/format'

function load(): Record<string, DailyPlan> {
  try {
    const v = localStorage.getItem('plos_plans')
    return v ? JSON.parse(v) : {}
  } catch {
    return {}
  }
}

function emptyPlan(date: string): DailyPlan {
  return { date, learnItemIds: [], exploreItemIds: [], mustItems: [] }
}

interface PlanStore {
  plans: Record<string, DailyPlan>
  getPlan: (date: string) => DailyPlan
  addToLearn: (date: string, itemId: string) => void
  addToExplore: (date: string, itemId: string) => void
  removeFromPlan: (date: string, itemId: string) => void
  addMust: (date: string, text: string) => void
  removeMust: (date: string, idx: number) => void
  todayPlan: () => DailyPlan
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plans: load(),

  getPlan(date) {
    return get().plans[date] ?? emptyPlan(date)
  },

  todayPlan() {
    return get().getPlan(todayStr())
  },

  addToLearn(date, itemId) {
    set(s => {
      const plan = s.plans[date] ?? emptyPlan(date)
      if (plan.learnItemIds.includes(itemId)) return s
      const next = {
        ...s.plans,
        [date]: { ...plan, learnItemIds: [...plan.learnItemIds, itemId] },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  addToExplore(date, itemId) {
    set(s => {
      const plan = s.plans[date] ?? emptyPlan(date)
      if (plan.exploreItemIds.includes(itemId)) return s
      const next = {
        ...s.plans,
        [date]: { ...plan, exploreItemIds: [...plan.exploreItemIds, itemId] },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  removeFromPlan(date, itemId) {
    set(s => {
      const plan = s.plans[date]
      if (!plan) return s
      const next = {
        ...s.plans,
        [date]: {
          ...plan,
          learnItemIds: plan.learnItemIds.filter(id => id !== itemId),
          exploreItemIds: plan.exploreItemIds.filter(id => id !== itemId),
        },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  addMust(date, text) {
    if (!text.trim()) return
    set(s => {
      const plan = s.plans[date] ?? emptyPlan(date)
      const next = {
        ...s.plans,
        [date]: { ...plan, mustItems: [...plan.mustItems, text.trim()] },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  removeMust(date, idx) {
    set(s => {
      const plan = s.plans[date]
      if (!plan) return s
      const next = {
        ...s.plans,
        [date]: { ...plan, mustItems: plan.mustItems.filter((_, i) => i !== idx) },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },
}))
