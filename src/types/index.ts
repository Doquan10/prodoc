export type Difficulty = 'light' | 'medium' | 'deep'

export type ItemStatus =
  | 'inbox'
  | 'refined'
  | 'scheduled'
  | 'in_progress'
  | 'learned'
  | 'revisit'

export type SessionOutcome = 'learned' | 'partial' | 'questions_appeared' | 'stuck'

export interface CuriosityItem {
  id: string
  question: string
  status: ItemStatus
  category?: string
  estimatedMinutes?: number
  difficulty?: Difficulty
  priority: number // 1–5
  notes?: string // kullanıcının kendi araştırma notları (serbest metin)
  scheduledDate?: string // YYYY-MM-DD
  parentId?: string
  createdAt: string
  learnedAt?: string
}

export interface FocusSession {
  id: string
  itemId: string
  plannedMinutes: number
  startedAt: string
  endedAt?: string
  actualMinutes?: number
  outcome?: SessionOutcome
  learningNote?: string
  newQuestions?: string[]
  distractionCount: number
}

export interface MustTask {
  id: string
  text: string
  time?: string    // 'HH:MM' — ne zaman yapılacak
  minutes?: number // tahmini süre
  done?: boolean   // tamamlandı mı
}

export interface DailyPlan {
  date: string
  learnItemIds: string[]
  exploreItemIds: string[]
  mustItems: MustTask[]
}

export type View = 'today' | 'queue' | 'plan' | 'focus' | 'pomodoro' | 'review'
