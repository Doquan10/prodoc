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

export interface DailyPlan {
  date: string
  learnItemIds: string[]
  exploreItemIds: string[]
  mustItems: string[]
}

export type View = 'today' | 'queue' | 'focus' | 'review'
