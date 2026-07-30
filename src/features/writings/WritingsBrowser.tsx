import { useState } from 'react'
import type { Writing } from '../../types'
import { useWritingStore } from '../../store/useWritingStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { stripMarkdown } from '../../utils/markdown'
import { collectSubtree } from '../../utils/tree'
import { dayOf, formatDate } from '../../utils/format'

interface Props {
  /** İçeriği listelenen kategori; kök seviye için null. */
  parentId: string | null
}

type SortKey = 'updated' | 'title' | 'created'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Son düzenlenen' },
  { key: 'title', label: 'A–Z' },
  { key: 'created', label: 'Oluşturulma' },
]

/** Kategori simgesi paleti — hızlı seçim için sık kullanılan emojiler. */
const ICONS = ['📁', '📚', '💡', '🧠', '🔬', '💻', '🎨', '📝', '⚛️', '🧮', '🌍', '🎯', '🔖', '⭐', '🔥', '📌', '🗂️', '🧩', '📐', '🎬']

/** Klasör görünümü: bir kategorinin (veya kökün) altındaki kategori ve yazıları listeler. */
export default function WritingsBrowser({ parentId }: Props) {
  const writings = useWritingStore(s => s.writings)
  const addWriting = useWritingStore(s => s.addWriting)
  const updateWriting = useWritingStore(s => s.updateWriting)
  const deleteWriting = useWritingStore(s => s.deleteWriting)
  const items = useQueueStore(s => s.items)
  const { openWriting, closeWriting } = useUIStore()

  const current = parentId ? writings.find(w => w.id === parentId) : undefined
  const [title, setTitle] = useState(current?.title ?? '')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [iconOpen, setIconOpen] = useState(false)

  // Kök → ... → bu kategori zinciri (döngüye karşı korumalı)
  const crumbs: Writing[] = []
  if (current) {
    const seen = new Set<string>([current.id])
    let cur: Writing | undefined = current
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      cur = writings.find(w => w.id === cur!.parentId)
      if (cur) crumbs.unshift(cur)
    }
  }

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const cmp = comparator(sort)

  // Arama yoksa yalnızca bu seviyedeki çocuklar; arama varsa tüm alt ağaçta gez.
  const scope = searching
    ? descendantsOf(parentId, writings).filter(matches(q))
    : writings.filter(w => (parentId ? w.parentId === parentId : !w.parentId))

  const categories = scope.filter(w => w.kind === 'category').sort(cmp)
  const notes = scope.filter(w => w.kind === 'note').sort(cmp)

  // Kontrol çubuğunu göstermek için bu seviyede hiç öğe var mı?
  const hasChildren = writings.some(w => (parentId ? w.parentId === parentId : !w.parentId))

  function commitTitle() {
    if (current && title.trim() !== current.title) updateWriting(current.id, { title: title.trim() })
  }

  function handleNewCategory() {
    openWriting(addWriting({ parentId: parentId ?? undefined, kind: 'category' }))
  }

  function handleNewNote() {
    openWriting(addWriting({ parentId: parentId ?? undefined, kind: 'note' }))
  }

  function handleDeleteCategory() {
    if (!current) return
    const sub = collectSubtree(current.id, writings).size - 1
    const msg = sub > 0
      ? `"${current.title.trim() || 'Başlıksız'}" kategorisini ve içindeki ${sub} öğeyi silmek istiyor musun?`
      : `"${current.title.trim() || 'Başlıksız'}" kategorisini silmek istiyor musun?`
    if (!confirm(msg)) return
    const up = current.parentId
    deleteWriting(current.id)
    if (up) openWriting(up)
    else closeWriting()
  }

  return (
    <div className="view-container">
      {/* Kök değilse breadcrumb, kökse başlık */}
      {current ? (
        <nav className="writing-crumbs" style={{ marginBottom: 12 }}>
          <button className="writing-crumb" onClick={closeWriting}>Yazılarım</button>
          {crumbs.map(c => (
            <span key={c.id} className="writing-crumb-pair">
              <span className="writing-crumb-sep">/</span>
              <button className="writing-crumb" onClick={() => openWriting(c.id)}>
                {c.title.trim() || 'Başlıksız'}
              </button>
            </span>
          ))}
          <span className="writing-crumb-sep">/</span>
          <span className="writing-crumb current">{title.trim() || 'Başlıksız'}</span>
        </nav>
      ) : null}

      <div className="view-header">
        <div className="writing-title-row" style={{ flex: 1, minWidth: 0 }}>
          {current ? (
            <>
              <div className="writing-icon-picker">
                <button
                  type="button"
                  className="writing-cat-icon-btn"
                  title="Simge seç"
                  onClick={() => setIconOpen(v => !v)}
                >
                  {current.icon ?? '▸'}
                </button>
                {iconOpen && (
                  <div className="writing-icon-menu">
                    {ICONS.map(ic => (
                      <button
                        key={ic}
                        className={`writing-icon-opt ${current.icon === ic ? 'active' : ''}`}
                        onClick={() => { updateWriting(current.id, { icon: ic }); setIconOpen(false) }}
                      >
                        {ic}
                      </button>
                    ))}
                    {current.icon && (
                      <button
                        className="writing-icon-clear"
                        onClick={() => { updateWriting(current.id, { icon: undefined }); setIconOpen(false) }}
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input
                className="writing-cat-title-input"
                placeholder="Kategori adı…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                autoFocus={!current.title}
              />
            </>
          ) : (
            <>
              <h1 className="view-title">Yazılarım</h1>
              <p className="view-subtitle">kategorilerle düzenle, yazılarla anlat</p>
            </>
          )}
        </div>
        <div className="writing-browser-actions">
          <button className="btn btn-ghost" onClick={handleNewCategory}>▸ Kategori</button>
          <button className="btn btn-primary" onClick={handleNewNote}>+ Yazı</button>
          {current && (
            <button className="btn btn-ghost" style={{ color: 'var(--err)' }} onClick={handleDeleteCategory}>
              Sil
            </button>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="writing-controls">
          <div className="writing-search">
            <span className="writing-search-icon">⌕</span>
            <input
              className="writing-search-input"
              placeholder={current ? 'Bu kategoride ara…' : 'Tüm yazılarda ara…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="writing-search-clear" onClick={() => setQuery('')} title="Temizle">×</button>
            )}
          </div>
          <div className="writing-sort">
            {SORTS.map(s => (
              <button
                key={s.key}
                className={`writing-sort-btn ${sort === s.key ? 'active' : ''}`}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {scope.length === 0 ? (
        searching ? (
          <div className="writing-empty">
            <div className="writing-empty-glyph">⌕</div>
            <p className="writing-empty-title">Sonuç yok</p>
            <p className="writing-empty-hint">
              “<strong>{query.trim()}</strong>” ile eşleşen bir şey bulunamadı.
            </p>
          </div>
        ) : (
          <div className="writing-empty">
            <div className="writing-empty-glyph">{current ? '▸' : '✎'}</div>
            <p className="writing-empty-title">{current ? 'Bu kategori boş' : 'Henüz bir şey yok'}</p>
            <p className="writing-empty-hint">
              <strong>▸ Kategori</strong> ile konu klasörü aç, <strong>+ Yazı</strong> ile içeriğini yaz.
            </p>
          </div>
        )
      ) : (
        <div className="writing-browser">
          {categories.length > 0 && (
            <>
              <div className="writing-group-label">
                {searching ? 'Eşleşen kategoriler' : 'Kategoriler'} · {categories.length}
              </div>
              <div className="writing-browser-grid">
                {categories.map(c => {
                  const kids = writings.filter(w => w.parentId === c.id)
                  const catN = kids.filter(k => k.kind === 'category').length
                  const noteN = kids.filter(k => k.kind === 'note').length
                  const parts: string[] = []
                  if (catN) parts.push(`${catN} kategori`)
                  if (noteN) parts.push(`${noteN} yazı`)
                  return (
                    <button key={c.id} className="writing-folder-card" onClick={() => openWriting(c.id)}>
                      <div className="writing-folder-top">
                        <span className={`writing-folder-icon ${c.icon ? 'emoji' : ''}`}>{c.icon ?? '▸'}</span>
                        <span className="writing-folder-count">{kids.length > 0 ? kids.length : '·'}</span>
                      </div>
                      <span className="writing-folder-title">{c.title.trim() || 'Başlıksız'}</span>
                      <div className="writing-folder-foot">
                        <span className="writing-folder-meta">{parts.join(' · ') || 'boş'}</span>
                        <span className="writing-folder-date">{formatDate(dayOf(c.updatedAt))}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {notes.length > 0 && (
            <>
              <div className="writing-group-label" style={{ marginTop: categories.length > 0 ? 22 : 0 }}>
                {searching ? 'Eşleşen yazılar' : 'Yazılar'} · {notes.length}
              </div>
              <div className="writing-list">
                {notes.map(w => {
                  const item = w.itemId ? items.find(i => i.id === w.itemId) : undefined
                  const excerpt = stripMarkdown(w.content).slice(0, 160)
                  return (
                    <button key={w.id} className="writing-card" onClick={() => openWriting(w.id)}>
                      <span className="writing-card-glyph">✎</span>
                      <div className="writing-card-body">
                        <div className="writing-card-top">
                          <span className="writing-card-title">{w.title.trim() || 'Başlıksız'}</span>
                          <span className="writing-card-date">{formatDate(dayOf(w.updatedAt))}</span>
                        </div>
                        {excerpt && <p className="writing-card-excerpt">{excerpt}{stripMarkdown(w.content).length > 160 ? '…' : ''}</p>}
                        {item && (
                          <div className="writing-card-badges">
                            <span className="writing-card-item">◈ {item.question}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** parentId'nin tüm torunları (kendisi hariç); kök için tüm yazılar. */
function descendantsOf(parentId: string | null, writings: Writing[]): Writing[] {
  if (!parentId) return writings
  const ids = collectSubtree(parentId, writings)
  return writings.filter(w => w.id !== parentId && ids.has(w.id))
}

/** Başlık veya içerikte (markdown temizlenmiş) arama eşleşmesi. */
function matches(q: string) {
  return (w: Writing) =>
    w.title.toLowerCase().includes(q) || stripMarkdown(w.content).toLowerCase().includes(q)
}

function comparator(sort: SortKey): (a: Writing, b: Writing) => number {
  if (sort === 'title') {
    return (a, b) =>
      (a.title.trim() || 'Başlıksız').localeCompare(b.title.trim() || 'Başlıksız', 'tr')
  }
  if (sort === 'created') return (a, b) => b.createdAt.localeCompare(a.createdAt)
  return (a, b) => b.updatedAt.localeCompare(a.updatedAt)
}
