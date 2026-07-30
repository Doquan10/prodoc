import { create } from 'zustand'
import { dayOf } from '../utils/format'
import * as api from '../api/plosApi'

export type Phase = 'work' | 'short' | 'long'

export interface PomodoroConfig {
  work: number   // dk
  short: number  // dk
  long: number   // dk
  longEvery: number // kaç çalışmada bir uzun mola
}

export interface PomodoroLog {
  id: string
  date: string       // YYYY-MM-DD (yerel, başlangıç gününe göre)
  phase: Phase
  startedAt: string  // ISO
  plannedSec: number
  actualSec: number  // gerçekte ne kadar sürdü (mola uzatması burada görünür)
  note?: string      // çalışma için
}

const DEFAULT_CONFIG: PomodoroConfig = { work: 25, short: 5, long: 15, longEvery: 4 }
const LOG_CAP = 1000

/** API'ye bütün olarak upsert edilen pomodoro durumu (PUT /api/pomodoro). */
export interface PomodoroState {
  config: PomodoroConfig
  autoStart: boolean
  phase: Phase
  running: boolean
  endsAt: number | null // ms — çalışırken bitiş anı
  remainingSec: number  // duraklatılınca geçerli kalan
  round: number         // mevcut setteki tamamlanan çalışma sayısı
  note: string
  log: PomodoroLog[]
}

function baseState(): PomodoroState {
  return {
    config: DEFAULT_CONFIG,
    autoStart: false,
    phase: 'work',
    running: false,
    endsAt: null,
    remainingSec: DEFAULT_CONFIG.work * 60,
    round: 0,
    note: '',
    log: [],
  }
}

function phaseSeconds(config: PomodoroConfig, phase: Phase): number {
  return (phase === 'work' ? config.work : phase === 'short' ? config.short : config.long) * 60
}

interface PomodoroStore extends PomodoroState {
  hydrated: boolean
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  finishPhase: () => void
  setConfig: (patch: Partial<PomodoroConfig>) => void
  setAutoStart: (v: boolean) => void
  setNote: (v: string) => void
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => {
  // Optimistic: state anında güncellenir, tam durum mock API'ye upsert edilir
  function persist(next: Partial<PomodoroState>) {
    const s = get()
    const snap: PomodoroState = {
      config: s.config, autoStart: s.autoStart, phase: s.phase, running: s.running,
      endsAt: s.endsAt, remainingSec: s.remainingSec, round: s.round, note: s.note, log: s.log,
      ...next,
    }
    set(next)
    void api.savePomodoro(snap)
  }

  /** Fazı bitir ve ilerle. logIt=true ise geçmişe kaydeder (ve çalışmayı sayar). */
  function advance(logIt: boolean) {
    const s = get()
    let round = s.round
    let log = s.log

    if (logIt) {
      const plannedSec = phaseSeconds(s.config, s.phase)
      const overtime = s.endsAt ? Math.max(0, Math.round((Date.now() - s.endsAt) / 1000)) : 0
      const actualSec = plannedSec + overtime
      const startedAt = new Date(Date.now() - actualSec * 1000).toISOString()
      const entry: PomodoroLog = {
        id: crypto.randomUUID(),
        date: dayOf(startedAt),
        phase: s.phase,
        startedAt,
        plannedSec,
        actualSec,
        note: s.phase === 'work' ? (s.note.trim() || undefined) : undefined,
      }
      log = [entry, ...s.log].slice(0, LOG_CAP)
    }

    let nextPhase: Phase
    if (s.phase === 'work') {
      if (logIt) round += 1
      // Uzun mola yalnızca en az bir çalışma tamamlanıp longEvery katına gelince.
      nextPhase = round > 0 && round % s.config.longEvery === 0 ? 'long' : 'short'
    } else {
      if (s.phase === 'long') round = 0
      nextPhase = 'work'
    }

    const dur = phaseSeconds(s.config, nextPhase)
    const auto = s.autoStart
    persist({
      phase: nextPhase,
      round,
      log,
      remainingSec: dur,
      running: auto,
      endsAt: auto ? Date.now() + dur * 1000 : null,
    })
  }

  return {
    ...baseState(),
    hydrated: false,

    start() {
      const s = get()
      if (s.running) return
      const rem = s.remainingSec > 0 ? s.remainingSec : phaseSeconds(s.config, s.phase)
      persist({ running: true, endsAt: Date.now() + rem * 1000, remainingSec: rem })
    },

    pause() {
      const s = get()
      if (!s.running || !s.endsAt) return
      const rem = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000))
      persist({ running: false, endsAt: null, remainingSec: rem })
    },

    reset() {
      const s = get()
      persist({ running: false, endsAt: null, remainingSec: phaseSeconds(s.config, s.phase) })
    },

    skip() { advance(false) },
    finishPhase() { advance(true) },

    setConfig(patch) {
      const s = get()
      const config = { ...s.config, ...patch }
      const remainingSec = s.running ? s.remainingSec : phaseSeconds(config, s.phase)
      persist({ config, remainingSec })
    },

    setAutoStart(v) { persist({ autoStart: v }) },
    setNote(v) { persist({ note: v }) },
  }
})

// Açılışta sunucudan yükle — eksik alanlar varsayılanlarla tamamlanır
void api.fetchPomodoro().then(res => {
  const p = res.success ? res.data : null
  if (p) {
    usePomodoroStore.setState({
      ...p,
      config: { ...DEFAULT_CONFIG, ...p.config },
      log: Array.isArray(p.log) ? p.log : [],
      hydrated: true,
    })
  } else {
    usePomodoroStore.setState({ hydrated: true })
  }
})
