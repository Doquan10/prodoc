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

const MAX_HISTORY = 200

/** Son 200 seansı tutar — kesme hem bellekte hem diskte aynı olsun diye burada yapılır. */
function pushHistory(history: FocusSession[], session: FocusSession): FocusSession[] {
  const next = [session, ...history].slice(0, MAX_HISTORY)
  localStorage.setItem('plos_sessions', JSON.stringify(next))
  return next
}

function loadActive(): FocusSession | null {
  try {
    const v = localStorage.getItem('plos_active_session')
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}

function saveActive(session: FocusSession | null) {
  if (session) localStorage.setItem('plos_active_session', JSON.stringify(session))
  else localStorage.removeItem('plos_active_session')
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
  active: loadActive(),
  history: loadHistory(),

  start(itemId, minutes) {
    const session: FocusSession = {
      id: crypto.randomUUID(),
      itemId,
      plannedMinutes: minutes,
      startedAt: new Date().toISOString(),
      distractionCount: 0,
    }
    saveActive(session)
    set({ active: session })
  },

  logDistraction() {
    set(s => {
      if (!s.active) return s
      const active = { ...s.active, distractionCount: s.active.distractionCount + 1 }
      saveActive(active)
      return { active }
    })
  },

  complete(outcome, note, newQuestions) {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const actualMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000
    )
    const completed: FocusSession = { ...active, endedAt, actualMinutes, outcome, learningNote: note, newQuestions }
    saveActive(null)
    set({ active: null, history: pushHistory(history, completed) })
  },

  abandon() {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const actualMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000
    )
    const abandoned: FocusSession = { ...active, endedAt, actualMinutes, outcome: 'stuck' }
    saveActive(null)
    set({ active: null, history: pushHistory(history, abandoned) })
  },
}))
