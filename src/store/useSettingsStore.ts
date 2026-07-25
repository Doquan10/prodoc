import { create } from 'zustand'

interface Settings {
  focusGoalMinutes: number
}

function load(): Settings {
  try {
    const v = localStorage.getItem('plos_settings')
    if (v) return { focusGoalMinutes: 60, ...JSON.parse(v) }
  } catch { /* ignore */ }
  return { focusGoalMinutes: 60 }
}

interface SettingsStore extends Settings {
  setFocusGoal: (minutes: number) => void
}

export const useSettingsStore = create<SettingsStore>(set => ({
  ...load(),

  setFocusGoal(minutes) {
    localStorage.setItem('plos_settings', JSON.stringify({ focusGoalMinutes: minutes }))
    set({ focusGoalMinutes: minutes })
  },
}))
