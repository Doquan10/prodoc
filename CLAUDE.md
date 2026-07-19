# PLOS — Personal Learning Operating System

React 19 + TypeScript 6 + Vite 8 uygulaması. Merak → Odaklanma → Öğrenme döngüsünü yöneten üretkenlik aracı.

## Komutlar

```bash
npm run dev       # geliştirme sunucusu
npm run build     # tsc -b && vite build
npm run lint      # eslint
```

## Temel Kavramlar

- **CuriosityItem** — merkezi varlık. Kullanıcının merak ettiği şeyler, hiyerarşik (parentId).
- **FocusSession** — bir item üzerindeki odaklanma seansı.
- **DailyPlan** — günlük LEARN / EXPLORE / MUST planı.
- **Lifecycle:** inbox → refined → scheduled → in_progress → learned → revisit

## Mimari

```
src/
├── types/index.ts             — CuriosityItem, FocusSession, DailyPlan, View
├── store/
│   ├── useQueueStore.ts       — items CRUD, localStorage
│   ├── useSessionStore.ts     — aktif seans + geçmiş
│   ├── usePlanStore.ts        — günlük planlar
│   └── useUIStore.ts          — view, selectedItemId, modal state
├── utils/
│   ├── scheduling.ts          — suggestItems() algoritması
│   └── format.ts              — formatSeconds, formatMinutes, todayStr
├── data/mockData.ts           — başlangıç verileri
├── features/
│   ├── capture/QuickCapture.tsx
│   ├── queue/
│   │   ├── QueueView.tsx
│   │   ├── QueueItem.tsx
│   │   └── ItemDetail.tsx     — modal, seans başlatma + research tree
│   ├── today/TodayView.tsx    — "Give me something to learn"
│   ├── focus/
│   │   ├── FocusView.tsx      — timer, distraction log
│   │   └── PostSession.tsx    — outcome + learning note + yeni sorular
│   └── review/ReviewView.tsx  — haftalık istatistik
└── common/
    ├── Button.tsx
    ├── Input.tsx
    └── Modal.tsx
```

## Kritik Kurallar

- **Zustand store'ları** — state buradan okunur/yazılır, prop drilling yok.
- **localStorage anahtarları:** `plos_queue`, `plos_sessions`, `plos_plans`
- **React Compiler aktif** — `useMemo`, `useCallback`, `memo` elle yazılmaz.
- **TypeScript strict** — `import type` kullan, kullanılmayan değişken bırakma.
- **verbatimModuleSyntax aktif** — sadece tip olan import'lar `import type` olmalı.
- Firebase entegrasyonu geldiğinde: store'lardaki `localStorage.setItem` → Firestore write.
