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
├── types/
│   ├── index.ts               — CuriosityItem, FocusSession, DailyPlan, Writing, AppSettings, View
│   ├── api.ts                 — ResponseModel<T> (ortak .NET yanıt zarfı)
│   └── finance.ts             — finans API modelleri
├── api/
│   ├── plosApi.ts             — backend sözleşmesi: fetch ile /api/* çağrıları (endpoint dokümanlı)
│   ├── migrateLocal.ts        — tek seferlik localStorage → mock backend taşıma + ilk açılış seed'i
│   └── financeApi.ts          — harici .NET finans API'si
├── store/
│   ├── useQueueStore.ts       — items; optimistic CRUD + plosApi persist
│   ├── useSessionStore.ts     — aktif seans + geçmiş
│   ├── usePlanStore.ts        — günlük planlar
│   ├── useWritingStore.ts     — yazılar (Notion tarzı parentId hiyerarşisi)
│   ├── usePomodoroStore.ts    — pomodoro durumu + log
│   ├── useSettingsStore.ts    — kullanıcı ayarları
│   └── useUIStore.ts          — view, selectedItemId, modal state (persist edilmez)
├── utils/
│   ├── scheduling.ts          — suggestItems() algoritması
│   ├── format.ts              — formatSeconds, formatMinutes, todayStr
│   └── tree.ts                — collectSubtree() (cascade silme — items + writings)
├── data/mockData.ts           — ilk açılış seed verileri (migrateLocal üzerinden import edilir)
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
│   ├── review/ReviewView.tsx  — haftalık istatistik
│   └── finance/               — ayrı modül: harici .NET API'ye bağlı finansal yönetim
│       ├── FinanceView.tsx    — auth kapısı (login yoksa form, varsa dashboard)
│       ├── FinanceLogin.tsx
│       └── FinanceDashboard.tsx — borç özeti, grafik, taksit tablosu
└── common/
    ├── Button.tsx
    ├── Input.tsx
    └── Modal.tsx
```

## Kritik Kurallar

- **Zustand store'ları** — state buradan okunur/yazılır, prop drilling yok.
- **Tüm uygulama verisi `api/plosApi.ts` üzerinden gerçek HTTP ile akar.** İstekler vite'a gömülü mock backend'e gider (`mock/apiPlugin.ts`, sadece dev/preview'da çalışır); her kaynak kendi JSON dosyasında durur — `mock/data/items.json`, `sessions.json`, `active-session.json`, `plans.json`, `writings.json`, `pomodoro.json`, `settings.json` (gitignore'lu). Yanıtlar `ResponseModel<T>` zarfında döner (finansla aynı konvansiyon). Store'lar optimistic günceller (state anında, `void api.x()` arka planda persist), açılışta API'den hydrate olur; App tüm store'lar `hydrated` olana dek yükleme ekranı gösterir. id'ler client GUID'i — backend POST'taki id'yi kabul etmeli. Cascade silme sunucu sorumluluğu (`deletedIds` döner).
- **localStorage artık uygulama verisi için kullanılmaz** — sadece finans auth (`plos_finance_auth`, `plos_finance_hide`) ve migrasyon bayrağı (`plos_migrated_to_api`). Eski anahtarlardaki veri `api/migrateLocal.ts` ile ilk açılışta tek seferlik `POST /api/import`'a taşınır; hiç veri yoksa mockData seed'i yollanır (sunucu doluysa import'u yoksayar).
- **Backend geldiğinde:** `plosApi.ts`'te BASE/proxy gerçek API'ye çevrilecek, imzalar sabit — store'lara dokunulmayacak. `mock/apiPlugin.ts` ölecek; oradaki kurallar (zarf, cascade, seans limiti) ve `migrateLocal.ts` normalize mantığı backend'e taşınacak.
- **Finans modülü** — `api/financeApi.ts` üzerinden harici .NET API'ye gider (dev'de vite proxy `/finance-api` → `https://localhost:7297`, prod'da `VITE_FINANCE_API_URL`). Tüm yanıtlar `ResponseModel<T>`, anahtarlar client'ta camelCase'e normalize edilir; 401'de otomatik refresh token akışı vardır. Tipler `types/finance.ts`.
- **React Compiler aktif** — `useMemo`, `useCallback`, `memo` elle yazılmaz.
- **TypeScript strict** — `import type` kullan, kullanılmayan değişken bırakma.
- **verbatimModuleSyntax aktif** — sadece tip olan import'lar `import type` olmalı.
