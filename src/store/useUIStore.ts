import { create } from 'zustand'
import type { View } from '../types'

interface UIStore {
  view: View
  selectedItemId: string | null
  selectedWritingId: string | null
  showCapture: boolean
  showPostSession: boolean
  setView: (v: View) => void
  selectItem: (id: string | null) => void
  openWriting: (id: string) => void
  closeWriting: () => void
  openCapture: () => void
  closeCapture: () => void
  openPostSession: () => void
  closePostSession: () => void
}

export const useUIStore = create<UIStore>(set => ({
  view: 'today',
  selectedItemId: null,
  selectedWritingId: null,
  showCapture: false,
  showPostSession: false,

  setView: (view) => set({ view }),
  selectItem: (selectedItemId) => set({ selectedItemId }),
  // Yazı açmak görünümü de değiştirir — odak seansı veya konu detayından gelinebilir
  openWriting: (selectedWritingId) => set({ selectedWritingId, view: 'writings' }),
  closeWriting: () => set({ selectedWritingId: null }),
  openCapture: () => set({ showCapture: true }),
  closeCapture: () => set({ showCapture: false }),
  openPostSession: () => set({ showPostSession: true }),
  closePostSession: () => set({ showPostSession: false }),
}))
