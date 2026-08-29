import { create } from 'zustand'
import type { CuriosityItem, ItemStatus } from '../types'
import { todayStr } from '../utils/format'
import { collectSubtree } from '../utils/tree'
import * as api from '../api/plosApi'
import { useToastStore } from './useToastStore'
import { useAuthStore } from './useAuthStore'

interface QueueStore {
  items: CuriosityItem[]
  hydrated: boolean
  addItem: (question: string, opts?: Partial<Omit<CuriosityItem, 'id' | 'createdAt' | 'question'>>) => string
  updateItem: (id: string, changes: Partial<CuriosityItem>) => Promise<boolean>
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
    // Optimistic: item anında listede; backend başarısız dönerse geri al + bildir
    void api.createItem(item).then(res => {
      if (res.success) {
        useToastStore.getState().show('Merak eklendi ✅', 'success')
      } else {
        set(s => ({ items: s.items.filter(i => i.id !== item.id) }))
        useToastStore.getState().show(res.message || 'Merak eklenemedi', 'error')
      }
    })
    return item.id
  },

  updateItem(id, changes) {
    const prev = get().items.find(i => i.id === id)
    if (!prev) return Promise.resolve(false)
    // Gerçekten değişen bir alan yoksa hiç dokunma — gereksiz Update isteği gitmesin
    const changed = (Object.keys(changes) as (keyof CuriosityItem)[])
      .some(k => !Object.is(prev[k], changes[k]))
    if (!changed) return Promise.resolve(true)
    const updated = { ...prev, ...changes }
    set(s => ({ items: s.items.map(i => (i.id === id ? updated : i)) }))
    // Optimistic: backend başarısızsa eski hale geri al. Bildirim çağırana bırakılır
    // (ör. ItemDetail modal kapanınca tek özet toast gösterir) — burada toast yok.
    return api.updateItem(updated).then(res => {
      if (res.success) return true
      set(s => ({ items: s.items.map(i => (i.id === id ? prev : i)) }))
      return false
    })
  },

  deleteItem(id) {
    // Optimistic cascade — sunucu da alt ağacı siler. Başarısızsa silinenleri geri koy.
    const doomed = collectSubtree(id, get().items)
    const removed = get().items.filter(i => doomed.has(i.id))
    set(s => ({ items: s.items.filter(i => !doomed.has(i.id)) }))
    void api.deleteItem(id).then(res => {
      if (res.success) {
        useToastStore.getState().show('Merak silindi 🗑️', 'success')
      } else {
        set(s => ({ items: [...s.items, ...removed] }))
        useToastStore.getState().show(res.message || 'Silinemedi', 'error')
      }
    })
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

// Item'lar artık finance JWT'siyle gerçek backend'den geliyor — bu yüzden token
// hazır OLMADAN fetch edilmemeli (yoksa GetAll'a auth gitmez, currentUserId boş
// bulunur). Açılışta token varsa hemen yükle; login sonrası token gelince yeniden.
function hydrateItems() {
  void api.fetchItems().then(res => {
    if (!res.success) useToastStore.getState().show('Sunucu hatası', 'error')
    useQueueStore.setState({ items: res.success ? res.data : [], hydrated: true })
  })
}

if (useAuthStore.getState().auth) {
  hydrateItems()
} else {
  // Login yoksa app yükleme kapısında takılmasın — boş liste ile hydrate say
  useQueueStore.setState({ hydrated: true })
}

// Login gerçekleşince (token null → dolu) item'ları çek; çıkışta listeyi boşalt
useAuthStore.subscribe((s, prev) => {
  if (s.auth && !prev.auth) hydrateItems()
  else if (!s.auth && prev.auth) useQueueStore.setState({ items: [] })
})
