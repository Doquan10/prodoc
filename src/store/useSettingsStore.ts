import { create } from 'zustand'
import type { AppSettings } from '../types'
import * as api from '../api/plosApi'

interface SettingsStore extends AppSettings {
  hydrated: boolean
  setFocusGoal: (minutes: number) => void
}

export const useSettingsStore = create<SettingsStore>(set => ({
  focusGoalMinutes: 60,
  hydrated: false,

  setFocusGoal(minutes) {
    set({ focusGoalMinutes: minutes })
    void api.saveSettings({ focusGoalMinutes: minutes })
  },
}))

// Açılışta sunucudan yükle — hiç kayıt yoksa varsayılanlar geçerli kalır
void api.fetchSettings().then(res => {
  useSettingsStore.setState({
    ...(res.success && res.data ? res.data : {}),
    hydrated: true,
  })
})
