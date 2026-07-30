// ═══ PLOS Mock Backend ═══════════════════════════════════════════════════════
//
// Vite dev sunucusuna gömülü mock backend. Her kaynak (API) kendi JSON
// dosyasında durur — backend'deki tablo/koleksiyon ayrımının karşılığı:
//
//   mock/data/items.json           → GET/POST /api/items, PUT/DELETE /api/items/{id}
//   mock/data/sessions.json        → GET /api/sessions, POST /api/sessions/{id}/finish
//   mock/data/active-session.json  → GET/PUT /api/sessions/active
//   mock/data/plans.json           → GET /api/plans, PUT /api/plans/{date}
//   mock/data/writings.json        → GET/POST /api/writings, PUT/DELETE /api/writings/{id}
//   mock/data/pomodoro.json        → GET/PUT /api/pomodoro
//   mock/data/settings.json        → GET/PUT /api/settings
//   mock/data/meta.json            → sunucu iç durumu (import bayrağı)
//
// Sözleşme (gerçek .NET backend'in uygulayacağı davranışlar):
//   • Tüm yanıtlar ResponseModel<T> zarfında JSON (success/count/message/errors/data)
//   • Hata durumunda uygun HTTP status + success:false zarfı
//   • Cascade silme (parentId alt ağacı) sunucu sorumluluğu, yanıt deletedIds döner
//   • Seans geçmişi sunucuda son 200 kayıtla sınırlı
//
// Sunucu şemadan bağımsızdır — gövdeleri olduğu gibi saklar; yalnızca cascade
// için id/parentId, planlar için date bilir. Gerçek backend geldiğinde bu dosya
// tamamen ölür.

import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { collectSubtree } from '../src/utils/tree.ts'

interface Row {
  id: string
  parentId?: string
}

interface PlanRow {
  date: string
}

interface Meta {
  imported: boolean // tek seferlik client migrasyonu/seed uygulandı mı
}

const DATA_DIR = path.resolve('mock/data')

const FILES = {
  items: 'items.json',
  sessions: 'sessions.json',
  activeSession: 'active-session.json',
  plans: 'plans.json',
  writings: 'writings.json',
  pomodoro: 'pomodoro.json',
  settings: 'settings.json',
  meta: 'meta.json',
} as const

const SESSION_HISTORY_LIMIT = 200

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown) {
  // Pretty-print: her kaynağın dosyası açılıp okunur JSON olarak incelenebilsin
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(value, null, 2), 'utf8')
}

/** Eski tek dosyalı mock/db.json'ı kaynak başına dosyalara böler (tek seferlik). */
function splitLegacyDb() {
  const legacy = path.resolve('mock/db.json')
  if (!fs.existsSync(legacy)) return
  if (fs.existsSync(path.join(DATA_DIR, FILES.meta))) return // zaten bölünmüş
  try {
    const db = JSON.parse(fs.readFileSync(legacy, 'utf8')) as Record<string, unknown>
    writeJson(FILES.items, db.items ?? [])
    writeJson(FILES.sessions, db.sessions ?? [])
    writeJson(FILES.activeSession, db.activeSession ?? null)
    // Eski format plans'ı tarih → plan sözlüğüydü; artık dizi
    writeJson(FILES.plans, db.plans && !Array.isArray(db.plans) ? Object.values(db.plans) : db.plans ?? [])
    writeJson(FILES.writings, db.writings ?? [])
    writeJson(FILES.pomodoro, db.pomodoro ?? null)
    writeJson(FILES.settings, db.settings ?? null)
    writeJson(FILES.meta, { imported: !!db.imported })
    fs.renameSync(legacy, legacy + '.bak') // yedek — bir sonraki açılışta tekrar bölünmesin
  } catch {
    // db.json bozuksa dokunma — boş dosyalarla devam edilir
  }
}

// ── ResponseModel<T> zarfı ──
function ok(data: unknown, message = 'İşlem başarılı') {
  return {
    success: true,
    count: Array.isArray(data) ? data.length : null,
    message,
    errors: null,
    data,
  }
}

function fail(message: string) {
  return { success: false, count: null, message, errors: [message], data: null }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise(resolve => {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
  })
}

// ── Ortak CRUD davranışları (items + writings) ──

function updateRow(res: ServerResponse, file: string, id: string, changes: unknown, label: string) {
  const rows = readJson<Row[]>(file, [])
  const idx = rows.findIndex(r => r.id === id)
  if (idx === -1) return send(res, 404, fail(`${label} bulunamadı`))
  rows[idx] = { ...rows[idx], ...(changes as Partial<Row>) }
  writeJson(file, rows)
  send(res, 200, ok(rows[idx], `${label} güncellendi`))
}

function cascadeDelete(res: ServerResponse, file: string, id: string, label: string) {
  const rows = readJson<Row[]>(file, [])
  const doomed = collectSubtree(id, rows)
  writeJson(file, rows.filter(r => !doomed.has(r.id)))
  send(res, 200, ok({ deletedIds: [...doomed] }, `${label} silindi`))
}

