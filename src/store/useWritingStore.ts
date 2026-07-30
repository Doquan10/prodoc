import { create } from 'zustand'
import type { Writing, WritingKind } from '../types'
import { collectSubtree } from '../utils/tree'
import * as api from '../api/plosApi'

/** Eski kayıtlarda kind yoktu: alt öğesi olan → kategori, olmayan → yazı. */
function normalizeKind(list: Writing[]): Writing[] {
  const parents = new Set(list.map(w => w.parentId).filter(Boolean))
  return list.map(w => (w.kind ? w : { ...w, kind: parents.has(w.id) ? 'category' : 'note' }))
}

interface WritingStore {
  writings: Writing[]
  hydrated: boolean
  addWriting: (opts?: { title?: string; itemId?: string; content?: string; parentId?: string; kind?: WritingKind }) => string
  updateWriting: (id: string, changes: Partial<Pick<Writing, 'title' | 'content' | 'itemId' | 'parentId' | 'icon'>>) => void
  deleteWriting: (id: string) => void
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
      createdAt: now,
      updatedAt: now,
    }
    set(s => ({ writings: [writing, ...s.writings] }))
    void api.createWriting(writing)
    return writing.id
  },

  updateWriting(id, changes) {
    const stamped = { ...changes, updatedAt: new Date().toISOString() }
    set(s => ({ writings: s.writings.map(w => (w.id === id ? { ...w, ...stamped } : w)) }))
    void api.updateWriting(id, stamped)
  },

  deleteWriting(id) {
    // Optimistic cascade: alt sayfa ağacı da düşer — sunucu aynı kuralı uygular
    set(s => {
      const doomed = collectSubtree(id, s.writings)
      return { writings: s.writings.filter(w => !doomed.has(w.id)) }
    })
    void api.deleteWriting(id)
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

// Açılışta sunucudan yükle
void api.fetchWritings().then(res => {
  useWritingStore.setState({ writings: res.success ? normalizeKind(res.data) : [], hydrated: true })
})
