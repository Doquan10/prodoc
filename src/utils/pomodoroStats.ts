import type { PomodoroLog } from '../store/usePomodoroStore'
import { todayStr, addDays } from './format'

export interface DayStats {
  pomodoros: number
  focusSec: number
  breakPlannedSec: number
  breakActualSec: number
  breakExtendSec: number // molayı ne kadar uzatmış
}

export function dayStats(log: PomodoroLog[], date: string): DayStats {
  const day = log.filter(l => l.date === date)
  const work = day.filter(l => l.phase === 'work')
  const breaks = day.filter(l => l.phase !== 'work')
  const breakPlannedSec = breaks.reduce((a, b) => a + b.plannedSec, 0)
  const breakActualSec = breaks.reduce((a, b) => a + b.actualSec, 0)
  return {
    pomodoros: work.length,
    focusSec: work.reduce((a, w) => a + w.actualSec, 0),
    breakPlannedSec,
    breakActualSec,
    breakExtendSec: breaks.reduce((a, b) => a + Math.max(0, b.actualSec - b.plannedSec), 0),
  }
}

/** İçinde en az bir tamamlanmış çalışma olan günler. */
export function activeWorkDates(log: PomodoroLog[]): Set<string> {
  return new Set(log.filter(l => l.phase === 'work').map(l => l.date))
}

export interface Streaks { current: number; best: number; total: number }

export function computeStreaks(log: PomodoroLog[]): Streaks {
  const dates = activeWorkDates(log)
  const total = log.filter(l => l.phase === 'work').length

  // Güncel seri: bugünden (bugün yoksa dünden) geriye doğru kesintisiz.
  const today = todayStr()
  let cursor = dates.has(today) ? today : (dates.has(addDays(today, -1)) ? addDays(today, -1) : null)
  let current = 0
  while (cursor && dates.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  // En iyi seri: tüm günleri sırala, en uzun kesintisiz diziyi bul.
  const sorted = [...dates].sort()
  let best = 0, run = 0, prev: string | null = null
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }

  return { current, best, total }
}

export interface Badge {
  id: string
  label: string
  icon: string
  threshold: number
  value: number
  earned: boolean
  kind: 'streak' | 'total'
}

const STREAK_TIERS = [3, 7, 14, 30, 60, 100]
const TOTAL_TIERS = [10, 25, 50, 100, 250, 500]

export function computeBadges(streaks: Streaks): Badge[] {
  const streakBadges: Badge[] = STREAK_TIERS.map(t => ({
    id: `streak-${t}`,
    label: `${t} gün seri`,
    icon: '🔥',
    threshold: t,
    value: streaks.best,
    earned: streaks.best >= t,
    kind: 'streak',
  }))
  const totalBadges: Badge[] = TOTAL_TIERS.map(t => ({
    id: `total-${t}`,
    label: `${t} pomodoro`,
    icon: '🍅',
    threshold: t,
    value: streaks.total,
    earned: streaks.total >= t,
    kind: 'total',
  }))
  return [...streakBadges, ...totalBadges]
}
