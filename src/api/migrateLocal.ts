// Tek seferlik migrasyon: önceki sürümlerin localStorage verisini mock backend'e
// (mock/db.json) taşır. Hiç eski veri yoksa ilk açılış seed'ini (mockData) yollar.
//
// Sunucu tarafında da koruma vardır: veritabanında zaten veri varsa import
// yoksayılır (başka tarayyıcıdan gelen boş client dolu db'yi ezemez).
// Başarılı aktarımdan sonra bayrak yazılır; eski anahtarlar güvenlik için silinmez.
// Gerçek backend geldiğinde buradaki normalize mantığı backend migration'ına taşınacak.

import type { CuriosityItem, DailyPlan, FocusSession, MustTask, Writing, AppSettings } from '../types'
import type { PomodoroState } from '../store/usePomodoroStore'
import { mockItems } from '../data/mockData'

const FLAG = 'plos_migrated_to_api'

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

// ── Eski veri normalizasyonları ──

type LegacyItem = Omit<CuriosityItem, 'tags'> & { tags?: string[]; category?: string }

function readLegacyItems(): CuriosityItem[] | null {
  const raw = read<LegacyItem[]>('plos_queue')
  if (!raw) return null
  // Migrasyon: category → tags
  return raw.map(i => {
    if (!i.tags) {
      i.tags = i.category ? [i.category] : []
      delete i.category
    }
    return i as CuriosityItem
  })
}

interface LegacyPlan {
  date?: string
  itemIds?: string[]
  mustItems?: unknown
  learnItemIds?: string[]
  exploreItemIds?: string[]
}

/** Eski kayıtlarda mustItems string[] idi — MustTask[]'e normalize et. */
function normalizeMust(items: unknown): MustTask[] {
  if (!Array.isArray(items)) return []
  return items.map(m =>
    typeof m === 'string'
      ? { id: crypto.randomUUID(), text: m }
      : (m as MustTask)
  )
}

function readLegacyPlans(): Record<string, DailyPlan> | null {
  const raw = read<Record<string, LegacyPlan>>('plos_plans')
  if (!raw) return null
  const out: Record<string, DailyPlan> = {}
  for (const [date, p] of Object.entries(raw)) {
    // Migrasyon: learnItemIds + exploreItemIds → itemIds
    const itemIds = p.itemIds ?? [...new Set([...(p.learnItemIds ?? []), ...(p.exploreItemIds ?? [])])]
    out[date] = { date: p.date ?? date, itemIds, mustItems: normalizeMust(p.mustItems) }
  }
  return out
}

export async function migrateFromLocalStorage(): Promise<void> {
  try {
    if (localStorage.getItem(FLAG)) return

    const payload: Record<string, unknown> = {
      // plos_queue hiç yoksa ilk açılış: demo seed verisi (eski davranışla aynı)
      items: readLegacyItems() ?? mockItems,
    }
    const sessions = read<FocusSession[]>('plos_sessions')
    if (sessions) payload.sessions = sessions
    const active = read<FocusSession>('plos_active_session')
    if (active) payload.activeSession = active
    const plans = readLegacyPlans()
    if (plans) payload.plans = plans
    const writings = read<Writing[]>('plos_writings')
    if (writings) payload.writings = writings
    const pomodoro = read<PomodoroState>('plos_pomodoro')
    if (pomodoro) payload.pomodoro = pomodoro
    const settings = read<AppSettings>('plos_settings')
    if (settings) payload.settings = settings

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) localStorage.setItem(FLAG, '1')
    // Sunucuya ulaşılamadıysa bayrak yazılmaz — sonraki açılışta yeniden denenir
  } catch {
    // Migrasyon başarısız — uygulama sunucudaki mevcut veriyle devam eder
  }
}