// ── Router ──

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET'
  const url = (req.url ?? '/').split('?')[0]
  const body = method === 'POST' || method === 'PUT' ? await readBody(req) : null

  // ── Merak kuyruğu ──
  if (url === '/items' && method === 'GET') return send(res, 200, ok(readJson<Row[]>(FILES.items, [])))
  if (url === '/items' && method === 'POST') {
    writeJson(FILES.items, [body as Row, ...readJson<Row[]>(FILES.items, [])])
    return send(res, 200, ok(body, 'Merak eklendi'))
  }
  const item = url.match(/^\/items\/([^/]+)$/)
  if (item && method === 'PUT') return updateRow(res, FILES.items, item[1], body, 'Merak konusu')
  if (item && method === 'DELETE') return cascadeDelete(res, FILES.items, item[1], 'Merak')

  // ── Odak seansları ──
  if (url === '/sessions' && method === 'GET') return send(res, 200, ok(readJson<Row[]>(FILES.sessions, [])))
  if (url === '/sessions/active' && method === 'GET') return send(res, 200, ok(readJson<Row | null>(FILES.activeSession, null)))
  if (url === '/sessions/active' && method === 'PUT') {
    writeJson(FILES.activeSession, body)
    return send(res, 200, ok(body, 'Seans kaydedildi'))
  }
  const finish = url.match(/^\/sessions\/([^/]+)\/finish$/)
  if (finish && method === 'POST') {
    const sessions = [body as Row, ...readJson<Row[]>(FILES.sessions, [])].slice(0, SESSION_HISTORY_LIMIT)
    writeJson(FILES.sessions, sessions)
    writeJson(FILES.activeSession, null)
    return send(res, 200, ok(body, 'Seans tamamlandı'))
  }

  // ── Günlük planlar ──
  if (url === '/plans' && method === 'GET') return send(res, 200, ok(readJson<PlanRow[]>(FILES.plans, [])))
  const plan = url.match(/^\/plans\/([^/]+)$/)
  if (plan && method === 'PUT') {
    const plans = readJson<PlanRow[]>(FILES.plans, [])
    const idx = plans.findIndex(p => p.date === plan[1])
    if (idx === -1) plans.push(body as PlanRow)
    else plans[idx] = body as PlanRow
    writeJson(FILES.plans, plans)
    return send(res, 200, ok(body, 'Plan kaydedildi'))
  }

  // ── Yazılar ──
  if (url === '/writings' && method === 'GET') return send(res, 200, ok(readJson<Row[]>(FILES.writings, [])))
  if (url === '/writings' && method === 'POST') {
    writeJson(FILES.writings, [body as Row, ...readJson<Row[]>(FILES.writings, [])])
    return send(res, 200, ok(body, 'Yazı oluşturuldu'))
  }
  const writing = url.match(/^\/writings\/([^/]+)$/)
  if (writing && method === 'PUT') return updateRow(res, FILES.writings, writing[1], body, 'Yazı')
  if (writing && method === 'DELETE') return cascadeDelete(res, FILES.writings, writing[1], 'Yazı')

  // ── Pomodoro ──
  if (url === '/pomodoro' && method === 'GET') return send(res, 200, ok(readJson<unknown>(FILES.pomodoro, null)))
  if (url === '/pomodoro' && method === 'PUT') {
    writeJson(FILES.pomodoro, body)
    return send(res, 200, ok(body, 'Pomodoro kaydedildi'))
  }

  // ── Ayarlar ──
  if (url === '/settings' && method === 'GET') return send(res, 200, ok(readJson<unknown>(FILES.settings, null)))
  if (url === '/settings' && method === 'PUT') {
    writeJson(FILES.settings, body)
    return send(res, 200, ok(body, 'Ayarlar kaydedildi'))
  }

  // ── Tek seferlik içe aktarma (localStorage migrasyonu / ilk açılış seed'i) ──
  // Sunucuda zaten veri varsa yoksayılır — başka bir tarayıcıdan gelen boş
  // client, dolu veritabanının üstüne seed yazamaz.
  if (url === '/import' && method === 'POST') {
    const meta = readJson<Meta>(FILES.meta, { imported: false })
    if (meta.imported) return send(res, 200, ok(null, 'İçe aktarma atlandı — veriler zaten mevcut'))
    const data = (body ?? {}) as Record<string, unknown>
    if (data.items !== undefined) writeJson(FILES.items, data.items)
    if (data.sessions !== undefined) writeJson(FILES.sessions, data.sessions)
    if (data.activeSession !== undefined) writeJson(FILES.activeSession, data.activeSession)
    if (data.plans !== undefined) {
      // Client migrasyonu tarih → plan sözlüğü yollar; dizi olarak saklanır
      writeJson(FILES.plans, Array.isArray(data.plans) ? data.plans : Object.values(data.plans as Record<string, unknown>))
    }
    if (data.writings !== undefined) writeJson(FILES.writings, data.writings)
    if (data.pomodoro !== undefined) writeJson(FILES.pomodoro, data.pomodoro)
    if (data.settings !== undefined) writeJson(FILES.settings, data.settings)
    writeJson(FILES.meta, { imported: true })
    return send(res, 200, ok(null, 'Veriler içe aktarıldı'))
  }

  send(res, 404, fail('Endpoint bulunamadı'))
}

/** /api/* isteklerini karşılayan Vite plugin'i — dev ve preview sunucularında çalışır. */
export default function plosMockApi(): Plugin {
  const attach = (middlewares: { use: (route: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void }) => {
    middlewares.use('/api', (req, res) => {
      handle(req, res).catch((err: unknown) => send(res, 500, fail(String(err))))
    })
  }
  return {
    name: 'plos-mock-api',
    configureServer(server) {
      splitLegacyDb()
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      splitLegacyDb()
      attach(server.middlewares)
    },
  }
}
