import { useEffect, useRef, useState } from 'react'
import type { Writing } from '../../types'
import { useWritingStore } from '../../store/useWritingStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { useToastStore } from '../../store/useToastStore'
import { renderMarkdown, TEXT_COLORS } from '../../utils/markdown'
import { dayOf, formatDate } from '../../utils/format'

interface Props {
  writingId: string
}

export default function WritingEditor({ writingId }: Props) {
  const writings = useWritingStore(s => s.writings)
  const { getWriting, updateWriting, deleteWriting } = useWritingStore()
  const { getItem } = useQueueStore()
  const { closeWriting, selectItem, openWriting } = useUIStore()
  const showToast = useToastStore(s => s.show)

  const writing = getWriting(writingId)
  const [title, setTitle] = useState(writing?.title ?? '')
  const [content, setContent] = useState(writing?.content ?? '')
  // 'split' varsayılan — yazarken renk/liste biçimi sağda canlı görünür
  const [mode, setMode] = useState<'write' | 'split' | 'preview'>('split')
  const [saved, setSaved] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)

  const draftRef = useRef({ title, content })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  function commit() {
    const w = useWritingStore.getState().getWriting(writingId)
    if (!w) return
    const { title, content } = draftRef.current
    if (title === w.title && content === w.content) return
    updateWriting(writingId, { title, content })
  }

  function handleChange(changes: Partial<{ title: string; content: string }>) {
    if (changes.title !== undefined) setTitle(changes.title)
    if (changes.content !== undefined) setContent(changes.content)
    draftRef.current = { ...draftRef.current, ...changes }
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      commit()
      setSaved(true)
    }, 600)
  }

  // Unmount'ta bekleyen taslağı kaydet
  useEffect(() => () => {
    clearTimeout(timer.current)
    const w = useWritingStore.getState().getWriting(writingId)
    if (w && (draftRef.current.title !== w.title || draftRef.current.content !== w.content)) {
      useWritingStore.getState().updateWriting(writingId, draftRef.current)
    }
  }, [writingId])

  /** Seçili metni before/after ile sarar; seçim yoksa placeholder ekler. */
  function applyInline(before: string, after: string, placeholder: string) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = content.slice(start, end) || placeholder
    const next = content.slice(0, start) + before + sel + after + content.slice(end)
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }

  /** Seçimin kapsadığı satırların başına liste/alıntı/başlık öneki ekler. */
  function applyLinePrefix(prefix: string, numbered = false) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const lineEndIdx = content.indexOf('\n', end)
    const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx
    const lines = content.slice(lineStart, lineEnd).split('\n')
    const prefixed = lines
      .map((l, i) => (l.trim() || lines.length === 1 ? (numbered ? `${i + 1}. ` : prefix) + l : l))
      .join('\n')
    const next = content.slice(0, lineStart) + prefixed + content.slice(lineEnd)
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(lineStart, lineStart + prefixed.length)
    })
  }

  if (!writing) {
    return (
      <div className="view-container">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <p>Yazı bulunamadı.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={closeWriting}>
            ← Yazılarım
          </button>
        </div>
      </div>
    )
  }

  const item = writing.itemId ? getItem(writing.itemId) : undefined
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  // Kök → ... → üst sayfa zinciri (döngüye karşı korumalı)
  const crumbs: Writing[] = []
  {
    const seen = new Set<string>([writing.id])
    let cur: Writing | undefined = writing
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      cur = writings.find(w => w.id === cur!.parentId)
      if (cur) crumbs.unshift(cur)
    }
  }

  function goTo(id: string) {
    commit()
    openWriting(id) // WritingsView'daki key remount ile editör state'i sıfırlanır
  }

  function shareText() {
    const t = draftRef.current.title.trim()
    const c = draftRef.current.content
    return t ? `# ${t}\n\n${c}` : c
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText())
      showToast('Yazı panoya kopyalandı')
    } catch {
      showToast('Kopyalama başarısız', 'error')
    }
    setShareOpen(false)
  }

  function handleDownload() {
    const name = (draftRef.current.title.trim() || 'yazi')
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-+|-+$/g, '')
    const blob = new Blob([shareText()], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'yazi'}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Markdown dosyası indirildi')
    setShareOpen(false)
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: draftRef.current.title || 'Yazım', text: shareText() })
    } catch {
      // kullanıcı iptal etti — sessiz geç
    }
    setShareOpen(false)
  }

  function handleDelete() {
    if (!confirm('Bu yazıyı silmek istiyor musun?')) return
    clearTimeout(timer.current)
    draftRef.current = { title: writing?.title ?? '', content: writing?.content ?? '' } // unmount flush'ı yazmasın
    const parentId = writing?.parentId
    deleteWriting(writingId)
    if (parentId) openWriting(parentId)
    else closeWriting()
  }

  return (
    <div className={`view-container writing-editor ${mode === 'split' ? 'wide' : ''}`}>
      {/* Üst bar — Notion tarzı breadcrumb: Yazılarım / kategori / ... / bu sayfa */}
      <div className="writing-editor-top">
        <nav className="writing-crumbs">
          <button className="writing-crumb" onClick={() => { commit(); closeWriting() }}>
            Yazılarım
          </button>
          {crumbs.map(c => (
            <span key={c.id} className="writing-crumb-pair">
              <span className="writing-crumb-sep">/</span>
              <button className="writing-crumb" onClick={() => goTo(c.id)}>
                {c.title.trim() || 'Başlıksız'}
              </button>
            </span>
          ))}
          <span className="writing-crumb-sep">/</span>
          <span className="writing-crumb current">{title.trim() || 'Başlıksız'}</span>
        </nav>
        <div className="writing-editor-actions">
          <div className="writing-tabs">
            {([
              { value: 'write', label: '✎ Yaz' },
              { value: 'split', label: '◧ Canlı' },
              { value: 'preview', label: '◉ Önizle' },
            ] as const).map(t => (
              <button
                key={t.value}
                className={`writing-tab ${mode === t.value ? 'active' : ''}`}
                onClick={() => { commit(); setMode(t.value) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="share-menu-wrap">
            <button className="btn btn-primary" onClick={() => setShareOpen(v => !v)}>
              ↗ Paylaş
            </button>
            {shareOpen && (
              <div className="share-menu">
                <button onClick={handleCopy}>⧉ Panoya Kopyala</button>
                <button onClick={handleDownload}>↓ .md Olarak İndir</button>
                {typeof navigator.share === 'function' && (
                  <button onClick={handleNativeShare}>↗ Cihazla Paylaş…</button>
                )}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ color: 'var(--err)' }} onClick={handleDelete}>
            Sil
          </button>
        </div>
      </div>

      {/* Bağlı konu */}
      {item && (
        <button className="writing-item-link" onClick={() => selectItem(item.id)}>
          ◈ {item.question}
        </button>
      )}

      {mode === 'preview' ? (
        <article className="writing-preview markdown-body">
          <h1 className="writing-preview-title">{title || 'Başlıksız'}</h1>
          <p className="writing-preview-meta">
            {formatDate(dayOf(writing.createdAt))} · {wordCount} kelime
          </p>
          {content.trim()
            ? renderMarkdown(content)
            : <p style={{ color: 'var(--tx-3)' }}>Henüz içerik yok.</p>}
        </article>
      ) : (
        <>
          <input
            className="writing-title-input"
            placeholder="Yazı başlığı…"
            value={title}
            onChange={e => handleChange({ title: e.target.value })}
          />
          <div className="writing-toolbar">
            <button title="Kalın" style={{ fontWeight: 700 }} onClick={() => applyInline('**', '**', 'kalın')}>B</button>
            <button title="İtalik" style={{ fontStyle: 'italic' }} onClick={() => applyInline('*', '*', 'italik')}>I</button>
            <button title="Kod" onClick={() => applyInline('`', '`', 'kod')}>{'</>'}</button>
            <button title="Başlık" onClick={() => applyLinePrefix('## ')}>H</button>
            <span className="writing-toolbar-sep" />
            <button title="Madde listesi" onClick={() => applyLinePrefix('- ')}>•≡</button>
            <button title="Numaralı liste" onClick={() => applyLinePrefix('', true)}>1≡</button>
            <button title="Alıntı" onClick={() => applyLinePrefix('> ')}>❝</button>
            <span className="writing-toolbar-sep" />
            {TEXT_COLORS.map(c => (
              <button
                key={c.name}
                className="writing-color-swatch"
                title={`${c.name} yazı`}
                style={{ background: c.value }}
                onClick={() => applyInline(`{${c.name}|`, '}', 'renkli metin')}
              />
            ))}
          </div>
          <div className={`writing-edit-area ${mode === 'split' ? 'split' : ''}`}>
            <textarea
              ref={contentRef}
              className="writing-content-input"
              placeholder={'Blog yazıyormuş gibi anlat…\n\nMarkdown desteklenir: # başlık, **kalın**, *italik*, `kod`, - liste, > alıntı, {kırmızı|renkli yazı}'}
              value={content}
              onChange={e => handleChange({ content: e.target.value })}
              autoFocus
            />
            {mode === 'split' && (
              <div className="writing-live-pane markdown-body">
                {content.trim()
                  ? renderMarkdown(content)
                  : <p style={{ color: 'var(--tx-3)' }}>Yazdıkça burada biçimli halini göreceksin.</p>}
              </div>
            )}
          </div>
          <div className="writing-editor-footer">
            <span className={`notes-status ${saved ? '' : 'pending'}`}>
              {saved ? 'kaydedildi ✓' : 'yazılıyor…'}
            </span>
            <span>{wordCount} kelime · markdown destekli</span>
          </div>
        </>
      )}
    </div>
  )
}
