// ═══ PLOS API ═══════════════════════════════════════════════════════════════
//
// İleride yazılacak backend'in SÖZLEŞMESİ. Her fonksiyonun üstündeki yorum,
// gerçek backend'de karşılık gelen endpoint'i tanımlar.
//
// İstekler şu an vite dev sunucusuna gömülü mock backend'e gider
// (mock/apiPlugin.ts); veriler mock/db.json dosyasında JSON olarak durur.
// Gerçek .NET backend hazır olduğunda BASE'i (veya vite proxy'sini) ona
// çevirmek yetecek — imzalar aynı kaldığı için store'lara dokunulmayacak.
//
// Konvansiyonlar (finans API'siyle aynı, bkz. api/financeApi.ts):
//   • Tüm yanıtlar ResponseModel<T> zarfı içinde JSON döner (types/api.ts).
//   • Liste yanıtlarında `count` set edilir.
//   • id'ler client'ta üretilen GUID'lerdir — backend, POST gövdesindeki id'yi
//     kabul etmelidir. Optimistic UI (state'i beklemeden güncelleme) bu sayede
//     mümkün oluyor; store'lar yanıtı beklemek zorunda kalmıyor.
//   • Cascade silme (parentId alt ağacı) SUNUCU sorumluluğudur; client sadece
//     kök id yollar, yanıt silinen tüm id'leri döner.
//   • Writing.updatedAt şimdilik client'ta set ediliyor; gerçek backend'de
//     sunucu set etmeli.

import type { ResponseModel } from '../types/api'
import type { CuriosityItem, DailyPlan, FocusSession, Writing, AppSettings } from '../types'
import type { PomodoroState } from '../store/usePomodoroStore'
import { migrateFromLocalStorage } from './migrateLocal'

const BASE = '/api'

/** Seans geçmişi sunucuda son N kayıtla sınırlıdır — client optimistic güncellemede aynı kuralı uygular. */
export const SESSION_HISTORY_LIMIT = 200

// İlk istekten önce eski localStorage verisi (varsa) tek seferlik içe aktarılır
const migration = migrateFromLocalStorage()

async function request<T>(path: string, init?: RequestInit): Promise<ResponseModel<T>> {
  await migration
  try {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    return (await res.json()) as ResponseModel<T>
  } catch (e) {
    // Sunucuya ulaşılamadı (ör. mock plugin olmadan çalıştırıldı)
    return {
      success: false,
      count: null,
      message: 'API isteğine ulaşılamadı',
      errors: [String(e)],
      data: null as unknown as T,
    }
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})

// ═══ Merak Kuyruğu ═══════════════════════════════════════════

// GET /api/items
export function fetchItems(): Promise<ResponseModel<CuriosityItem[]>> {
  return request('/items')
}

// POST /api/items — gövde: CuriosityItem (id: client GUID)
export function createItem(item: CuriosityItem): Promise<ResponseModel<CuriosityItem>> {
  return request('/items', json('POST', item))
}

// PUT /api/items/{id} — gövde: değişen alanlar
export function updateItem(id: string, changes: Partial<CuriosityItem>): Promise<ResponseModel<CuriosityItem>> {
  return request(`/items/${id}`, json('PUT', changes))
}

// DELETE /api/items/{id} — alt ağaç sunucuda cascade silinir
export function deleteItem(id: string): Promise<ResponseModel<{ deletedIds: string[] }>> {
  return request(`/items/${id}`, { method: 'DELETE' })
}

// ═══ Odak Seansları ══════════════════════════════════════════

// GET /api/sessions — geçmiş, yeni → eski, son 200
export function fetchSessions(): Promise<ResponseModel<FocusSession[]>> {
  return request('/sessions')
}

// GET /api/sessions/active — aktif seans yoksa data: null
export function fetchActiveSession(): Promise<ResponseModel<FocusSession | null>> {
  return request('/sessions/active')
}

// PUT /api/sessions/active — başlatma + her durum değişikliği (pause/resume/
// dikkat dağınıklığı) aktif seansın son halini bütün olarak upsert eder
export function saveActiveSession(session: FocusSession): Promise<ResponseModel<FocusSession>> {
  return request('/sessions/active', json('PUT', session))
}

// POST /api/sessions/{id}/finish — aktif seansı kapatıp geçmişe taşır
// (complete ve abandon aynı endpoint'i kullanır; outcome gövdededir)
export function finishSession(session: FocusSession): Promise<ResponseModel<FocusSession>> {
  return request(`/sessions/${session.id}/finish`, json('POST', session))
}

// ═══ Günlük Planlar ══════════════════════════════════════════

// GET /api/plans
export function fetchPlans(): Promise<ResponseModel<DailyPlan[]>> {
  return request('/plans')
}

// PUT /api/plans/{date} — plan bütün olarak upsert edilir (parça endpoint yok;
// itemIds ve mustItems her kayıtta komple gönderilir)
export function savePlan(plan: DailyPlan): Promise<ResponseModel<DailyPlan>> {
  return request(`/plans/${plan.date}`, json('PUT', plan))
}

// ═══ Yazılar ═════════════════════════════════════════════════

// GET /api/writings
export function fetchWritings(): Promise<ResponseModel<Writing[]>> {
  return request('/writings')
}

// POST /api/writings — gövde: Writing (id: client GUID)
export function createWriting(writing: Writing): Promise<ResponseModel<Writing>> {
  return request('/writings', json('POST', writing))
}

// PUT /api/writings/{id} — gövde: değişen alanlar
export function updateWriting(id: string, changes: Partial<Writing>): Promise<ResponseModel<Writing>> {
  return request(`/writings/${id}`, json('PUT', changes))
}

// DELETE /api/writings/{id} — alt sayfa ağacı sunucuda cascade silinir
export function deleteWriting(id: string): Promise<ResponseModel<{ deletedIds: string[] }>> {
  return request(`/writings/${id}`, { method: 'DELETE' })
}

// ═══ Pomodoro ════════════════════════════════════════════════

// GET /api/pomodoro — kullanıcının pomodoro durumu + geçmişi; hiç yoksa data: null
export function fetchPomodoro(): Promise<ResponseModel<PomodoroState | null>> {
  return request('/pomodoro')
}

// PUT /api/pomodoro — durum bütün olarak upsert edilir
export function savePomodoro(state: PomodoroState): Promise<ResponseModel<PomodoroState>> {
  return request('/pomodoro', json('PUT', state))
}

// ═══ Ayarlar ═════════════════════════════════════════════════

// GET /api/settings — hiç kaydedilmemişse data: null (client varsayılanları uygular)
export function fetchSettings(): Promise<ResponseModel<AppSettings | null>> {
  return request('/settings')
}

// PUT /api/settings
export function saveSettings(settings: AppSettings): Promise<ResponseModel<AppSettings>> {
  return request('/settings', json('PUT', settings))
}
