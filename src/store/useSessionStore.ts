import { create } from 'zustand'
import type { FocusSession, SessionOutcome } from '../types'

function loadHistory(): FocusSession[] {
  try {
    const v = localStorage.getItem('plos_sessions')
    return v ? JSON.parse(v) : []
  } catch {
    return []
  }
}

function saveHistory(sessions: FocusSession[]) {
  // Keep last 200 sessions only
  localStorage.setItem('plos_sessions', JSON.stringify(sessions.slice(0, 200)))
}

interface SessionStore {
  active: FocusSession | null
  history: FocusSession[]
  start: (itemId: string, minutes: number) => void
  logDistraction: () => void
  complete: (outcome: SessionOutcome, note?: string, newQuestions?: string[]) => void
  abandon: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  active: null,
  history: loadHistory(),

  start(itemId, minutes) {
    const session: FocusSession = {
      id: crypto.randomUUID(),
      itemId,
      plannedMinutes: minutes,
      startedAt: new Date().toISOString(),
      distractionCount: 0,
    }
    set({ active: session })
  },

  logDistraction() {
    set(s => s.active ? { active: { ...s.active, distractionCount: s.active.distractionCount + 1 } } : s)
  },

  complete(outcome, note, newQuestions) {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const actualMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000
    )
    const completed: FocusSession = { ...active, endedAt, actualMinutes, outcome, learningNote: note, newQuestions }
    const next = [completed, ...history]
    saveHistory(next)
    set({ active: null, history: next })
  },

  abandon() {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const actualMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000
    )
    const abandoned: FocusSession = { ...active, endedAt, actualMinutes, outcome: 'stuck' }
    const next = [abandoned, ...history]
    saveHistory(next)
    set({ active: null, history: next })
  },
}))
