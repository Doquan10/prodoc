import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'plos_theme'

function loadTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

/** <html data-theme="..."> — index.css bu seçiciye göre paleti değiştirir. */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// İlk boyamadan önce uygula — yanlış tema flash'ı olmasın
applyTheme(loadTheme())

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>(set => ({
  theme: loadTheme(),

  toggleTheme: () =>
    set(s => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, theme)
      applyTheme(theme)
      return { theme }
    }),
}))
