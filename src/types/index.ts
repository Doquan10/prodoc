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
  tags: string[]
  estimatedMinutes?: number
  difficulty?: Difficulty
  priority: number // 1–5
  notes?: string // kullanıcının kendi araştırma notları (serbest metin)
  scheduledDate?: string // YYYY-MM-DD
  parentId?: string
  categoryId?: string // bağlı olduğu bilgi kategorisi (Writing, kind='category')
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
  pausedAt?: string    // ISO — şu an duraklatılmış ise set
  totalPausedMs: number // birikimli duraklatma süresi
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
  itemIds: string[]
  mustItems: MustTask[]
}

/** Bir düğüm ya klasör gibi davranan bir 'category' ya da markdown belgesi olan bir 'note'. */
export type WritingKind = 'category' | 'note'

/** Yazıya sırayla eklenen referans/döküman bağlantısı. */
export interface DocLink {
  id: string
  url: string
  title?: string
}

export interface Writing {
  id: string
  itemId?: string // bağlı olduğu merak konusu (opsiyonel — bağımsız yazı da olabilir)
  parentId?: string // içinde bulunduğu kategori (yoksa kök seviye)
  kind: WritingKind // 'category' → içine kategori/yazı alır; 'note' → markdown belge (yaprak)
  icon?: string // kategori için seçilen emoji simge (yoksa varsayılan klasör glyph'i)
  title: string
  content: string // markdown (yalnızca note için anlamlı)
  documents?: DocLink[] // sağ paneldeki sıralı referans bağlantıları
  createdAt: string // ISO
  updatedAt: string // ISO
}

export interface AppSettings {
  focusGoalMinutes: number
}

export type View = 'today' | 'queue' | 'plan' | 'focus' | 'review' | 'finance' | 'writings'
