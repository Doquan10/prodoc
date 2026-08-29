import { create } from 'zustand'
import type { Writing, WritingKind } from '../types'
import { collectSubtree } from '../utils/tree'
import * as api from '../api/plosApi'
import { useToastStore } from './useToastStore'
import { useAuthStore } from './useAuthStore'

/** Detay çağrısı uçuşta olan yazı id'leri — aynı yazı için mükerrer istek atmamak için. */
const loadingIds = new Set<string>()

/** Eski kayıtlarda kind yoktu: alt öğesi olan → kategori, olmayan → yazı. */
function normalizeKind(list: Writing[]): Writing[] {
  const parents = new Set(list.map(w => w.parentId).filter(Boolean))
  return list.map(w => (w.kind ? w : { ...w, kind: parents.has(w.id) ? 'category' : 'note' }))
}

interface WritingStore {
  writings: Writing[]
  hydrated: boolean
  addWriting: (opts?: { title?: string; itemId?: string; content?: string; parentId?: string; kind?: WritingKind }) => string
  updateWriting: (id: string, changes: Partial<Pick<Writing, 'title' | 'content' | 'itemId' | 'parentId' | 'icon' | 'documents'>>) => void
  deleteWriting: (id: string) => void
  /** Yazının tam gövdesini (content + documents) sunucudan çekip loaded:true ile patch'ler. */
  loadWriting: (id: string) => void
  getWriting: (id: string) => Writing | undefined
  getByItem: (itemId: string) => Writing[]
  getChildren: (parentId?: string) => Writing[]
  /** Tüm kategoriler, "Yazılım / React" biçiminde tam yol etiketiyle. */
  categoryOptions: () => { id: string; path: string }[]
}

// Optimistic: state anında güncellenir, mock API arka planda persist eder.
export const useWritingStore = create<WritingStore>((set, get) => ({
  writings: [],
  hydrated: false,

  addWriting(opts = {}) {
    const now = new Date().toISOString()
    const writing: Writing = {
      id: crypto.randomUUID(),
      itemId: opts.itemId,
      parentId: opts.parentId,
      kind: opts.kind ?? 'note',
      title: opts.title ?? '',
      content: opts.content ?? '',
      loaded: true, // yeni yazı client'ta tam oluşturuldu — content güvenle kaydedilir
      createdAt: now,
      updatedAt: now,
    }
    set(s => ({ writings: [writing, ...s.writings] }))
    // Optimistic: backend başarısızsa geri al + bildir
    void api.createWriting(writing).then(res => {
      if (!res.success) {
        set(s => ({ writings: s.writings.filter(w => w.id !== writing.id) }))
        useToastStore.getState().show(res.message || 'Yazı eklenemedi', 'error')
      }
    })
    return writing.id
  },

  updateWriting(id, changes) {
    const stamped = { ...changes, updatedAt: new Date().toISOString() }
    set(s => ({ writings: s.writings.map(w => (w.id === id ? { ...w, ...stamped } : w)) }))
    void api.updateWriting(id, stamped)
  },

  deleteWriting(id) {
    // Optimistic cascade: alt sayfa ağacı da düşer — sunucu aynı kuralı uygular
    const prev = get().writings
    const doomed = collectSubtree(id, prev)
    set({ writings: prev.filter(w => !doomed.has(w.id)) })
    // Başarısızsa kaldırılan ağacı geri koy + bildir
    void api.deleteWriting(id).then(res => {
      if (!res.success) {
        set(s => {
          const have = new Set(s.writings.map(w => w.id))
          const restored = prev.filter(w => doomed.has(w.id) && !have.has(w.id))
          return { writings: [...restored, ...s.writings] }
        })
        useToastStore.getState().show(res.message || 'Yazı silinemedi', 'error')
      }
    })
  },

  loadWriting(id) {
    const w = get().writings.find(x => x.id === id)
    // Zaten tam yüklü ya da istek uçuşta → tekrar çekme
    if (!w || w.loaded || loadingIds.has(id)) return
    loadingIds.add(id)
    void api.fetchWriting(id).then(res => {
      loadingIds.delete(id)
      if (res.success && res.data) {
        set(s => ({ writings: s.writings.map(x => (x.id === id ? { ...x, ...res.data, loaded: true } : x)) }))
      } else {
        useToastStore.getState().show(res.message || 'Yazı içeriği yüklenemedi', 'error')
      }
    })
  },

  getWriting(id) {
    return get().writings.find(w => w.id === id)
  },

  getByItem(itemId) {
    return get().writings.filter(w => w.itemId === itemId)
  },

  getChildren(parentId) {
    return get().writings.filter(w => (parentId ? w.parentId === parentId : !w.parentId))
  },

  categoryOptions() {
    const list = get().writings
    const byId = new Map(list.map(w => [w.id, w]))
    const pathOf = (w: Writing) => {
      const parts: string[] = []
      const seen = new Set<string>()
      let cur: Writing | undefined = w
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        parts.unshift(cur.title.trim() || 'Başlıksız')
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return parts.join(' / ')
    }
    return list
      .filter(w => w.kind === 'category')
      .map(w => ({ id: w.id, path: pathOf(w) }))
      .sort((a, b) => a.path.localeCompare(b.path, 'tr'))
  },
}))

// Yazılar da finance JWT'siyle gerçek backend'den geliyor — token hazır OLMADAN
// fetch edilmemeli (yoksa GetMyWritings'e auth gitmez, boş döner ve yenileyene dek
// öyle kalır). Açılışta token varsa hemen yükle; login sonrası token gelince yeniden.
// GetMyWritings ÖZET döner (content yok) → loaded:false; tam gövde yazı açılınca lazy gelir.
function hydrateWritings() {
  void api.fetchWritings().then(res => {
    const list = res.success ? normalizeKind(res.data).map(w => ({ ...w, loaded: false })) : []
    useWritingStore.setState({ writings: list, hydrated: true })
  })
}

if (useAuthStore.getState().auth) {
  hydrateWritings()
} else {
  // Login yoksa app yükleme kapısında takılmasın — boş liste ile hydrate say
  useWritingStore.setState({ hydrated: true })
}

// Login gerçekleşince (token null → dolu) yazıları çek; çıkışta listeyi boşalt
useAuthStore.subscribe((s, prev) => {
  if (s.auth && !prev.auth) hydrateWritings()
  else if (!s.auth && prev.auth) useWritingStore.setState({ writings: [] })
})
