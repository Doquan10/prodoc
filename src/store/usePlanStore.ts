import { create } from 'zustand'
import type { DailyPlan, MustTask } from '../types'
import { todayStr } from '../utils/format'

/** Eski kayıtlarda mustItems string[] idi — MustTask[]'e normalize et. */
function normalizeMust(items: unknown): MustTask[] {
  if (!Array.isArray(items)) return []
  return items.map(m =>
    typeof m === 'string'
      ? { id: crypto.randomUUID(), text: m }
      : (m as MustTask)
  )
}

function load(): Record<string, DailyPlan> {
  try {
    const v = localStorage.getItem('plos_plans')
    if (!v) return {}
    const raw = JSON.parse(v) as Record<string, DailyPlan>
    for (const plan of Object.values(raw)) {
      plan.mustItems = normalizeMust(plan.mustItems)
    }
    return raw
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
  addMust: (date: string, task: { text: string; time?: string; minutes?: number }) => void
  removeMust: (date: string, id: string) => void
  toggleMust: (date: string, id: string) => void
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

  addMust(date, task) {
    if (!task.text.trim()) return
    set(s => {
      const plan = s.plans[date] ?? emptyPlan(date)
      const newTask: MustTask = {
        id: crypto.randomUUID(),
        text: task.text.trim(),
        time: task.time || undefined,
        minutes: task.minutes,
      }
      const next = {
        ...s.plans,
        [date]: { ...plan, mustItems: [...plan.mustItems, newTask] },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  removeMust(date, id) {
    set(s => {
      const plan = s.plans[date]
      if (!plan) return s
      const next = {
        ...s.plans,
        [date]: { ...plan, mustItems: plan.mustItems.filter(m => m.id !== id) },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },

  toggleMust(date, id) {
    set(s => {
      const plan = s.plans[date]
      if (!plan) return s
      const next = {
        ...s.plans,
        [date]: {
          ...plan,
          mustItems: plan.mustItems.map(m => m.id === id ? { ...m, done: !m.done } : m),
        },
      }
      localStorage.setItem('plos_plans', JSON.stringify(next))
      return { plans: next }
    })
  },
}))
