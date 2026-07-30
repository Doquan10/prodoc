import { create } from 'zustand'
import type { FocusSession, SessionOutcome } from '../types'
import * as api from '../api/plosApi'

/** Bitmiş seansın gerçek süresini (duraklatmalar düşülmüş) hesaplar. */
function closeSession(active: FocusSession, endedAt: string): { actualMinutes: number } {
  const extraPausedMs = active.pausedAt
    ? Date.now() - new Date(active.pausedAt).getTime()
    : 0
  const totalPaused = active.totalPausedMs + extraPausedMs
  const actualMinutes = Math.round(
    (new Date(endedAt).getTime() - new Date(active.startedAt).getTime() - totalPaused) / 60000
  )
  return { actualMinutes }
}

interface SessionStore {
  active: FocusSession | null
  history: FocusSession[]
  hydrated: boolean
  start: (itemId: string, minutes: number) => void
  pause: () => void
  resume: () => void
  logDistraction: () => void
  complete: (outcome: SessionOutcome, note?: string, newQuestions?: string[]) => void
  abandon: () => void
}

// Optimistic: state anında güncellenir, aktif seansın her hali mock API'ye
// PUT /api/sessions/active olarak upsert edilir.
export const useSessionStore = create<SessionStore>((set, get) => ({
  active: null,
  history: [],
  hydrated: false,

  start(itemId, minutes) {
    const session: FocusSession = {
      id: crypto.randomUUID(),
      itemId,
      plannedMinutes: minutes,
      startedAt: new Date().toISOString(),
      distractionCount: 0,
      totalPausedMs: 0,
    }
    set({ active: session })
    void api.saveActiveSession(session)
  },

  pause() {
    const cur = get().active
    if (!cur || cur.pausedAt) return
    const active = { ...cur, pausedAt: new Date().toISOString() }
    set({ active })
    void api.saveActiveSession(active)
  },

  resume() {
    const cur = get().active
    if (!cur?.pausedAt) return
    const pausedMs = Date.now() - new Date(cur.pausedAt).getTime()
    const active = {
      ...cur,
      pausedAt: undefined,
      totalPausedMs: cur.totalPausedMs + pausedMs,
    }
    set({ active })
    void api.saveActiveSession(active)
  },

  logDistraction() {
    const cur = get().active
    if (!cur) return
    const active = { ...cur, distractionCount: cur.distractionCount + 1 }
    set({ active })
    void api.saveActiveSession(active)
  },

  complete(outcome, note, newQuestions) {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const completed: FocusSession = {
      ...active,
      endedAt,
      ...closeSession(active, endedAt),
      outcome,
      learningNote: note,
      newQuestions,
      pausedAt: undefined,
    }
    // Geçmiş limiti sunucu kuralıyla aynı — bellek ve API senkron kalsın
    set({ active: null, history: [completed, ...history].slice(0, api.SESSION_HISTORY_LIMIT) })
    void api.finishSession(completed)
  },

  abandon() {
    const { active, history } = get()
    if (!active) return
    const endedAt = new Date().toISOString()
    const abandoned: FocusSession = {
      ...active,
      endedAt,
      ...closeSession(active, endedAt),
      outcome: 'stuck',
      pausedAt: undefined,
    }
    set({ active: null, history: [abandoned, ...history].slice(0, api.SESSION_HISTORY_LIMIT) })
    void api.finishSession(abandoned)
  },
}))

// Açılışta geçmiş + aktif seans sunucudan yüklenir
void Promise.all([api.fetchSessions(), api.fetchActiveSession()]).then(([hist, act]) => {
  useSessionStore.setState({
    history: hist.success ? hist.data : [],
    active: act.success ? act.data : null,
    hydrated: true,
  })
})
