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
import { request as backendRequest } from './financeApi'

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

// GET /finance-api/api/Curiosity/GetAll — kullanıcının tüm meraklarını döner
// (finance JWT'siyle auth'lu). backendRequest anahtarları camelCase'e indirger.
export async function fetchItems(): Promise<ResponseModel<CuriosityItem[]>> {
  try {
    const data = await backendRequest<CuriosityItem[]>('api/Curiosity/GetAll', { method: 'GET' })
    return { success: true, message: '', data: data ?? [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: [] }
  }
}

// POST /finance-api/api/Curiosity/AddCuriosity — gövde: CuriosityItem (id: client GUID)
// PLOS backend'i finance ile aynı .NET sunucusunda; istek finance JWT'siyle auth'lu
// gider. Backend ResponseModel<bool> döner; store optimistic olduğu için (void ile
// çağrılır) yanıt beklenmez, sadece hata durumunu ResponseModel'e sarıp döneriz.
// NOT: Controller/action adı backend'e göre farklıysa aşağıdaki path'i güncelle.
export async function createItem(item: CuriosityItem): Promise<ResponseModel<CuriosityItem>> {
  try {
    await backendRequest<boolean>('api/Curiosity/Add', { body: item })
    return { success: true, message: '', data: item }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: item }
  }
}

// POST /finance-api/api/Curiosity/Update — gövde: TAM CuriosityItem (partial değil).
// Backend kaydı id'den yükleyip tüm alanları overwrite eder; böylece alan temizleme
// (difficulty/categoryId → null) belirsizliği olmaz. ResponseModel<bool> döner.
export async function updateItem(item: CuriosityItem): Promise<ResponseModel<CuriosityItem>> {
  try {
    await backendRequest<boolean>('api/Curiosity/Update', { body: item })
    return { success: true, message: '', data: item }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: item }
  }
}

// DELETE /finance-api/api/Curiosity/Delete?id={id} — finance JWT'siyle auth'lu.
// Alt ağaç (child'lar) SUNUCUDA cascade silinmeli; client zaten optimistic olarak
// tüm alt ağacı kaldırır (collectSubtree). Backend ResponseModel<bool> döner.
// NOT: Controller/route farklıysa aşağıdaki path'i güncelle.
export async function deleteItem(id: string): Promise<ResponseModel<boolean>> {
  try {
    await backendRequest<boolean>(`api/Curiosity/Delete?id=${id}`, { method: 'DELETE', body: id })
    return { success: true, message: '', data: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: false }
  }
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

// GET /finance-api/api/Plan/GetMyPlans?year={y}&month={m} — kullanıcının SADECE o ay/yıla ait
// günlük planları + tarihsiz backlog havuzu (finance JWT'li). month 1–12. Backend Date'i string
// prefix'le filtreler ("YYYY-MM%") ve "backlog" kaydını her ay yanıtına dahil eder. Böylece
// kullanıcının 10 yıllık geçmişi tek seferde çekilmez — client görünen ayı lazy yükler ve merge eder.
// backendRequest anahtarları camelCase'e indirger. NOT: Controller/action adı farklıysa path'i güncelle.
export async function fetchPlans(year: number, month: number): Promise<ResponseModel<DailyPlan[]>> {
  try {
    const data = await backendRequest<DailyPlan[]>(`api/DailyPlan/GetMyPlans?year=${year}&month=${month}`, { method: 'GET' })
    return { success: true, message: '', data: data ?? [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: [] }
  }
}

// POST /finance-api/api/Plan/SavePlan — plan bütün olarak upsert edilir (parça endpoint yok;
// itemIds ve mustItems her kayıtta komple gönderilir). Backend tarihe göre upsert eder
// (aynı date varsa overwrite, yoksa ekle). Store optimistic olduğu için (void ile çağrılır)
// yanıt beklenmez, sadece hatayı ResponseModel'e sararız. ResponseModel<bool> döner.
export async function savePlan(plan: DailyPlan): Promise<ResponseModel<DailyPlan>> {
  try {
    await backendRequest<boolean>('api/DailyPlan/SavePlan', { body: plan })
    return { success: true, message: '', data: plan }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: plan }
  }
}

// ═══ Yazılar ═════════════════════════════════════════════════

// GET /finance-api/api/Writing/GetMyWritings — kullanıcının yazıları, ÖZET olarak
// (finance JWT'li). content YOK; kart için kırpılmış `excerpt` ve `hasDocuments` gelir.
// Tam gövde (content + documents) yazı açılınca ayrı bir detay endpoint'inden lazy
// çekilecek (backend'de henüz yok — o gelene dek editör content'i kaydetmez).
export async function fetchWritings(): Promise<ResponseModel<Writing[]>> {
  try {
    const data = await backendRequest<Writing[]>('api/Writing/GetMyWritings', { method: 'GET' })
    return { success: true, message: '', data: data ?? [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: [] }
  }
}

// GET /finance-api/api/Writing/GetById?id={id} — tek yazının TAM gövdesi (content + documents),
// finance JWT'li. Liste özet döndüğü için yazı açılınca bununla lazy yüklenir; dönen kayıt
// store'da loaded:true ile patch'lenir. Bulunamazsa success:false.
export async function fetchWriting(id: string): Promise<ResponseModel<Writing>> {
  try {
    const data = await backendRequest<Writing>(`api/Writing/GetById?id=${id}`, { method: 'GET' })
    return { success: true, message: '', data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: null as unknown as Writing }
  }
}

// POST /finance-api/api/Writing/Add — gövde: Writing (id: client GUID), finance JWT'li.
// Backend ResponseModel<bool> döner; store optimistic, başarısızsa geri alır + bildirir.
// NOT: Controller/action adı farklıysa aşağıdaki path'i güncelle.
export async function createWriting(writing: Writing): Promise<ResponseModel<Writing>> {
  try {
    await backendRequest<boolean>('api/Writing/Add', { body: writing })
    return { success: true, message: '', data: writing }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: writing }
  }
}

// PUT /finance-api/api/Writing/Update — gövde: { id, ...değişen alanlar }, finance JWT'li.
// KISMİ güncelleme (PUT fiili ama partial semantik): backend YALNIZCA gövdede gelen alanları
// günceller. Bu yüzden özet (loaded:false) yazılarda content/documents hiç gönderilmez →
// gerçek içerik ezilmez. Backend ResponseModel<bool> döner; store optimistic (void ile çağırır).
// UYARI: undefined alanlar JSON'da yer almaz — icon'u 'temizleme' partial ile iletilemez
// (temizleme gerekirse gövdeye açıkça icon: null koyacak ayrı bir imza gerekir).
export async function updateWriting(id: string, changes: Partial<Writing>): Promise<ResponseModel<Writing>> {
  const body = { id, ...changes }
  try {
    await backendRequest<boolean>('api/Writing/Update', { body, method: 'PUT' })
    return { success: true, message: '', data: body as Writing }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: body as Writing }
  }
}

// DELETE /finance-api/api/Writing/Delete?id={id} — finance JWT'li. Alt sayfa ağacı (child'lar)
// SUNUCUDA cascade silinmeli; client zaten optimistic olarak tüm alt ağacı kaldırır
// (collectSubtree). Backend ResponseModel<bool> döner. NOT: Controller/route farklıysa güncelle.
export async function deleteWriting(id: string): Promise<ResponseModel<boolean>> {
  try {
    await backendRequest<boolean>(`api/Writing/Delete?id=${id}`, { method: 'DELETE', body: id })
    return { success: true, message: '', data: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, errors: [msg], data: false }
  }
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
