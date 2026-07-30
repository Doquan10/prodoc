import { create } from 'zustand'
import type { CuriosityItem, ItemStatus } from '../types'
import { todayStr } from '../utils/format'
import { collectSubtree } from '../utils/tree'
import * as api from '../api/plosApi'

interface QueueStore {
  items: CuriosityItem[]
  hydrated: boolean
  addItem: (question: string, opts?: Partial<Omit<CuriosityItem, 'id' | 'createdAt' | 'question'>>) => string
  updateItem: (id: string, changes: Partial<CuriosityItem>) => void
  deleteItem: (id: string) => void
  setStatus: (id: string, status: ItemStatus) => void
  getItem: (id: string) => CuriosityItem | undefined
  getChildren: (parentId: string) => CuriosityItem[]
}

// Aksiyonlar optimistic çalışır: state anında güncellenir, mock API arka planda
// persist eder. id'ler client GUID'i olduğu için POST yanıtı beklenmez.
export const useQueueStore = create<QueueStore>((set, get) => ({
  items: [],
  hydrated: false,

  addItem(question, opts = {}) {
    const item: CuriosityItem = {
      id: crypto.randomUUID(),
      question: question.trim(),
      status: 'inbox',
      priority: 3,
      createdAt: todayStr(),
      tags: [],
      ...opts,
    }
    set(s => ({ items: [item, ...s.items] }))
    void api.createItem(item)
    return item.id
  },

  updateItem(id, changes) {
    set(s => ({ items: s.items.map(i => (i.id === id ? { ...i, ...changes } : i)) }))
    void api.updateItem(id, changes)
  },

  deleteItem(id) {
    // Optimistic cascade — sunucu (mock API) da aynı kuralı uygular
    set(s => {
      const doomed = collectSubtree(id, s.items)
      return { items: s.items.filter(i => !doomed.has(i.id)) }
    })
    void api.deleteItem(id)
  },

  setStatus(id, status) {
    const changes: Partial<CuriosityItem> = { status }
    if (status === 'learned') changes.learnedAt = todayStr()
    get().updateItem(id, changes)
  },

  getItem(id) {
    return get().items.find(i => i.id === id)
  },

  getChildren(parentId) {
    return get().items.filter(i => i.parentId === parentId)
  },
}))

// Açılışta sunucudan yükle — App, tüm store'lar hydrate olana dek yükleme ekranı gösterir
void api.fetchItems().then(res => {
  useQueueStore.setState({ items: res.success ? res.data : [], hydrated: true })
})
