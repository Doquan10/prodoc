import { create } from 'zustand'
import type { View } from '../types'

interface UIStore {
  view: View
  selectedItemId: string | null
  showCapture: boolean
  showPostSession: boolean
  setView: (v: View) => void
  selectItem: (id: string | null) => void
  openCapture: () => void
  closeCapture: () => void
  openPostSession: () => void
  closePostSession: () => void
}

export const useUIStore = create<UIStore>(set => ({
  view: 'today',
  selectedItemId: null,
  showCapture: false,
  showPostSession: false,

  setView: (view) => set({ view }),
  selectItem: (selectedItemId) => set({ selectedItemId }),
  openCapture: () => set({ showCapture: true }),
  closeCapture: () => set({ showCapture: false }),
  openPostSession: () => set({ showPostSession: true }),
  closePostSession: () => set({ showPostSession: false }),
}))
