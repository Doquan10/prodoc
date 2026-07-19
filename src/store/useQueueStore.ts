import { create } from 'zustand'
import type { CuriosityItem, ItemStatus } from '../types'
import { mockItems } from '../data/mockData'

function load(): CuriosityItem[] {
  try {
    const v = localStorage.getItem('plos_queue')
    return v ? JSON.parse(v) : mockItems
  } catch {
    return mockItems
  }
}

function save(items: CuriosityItem[]) {
  localStorage.setItem('plos_queue', JSON.stringify(items))
}

interface QueueStore {
  items: CuriosityItem[]
  addItem: (question: string, opts?: Partial<Omit<CuriosityItem, 'id' | 'createdAt' | 'question'>>) => string
  updateItem: (id: string, changes: Partial<CuriosityItem>) => void
  deleteItem: (id: string) => void
  setStatus: (id: string, status: ItemStatus) => void
  getItem: (id: string) => CuriosityItem | undefined
  getChildren: (parentId: string) => CuriosityItem[]
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  items: load(),

  addItem(question, opts = {}) {
    const item: CuriosityItem = {
      id: crypto.randomUUID(),
      question: question.trim(),
      status: 'inbox',
      priority: 3,
      createdAt: new Date().toISOString().split('T')[0],
      ...opts,
    }
    set(s => {
      const next = [item, ...s.items]
      save(next)
      return { items: next }
    })
    return item.id
  },

  updateItem(id, changes) {
    set(s => {
      const next = s.items.map(i => (i.id === id ? { ...i, ...changes } : i))
      save(next)
      return { items: next }
    })
  },

  deleteItem(id) {
    set(s => {
      const next = s.items.filter(i => i.id !== id && i.parentId !== id)
      save(next)
      return { items: next }
    })
  },

  setStatus(id, status) {
    const changes: Partial<CuriosityItem> = { status }
    if (status === 'learned') changes.learnedAt = new Date().toISOString().split('T')[0]
    get().updateItem(id, changes)
  },

  getItem(id) {
    return get().items.find(i => i.id === id)
  },

  getChildren(parentId) {
    return get().items.filter(i => i.parentId === parentId)
  },
}))
