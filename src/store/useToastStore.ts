import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: Toast[]
  show: (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>(set => ({
  toasts: [],

  show: (message, type = 'success') => {
    const id = nextId++
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 3500)
  },

  dismiss: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
